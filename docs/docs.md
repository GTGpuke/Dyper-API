# Dyper API — Documentation Technique Complète

> Ce document est la référence centrale du projet Dyper API. Il couvre l'architecture, les choix techniques, les contrats entre services, les structures de fichiers, les types, les conventions de code et les stratégies de déploiement.

---

## Table des matières

1. [Vue d'ensemble du projet](#1-vue-densemble-du-projet)
2. [Architecture globale](#2-architecture-globale)
3. [Contrats inter-services (API Contracts)](#3-contrats-inter-services-api-contracts)
4. [dyper-api — Backend Express](#4-dyper-api--backend-express)
5. [dyper-ai — Microservice Python](#5-dyper-ai--microservice-python)
6. [dyper-web — Frontend React](#6-dyper-web--frontend-react)
7. [Types et interfaces TypeScript partagés](#7-types-et-interfaces-typescript-partagés)
8. [Gestion des erreurs](#8-gestion-des-erreurs)
9. [Sécurité](#9-sécurité)
10. [Tests](#10-tests)
11. [GitHub Actions — Workflows CI](#11-github-actions--workflows-ci)
12. [Déploiement](#12-déploiement)
13. [Conventions de code](#13-conventions-de-code)
14. [Roadmap](#14-roadmap)

---

## 1. Vue d'ensemble du projet

**Dyper API** est une plateforme de reconnaissance visuelle multimodale. Elle accepte :
- Une **image** (upload direct ou URL)
- Une **vidéo** (upload, analyse par extraction de frames)
- Un **prompt texte** seul (analyse contextuelle)
- Une **combinaison image + prompt** (le cas le plus courant)

Et retourne :
- Une **description écrite** naturelle du contenu
- Une **visualisation structurée** : objets détectés avec leurs bounding boxes, scène inférée, couleurs dominantes, tags

> **Périmètre v1** : la reconnaissance repose sur les 80 classes COCO (objets courants). L'OCR (texte dans l'image) et la détection d'émotions sont hors périmètre et réservés à une version future.

Le produit se compose de trois modules indépendants :

| Module | Technologie | Rôle |
|---|---|---|
| `dyper-api` | Node.js / Express | Gateway API publique |
| `dyper-ai` | Python / FastAPI | Moteur d'inférence IA |
| `dyper-web` | React / TypeScript / Vite | Interface utilisateur chatbot |

---

## 2. Architecture globale

### 2.1 Structure du monorepo

```
dyper/
├── dyper-api/              # Backend Node.js / Express
├── dyper-ai/               # Microservice Python / FastAPI
├── dyper-web/              # Frontend React / TypeScript / Vite
├── model/                  # Modèles YOLO (.pt) — non commités
├── docs/
│   └── docs.md             # Ce fichier
└── .github/
    └── workflows/
        ├── dyper-api.yml   # CI backend Express
        ├── dyper-ai.yml    # CI microservice Python
        └── dyper-web.yml   # CI frontend React
```

### 2.2 Diagramme de flux complet

```
┌─────────────────────────────────────────────────────────┐
│                      dyper-web                          │
│   (React + TypeScript + Vite)                           │
│                                                         │
│   ChatWindow → InputBar → drag & drop / prompt          │
│         └── useAnalyze() hook                           │
│               └── api.ts → POST /analyze                │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP multipart/form-data ou JSON
                       ▼
┌─────────────────────────────────────────────────────────┐
│                     dyper-api                           │
│   (Node.js / Express)                          :3000    │
│                                                         │
│   → Validation (Zod)                                    │
│   → Multer (fichier → buffer/tmp)                       │
│   → aiService.js → POST /process                        │
│   → Formatage réponse                                   │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP JSON interne
                       ▼
┌─────────────────────────────────────────────────────────┐
│                     dyper-ai                            │
│   (Python / FastAPI)                           :8000    │
│                                                         │
│   → Décodage image (Pillow / OpenCV)                    │
│   → Pré-traitement                                      │
│   → Inférence modèle IA                                 │
│   → Post-traitement                                     │
│   → Réponse structurée JSON                             │
└─────────────────────────────────────────────────────────┘
```

### 2.3 Choix architecturaux

#### Pourquoi Express en gateway et non directement Python ?
- L'API publique reste en JS/Node.js, plus adapté à la gestion de requêtes HTTP concurrentes et aux middlewares d'authentification/rate-limiting
- La couche Python est un détail d'implémentation interne — on peut changer de modèle ou de variante YOLO sans que les clients ne le voient
- Séparation claire des responsabilités : Express gère le protocole, Python gère l'inférence

#### Pourquoi des modèles YOLO locaux (yolo26l / yolo26x) ?
- **100% local** : aucun appel à une API externe, pas de latence réseau sur l'inférence, pas de coût par requête
- **Deux variantes** : `yolo26l` (large) pour un bon équilibre vitesse/précision, `yolo26x` (extra-large) pour la précision maximale — choix configurable via variable d'environnement
- **COCO dataset** : 80 classes d'objets du quotidien bien documentées (personnes, véhicules, mobilier, animaux, nourriture, etc.)
- **Format `.pt`** (PyTorch) : chargeable directement via la librairie `ultralytics` en une ligne
- **Sorties natives** : bounding boxes, labels, scores de confiance — tout ce qu'il faut pour construire le champ `visualization`

#### Pourquoi FastAPI pour Python ?
- Validation automatique des données via Pydantic (typage fort)
- Documentation Swagger auto-générée (`/docs`)
- Performance async native (comparable à Express en throughput)
- Facilite l'ajout futur de streaming de réponse

#### Pourquoi React + Vite ?
- Vite offre un DX (Developer Experience) nettement supérieur à CRA
- TypeScript natif, rechargement instantané, build optimisé
- React 18 pour les futures fonctionnalités de concurrent rendering (utile pour le streaming)

---

## 3. Contrats inter-services (API Contracts)

Cette section définit les schémas exacts échangés entre les trois modules. C'est la source de vérité pour l'intégration.

### 3.1 dyper-web → dyper-api

#### POST `/analyze` — Upload fichier

```
Headers:
  Content-Type: multipart/form-data

Body (form-data):
  file    : File          (image/jpeg, image/png, image/webp, image/gif, video/mp4)
  prompt  : string?       (optionnel, max 1000 caractères)
  lang    : string?       (optionnel, défaut: "fr", ex: "en", "fr", "es")
```

#### POST `/analyze/url` — Analyse par URL

```
Headers:
  Content-Type: application/json

Body:
{
  "url"    : string,   // URL publique de l'image
  "prompt" : string?,  // optionnel
  "lang"   : string?   // optionnel, défaut "fr"
}
```

#### POST `/analyze/prompt` — Analyse texte seul

```
Headers:
  Content-Type: application/json

Body:
{
  "prompt" : string,   // obligatoire, max 1000 caractères
  "lang"   : string?   // optionnel
}
```

#### GET `/health`

```
Response 200:
{
  "status"  : "ok",
  "uptime"  : number,    // secondes depuis démarrage
  "ai"      : "ok" | "unreachable"  // état du microservice dyper-ai
}
```

#### Réponse standard (succès)

```json
{
  "success": true,
  "requestId": "req_abc123",
  "processingTime": 1240,
  "result": {
    "description": "L'image montre un bureau avec un écran d'ordinateur allumé affichant du code, une tasse de café et des livres empilés à gauche.",
    "visualization": {
      "objects": [
        { "label": "laptop",  "confidence": 0.97, "boundingBox": { "x": 120, "y": 45, "w": 300, "h": 200 } },
        { "label": "cup",     "confidence": 0.91, "boundingBox": { "x": 480, "y": 210, "w": 80,  "h": 90  } },
        { "label": "book",    "confidence": 0.88, "boundingBox": { "x": 20,  "y": 150, "w": 100, "h": 180 } }
      ],
      "scene": {
        "label": "bureau / espace de travail",
        "confidence": 0.95,
        "indoor": true
      },
      "colors": ["#2C3E50", "#ECF0F1", "#E67E22"],
      "text": [],
      "tags": ["technologie", "travail", "intérieur", "café"]
    },
    "model": "yolo26l",
    "lang": "fr"
  }
}
```

> **Langue des labels** : `objects[].label` contient le label COCO brut en **anglais** tel que retourné par le modèle YOLO (ex : `"laptop"`, `"cup"`, `"book"`). La traduction française s'applique uniquement au champ `description` via la table `COCO_FR` dans `dyper-ai`. `scene.label` est directement en français car il est généré par les règles de scène.

#### Réponse standard (erreur)

```json
{
  "success": false,
  "requestId": "req_abc123",
  "error": {
    "code": "FILE_TOO_LARGE",
    "message": "Le fichier dépasse la taille maximale autorisée (10 Mo).",
    "details": {}
  }
}
```

### 3.2 dyper-api → dyper-ai (interne)

#### POST `/process`

```
Headers:
  Content-Type: application/json
  X-Internal-Key: <secret>   // clé secrète partagée entre les deux services

Body:
{
  "requestId"   : string,
  "type"        : "image" | "video" | "prompt",
  "imageBase64" : string?,   // image encodée en base64 si type = "image"
  "imageUrl"    : string?,   // URL si analyse par URL
  "videoBase64" : string?,   // vidéo encodée en base64 si type = "video"
  "prompt"      : string?,
  "lang"        : string
}
```

#### Réponse `/process`

```json
{
  "requestId": "req_abc123",
  "description": "...",
  "visualization": {
    "objects": [ { "label": "person", "confidence": 0.95, "boundingBox": { "x": 120, "y": 30, "w": 80, "h": 200 } } ],
    "scene":   { "label": "bureau / espace de travail", "confidence": 0.88, "indoor": true },
    "colors":  ["#1A1A2E", "#ECF0F1"],
    "text":    [],
    "tags":    ["tag1", "tag2"]
  },
  "model": "...",
  "processingTimeMs": 800
}
```

---

## 4. dyper-api — Backend Express

### 4.1 Stack technique

| Outil | Version | Usage |
|---|---|---|
| Node.js | 20 LTS | Runtime |
| Express | 4.x | Framework HTTP |
| Multer | 1.x | Upload fichiers multipart |
| Zod | 3.x | Validation des données entrantes |
| Axios | 1.x | Appels HTTP vers dyper-ai |
| dotenv | 16.x | Variables d'environnement |
| cors | 2.x | Headers CORS |
| helmet | 7.x | Sécurité HTTP headers |
| morgan | 1.x | Logging HTTP |
| express-rate-limit | 7.x | Rate limiting |
| uuid | 9.x | Génération des requestId |

### 4.2 Structure complète des fichiers

```
dyper-api/
├── src/
│   ├── index.js                    # Point d'entrée — création et démarrage du serveur
│   ├── app.js                      # Configuration Express (middlewares, routes)
│   │
│   ├── config/
│   │   └── index.js                # Centralisation de toutes les variables d'env
│   │
│   ├── routes/
│   │   ├── index.js                # Registre de toutes les routes
│   │   ├── analyze.js              # Routes POST /analyze, /analyze/url, /analyze/prompt
│   │   └── health.js               # Route GET /health
│   │
│   ├── middleware/
│   │   ├── upload.js               # Configuration Multer (types, taille, stockage)
│   │   ├── validate.js             # Middleware de validation Zod
│   │   ├── errorHandler.js         # Gestionnaire global d'erreurs Express
│   │   └── rateLimiter.js          # Configuration express-rate-limit
│   │
│   ├── services/
│   │   └── aiService.js            # Communication avec dyper-ai (POST /process)
│   │
│   ├── validators/
│   │   ├── analyzeFile.schema.js   # Schéma Zod pour upload fichier
│   │   ├── analyzeUrl.schema.js    # Schéma Zod pour URL
│   │   └── analyzePrompt.schema.js # Schéma Zod pour prompt seul
│   │
│   └── utils/
│       ├── fileToBase64.js         # Conversion buffer → base64
│       ├── logger.js               # Wrapper logger (Morgan + console structuré)
│       └── errors.js               # Classes d'erreurs custom (AppError, ValidationError...)
│
├── .env                            # Variables locales (non commité)
├── .env.example                    # Template des variables requises
├── .gitignore
└── package.json
```

### 4.3 Détail de chaque fichier

#### `src/index.js`
Point d'entrée. Importe `app.js`, démarre le serveur sur le port configuré, gère les erreurs non attrapées (`unhandledRejection`, `uncaughtException`).

```js
// Responsabilités :
// - process.env.PORT
// - app.listen()
// - process.on('unhandledRejection', ...)
// - process.on('uncaughtException', ...)
```

#### `src/app.js`
Configuration Express. Applique les middlewares globaux dans l'ordre suivant :
1. `helmet()` — headers de sécurité
2. `cors({ origin: process.env.ALLOWED_ORIGINS })` — CORS
3. `express.json({ limit: '1mb' })` — body JSON
4. `morgan('combined')` — logging HTTP
5. `rateLimiter` — limitation de requêtes
6. Routes (`/`, `/analyze`, `/health`)
7. `errorHandler` — gestionnaire d'erreurs (doit être le dernier middleware)

#### `src/config/index.js`
Centralise toutes les variables d'environnement avec valeurs par défaut :

```js
module.exports = {
  port: process.env.PORT || 3000,
  aiServiceUrl: process.env.AI_SERVICE_URL || 'http://localhost:8000',
  aiInternalKey: process.env.AI_INTERNAL_KEY || '',
  allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'],
  maxFileSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB || '10'),
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4'],
  requestTimeoutMs: parseInt(process.env.REQUEST_TIMEOUT_MS || '30000'),
}
```

#### `src/middleware/upload.js`
Configure Multer pour :
- Stocker le fichier en **mémoire** (`memoryStorage`) → pas de fichier tmp sur disque
- Limiter la taille à `maxFileSizeMb` Mo
- Filtrer par MIME type (rejeter tout ce qui n'est pas image/vidéo)

```js
// Multer config :
// storage  : multer.memoryStorage()
// limits   : { fileSize: config.maxFileSizeMb * 1024 * 1024 }
// fileFilter: vérifier req.file.mimetype contre config.allowedMimeTypes
```

#### `src/middleware/validate.js`
Factory de middleware Zod. Prend un schéma Zod en paramètre, valide `req.body` ou `req.query`, appelle `next(error)` si invalide.

```js
// Usage dans les routes :
// router.post('/analyze/url', validate(analyzeUrlSchema), analyzeUrlController)
```

#### `src/middleware/errorHandler.js`
Gestionnaire d'erreurs Express à 4 paramètres `(err, req, res, next)`. Transforme toutes les erreurs en réponse JSON standardisée :

```js
// Si err instanceof AppError → utilise err.code et err.statusCode
// Si err.type === 'entity.too.large' → FILE_TOO_LARGE
// Sinon → INTERNAL_ERROR (500)
// Toujours logguer l'erreur
```

#### `src/services/aiService.js`
Seul fichier qui connaît l'existence de `dyper-ai`. Responsabilités :
- Construire le payload `{ requestId, type, imageBase64, prompt, lang }`
- Appeler `POST http://dyper-ai:8000/process` avec Axios
- Timeout de `config.requestTimeoutMs` ms
- Propager les erreurs réseau en `AppError` lisible

```js
// export async function processWithAI({ requestId, fileBuffer, mimetype, imageUrl, prompt, lang })
// → retourne le body de la réponse dyper-ai
```

#### `src/routes/analyze.js`

Trois contrôleurs :

**`analyzeFile`** — `POST /analyze`
1. Vérifier que `req.file` existe (Multer l'a peuplé)
2. Valider `req.body.prompt` (Zod, optionnel)
3. Convertir `req.file.buffer` en base64 via `fileToBase64`
4. Appeler `aiService.processWithAI(...)`
5. Retourner la réponse formatée

**`analyzeUrl`** — `POST /analyze/url`
1. Valider `req.body.url` (Zod, doit être une URL valide)
2. Appeler `aiService.processWithAI({ imageUrl: req.body.url, ... })`
3. Retourner la réponse formatée

**`analyzePrompt`** — `POST /analyze/prompt`
1. Valider `req.body.prompt` (Zod, obligatoire)
2. Appeler `aiService.processWithAI({ type: 'prompt', prompt: req.body.prompt, ... })`
3. Retourner la réponse formatée

#### `src/utils/errors.js`

```js
class AppError extends Error {
  constructor(message, code, statusCode = 500, details = {}) {
    super(message)
    this.code = code          // ex: "FILE_TOO_LARGE"
    this.statusCode = statusCode
    this.details = details
  }
}

// Codes d'erreur définis :
// FILE_TOO_LARGE        → 413
// INVALID_FILE_TYPE     → 415
// VALIDATION_ERROR      → 400
// AI_SERVICE_UNAVAILABLE→ 503
// AI_PROCESSING_ERROR   → 422
// INTERNAL_ERROR        → 500
// RATE_LIMIT_EXCEEDED   → 429
```

### 4.4 Variables d'environnement

```bash
# .env.example

PORT=3000
AI_SERVICE_URL=http://localhost:8000
AI_INTERNAL_KEY=supersecretkey123
ALLOWED_ORIGINS=http://localhost:5173,https://dyper.app
MAX_FILE_SIZE_MB=10
REQUEST_TIMEOUT_MS=30000
```

### 4.5 package.json — dépendances

```json
{
  "scripts": {
    "dev":   "nodemon src/index.js",
    "start": "node src/index.js"
  },
  "dependencies": {
    "axios": "^1.7.0",
    "cors": "^2.8.5",
    "dotenv": "^16.4.0",
    "express": "^4.19.0",
    "express-rate-limit": "^7.2.0",
    "helmet": "^7.1.0",
    "morgan": "^1.10.0",
    "multer": "^1.4.5",
    "uuid": "^9.0.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "nodemon": "^3.1.0"
  }
}
```

### 4.6 Codes de statut HTTP utilisés

| Code | Cas |
|---|---|
| 200 | Succès |
| 400 | Validation échouée (prompt invalide, champ manquant) |
| 413 | Fichier trop volumineux |
| 415 | Type MIME non supporté |
| 422 | L'IA n'a pas pu traiter le contenu |
| 429 | Rate limit dépassé |
| 500 | Erreur interne |
| 503 | dyper-ai injoignable |

---

## 5. dyper-ai — Microservice Python

### 5.1 Stack technique

| Outil | Version | Usage |
|---|---|---|
| Python | 3.11+ | Runtime |
| FastAPI | 0.111+ | Framework HTTP async |
| Pydantic | 2.x | Validation et sérialisation |
| Uvicorn | 0.29+ | Serveur ASGI |
| **ultralytics** | 8.x | Chargement et inférence des modèles YOLO `.pt` |
| Pillow | 10.x | Décodage base64, manipulation d'images, couleurs dominantes |
| OpenCV (cv2) | 4.x | Extraction de frames vidéo, pré-traitement numpy |
| python-dotenv | 1.x | Variables d'environnement |

> **Moteur IA** : deux modèles YOLO custom entraînés sur COCO (80 classes) sont embarqués localement.
> - `model/yolo26l.pt` — variante **large** : bon équilibre vitesse/précision, utilisée par défaut
> - `model/yolo26x.pt` — variante **extra-large** : précision maximale, légèrement plus lente
>
> Le modèle est chargé **une seule fois au démarrage** du service (lifespan FastAPI) et reste en mémoire pour toutes les requêtes suivantes.
>
> YOLO retourne des bounding boxes + labels + scores de confiance. La **description textuelle** est générée localement à partir des détections via un système de templates (pas d'appel externe).

### 5.2 Classes COCO (80 classes)

Les modèles reconnaissent les 80 classes standard du dataset COCO, regroupées par catégorie :

| Catégorie | Classes |
|---|---|
| Personnes | person |
| Véhicules | bicycle, car, motorcycle, airplane, bus, train, truck, boat |
| Extérieur | traffic light, fire hydrant, stop sign, parking meter, bench |
| Animaux | bird, cat, dog, horse, sheep, cow, elephant, bear, zebra, giraffe |
| Accessoires | backpack, umbrella, handbag, tie, suitcase |
| Sports | frisbee, skis, snowboard, sports ball, kite, baseball bat, baseball glove, skateboard, surfboard, tennis racket |
| Cuisine | bottle, wine glass, cup, fork, knife, spoon, bowl |
| Nourriture | banana, apple, sandwich, orange, broccoli, carrot, hot dog, pizza, donut, cake |
| Intérieur | chair, couch, potted plant, bed, dining table, toilet |
| Électronique | tv, laptop, mouse, remote, keyboard, cell phone |
| Électroménager | microwave, oven, toaster, sink, refrigerator |
| Divers | book, clock, vase, scissors, teddy bear, hair drier, toothbrush |

### 5.3 Structure complète des fichiers

```
dyper-ai/
├── app/
│   ├── main.py                     # Point d'entrée FastAPI, lifespan (chargement modèle)
│   ├── config.py                   # Settings Pydantic (lecture des variables d'env)
│   │
│   ├── routes/
│   │   ├── __init__.py
│   │   ├── process.py              # Route POST /process
│   │   └── health.py               # Route GET /health
│   │
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── request.py              # Pydantic model — corps de la requête /process
│   │   └── response.py             # Pydantic model — corps de la réponse
│   │
│   ├── services/
│   │   ├── __init__.py
│   │   ├── yolo_runner.py          # Chargement du modèle YOLO + inférence
│   │   ├── detector.py             # Orchestrateur : appelle yolo_runner, formate résultats
│   │   ├── scene.py                # Inférence de scène à partir des objets détectés
│   │   ├── description.py          # Génération de la description textuelle (templates)
│   │   └── video.py                # Extraction de frames depuis une vidéo (cv2)
│   │
│   └── utils/
│       ├── __init__.py
│       ├── image.py                # Décodage base64, resize, couleurs dominantes (Pillow)
│       ├── auth.py                 # Vérification X-Internal-Key
│       └── logger.py               # Configuration logging structuré
│
├── tests/
│   ├── conftest.py                 # Fixtures pytest partagées (runner, client)
│   ├── fixtures/                   # Images de test committées dans le repo (≤ 100 Ko chacune)
│   │   ├── office.jpg              # Image libre de droits : laptop, keyboard, cup
│   │   ├── street.jpg              # Image libre de droits : car, person, traffic light
│   │   ├── kitchen.jpg             # Image libre de droits : microwave, sink, bottle
│   │   ├── animals.jpg             # Image libre de droits : dog, cat, bird
│   │   ├── sports.jpg              # Image libre de droits : sports ball, person
│   │   ├── blank.jpg               # Généré programmatiquement : Image.new("RGB", (100,100), "white")
│   │   └── expected/               # Sorties attendues pour les tests de régression
│   │       ├── office_objects.json
│   │       ├── street_scene.json
│   │       └── kitchen_scene.json
│   ├── unit/
│   │   ├── test_image_utils.py
│   │   ├── test_scene.py
│   │   ├── test_description.py
│   │   └── test_auth.py
│   └── regression/
│       ├── test_pipeline_image.py
│       ├── test_pipeline_scenes.py
│       ├── test_pipeline_video.py
│       └── test_routes.py
│
├── requirements.txt                # Dépendances de production
├── requirements-dev.txt            # Dépendances de test uniquement
├── pyproject.toml                  # Configuration pytest + marqueurs
├── .env
├── .env.example
└── .gitignore
```

> Les modèles `.pt` se trouvent dans `model/` à la racine du monorepo (`../model/` depuis `dyper-ai/`). Le chemin exact est configurable via `YOLO_MODEL_PATH` dans `.env`.
>
> **Fixtures de test** : les images dans `tests/fixtures/` doivent être des images libres de droits (Unsplash, Pexels, ou générées synthétiquement) de taille ≤ 100 Ko. `blank.jpg` est généré par un script `tests/fixtures/generate_blank.py` pour éviter un fichier binaire inutile. Les fichiers `expected/*.json` sont générés une première fois avec le modèle de référence, puis versionnés pour détecter toute régression.

### 5.4 Détail de chaque fichier

#### `app/main.py`

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.services.yolo_runner import YoloRunner
from app.routes import process, health

runner: YoloRunner = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Chargement du modèle au démarrage (une seule fois)
    global runner
    runner = YoloRunner()
    runner.load()
    app.state.runner = runner
    yield
    # Libération des ressources à l'arrêt

app = FastAPI(title="dyper-ai", version="1.0.0", lifespan=lifespan)
app.include_router(process.router)
app.include_router(health.router)
```

#### `app/config.py`

Lit les variables d'environnement via Pydantic `BaseSettings` — la seule source de vérité pour la config du service :

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PORT: int = 8000
    AI_INTERNAL_KEY: str
    YOLO_MODEL_VARIANT: str = "yolo26l"   # "yolo26l" | "yolo26x"
    YOLO_MODEL_PATH: str = "../model"
    YOLO_CONF_THRESHOLD: float = 0.25

    class Config:
        env_file = ".env"

settings = Settings()
# Import : from app.config import settings
```


#### `app/schemas/request.py`

```python
from pydantic import BaseModel, HttpUrl
from typing import Literal, Optional

class ProcessRequest(BaseModel):
    requestId: str
    type: Literal["image", "video", "prompt"]
    imageBase64: Optional[str] = None   # image encodée base64
    imageUrl: Optional[str] = None      # URL publique
    videoBase64: Optional[str] = None   # vidéo encodée base64
    prompt: Optional[str] = None        # contexte textuel libre
    lang: str = "fr"
```

#### `app/schemas/response.py`

```python
from pydantic import BaseModel
from typing import List, Optional

class BoundingBox(BaseModel):
    x: float   # coordonnée X coin supérieur gauche (pixels)
    y: float   # coordonnée Y coin supérieur gauche (pixels)
    w: float   # largeur (pixels)
    h: float   # hauteur (pixels)

class DetectedObject(BaseModel):
    label: str
    confidence: float          # 0.0 → 1.0
    boundingBox: Optional[BoundingBox] = None

class Scene(BaseModel):
    label: str                 # ex: "bureau", "rue", "cuisine"
    confidence: float
    indoor: Optional[bool] = None

class Visualization(BaseModel):
    objects: List[DetectedObject]
    scene: Scene
    colors: List[str]          # hex #RRGGBB, couleurs dominantes (Pillow quantize)
    text: List[str]            # réservé OCR — toujours [] en v1
    tags: List[str]            # labels uniques des objets détectés

class ProcessResponse(BaseModel):
    requestId: str
    description: str           # phrase naturelle générée par templates
    visualization: Visualization
    model: str                 # "yolo26l" ou "yolo26x"
    processingTimeMs: int
```

#### `app/services/yolo_runner.py`

Responsable du chargement et de l'inférence YOLO :

```python
from ultralytics import YOLO
from PIL import Image
from app.config import settings

class YoloRunner:
    def __init__(self):
        self.model = None
        self.model_name = settings.YOLO_MODEL_VARIANT   # "yolo26l" ou "yolo26x"

    def load(self):
        path = f"{settings.YOLO_MODEL_PATH}/{self.model_name}.pt"
        self.model = YOLO(path)
        # Le modèle est maintenant en mémoire, prêt pour l'inférence

    def predict(self, image: Image.Image, conf_threshold: float = 0.25):
        """
        Lance l'inférence sur une image PIL.
        Retourne les résultats bruts ultralytics (Results object).
        conf_threshold : score minimum pour inclure une détection
        """
        results = self.model.predict(
            source=image,
            conf=conf_threshold,
            verbose=False
        )
        return results[0]   # une seule image → results[0]
```

#### `app/services/detector.py`

Orchestre le pipeline complet pour une image :

```python
# detect(image: PIL.Image.Image, runner: YoloRunner, prompt: str | None, lang: str)
# → ProcessResponse
#
# Étapes :
# 1. runner.predict(image) → résultats bruts YOLO
# 2. Extraire les boîtes : results.boxes → liste de DetectedObject
#    - results.boxes.xyxy   → coordonnées [x1, y1, x2, y2]
#    - results.boxes.conf   → scores de confiance
#    - results.boxes.cls    → indices de classes
#    - results.names        → dict {index: "label"}
#    - Conversion xyxy → {x, y, w, h} : w = x2-x1, h = y2-y1
# 3. scene.infer_scene(detected_objects) → Scene
# 4. image.get_dominant_colors(image, n=3) → List[str]
# 5. description.generate(detected_objects, scene, prompt, lang) → str
# 6. Construire les tags : labels uniques des détections
# 7. Retourner ProcessResponse
```

#### `app/services/scene.py`

Infère la scène à partir des classes d'objets détectés. Règles ordonnées par priorité (la première règle qui matche gagne) — couvre l'intégralité des 80 classes COCO :

```python
# Structure des règles :
# SCENE_RULES = [
#   {
#     "triggers"   : set de labels COCO qui déclenchent la règle (condition : intersection non vide)
#     "label_fr"   : label de scène en français
#     "label_en"   : label de scène en anglais
#     "indoor"     : True | False | None
#     "priority"   : int (plus faible = vérifié en premier)
#   },
#   ...
# ]
#
# Algorithme :
#   1. Trier les règles par priorité croissante
#   2. Pour chaque règle, calculer : matched = triggers ∩ set(detected_labels)
#   3. Si matched non vide → scène trouvée
#      confidence = moyenne des confidences des objets dans matched
#   4. Si aucune règle ne matche → "scène générale", confidence = 0.5
#
# ─────────────────────────────────────────────────────────────────
# RÈGLES (ordonnées par priorité — du plus spécifique au plus général)
# ─────────────────────────────────────────────────────────────────
#
# priorité 1 — Transports spécifiques
#   triggers : {"airplane"}
#   → "aéroport / zone aérienne", indoor = False
#
#   triggers : {"boat"}
#   → "port / étendue d'eau", indoor = False
#
#   triggers : {"train"}
#   → "gare / voie ferrée", indoor = False
#
# priorité 2 — Sports et loisirs outdoor
#   triggers : {"skis", "snowboard"}
#   → "domaine skiable / montagne enneigée", indoor = False
#
#   triggers : {"surfboard"}
#   → "plage / surf", indoor = False
#
#   triggers : {"sports ball", "baseball bat", "baseball glove", "tennis racket"}
#   → "terrain de sport", indoor = False
#
#   triggers : {"skateboard"}
#   → "espace urbain / skatepark", indoor = False
#
#   triggers : {"kite", "frisbee"}
#   → "espace ouvert / parc", indoor = False
#
# priorité 3 — Nature et animaux sauvages
#   triggers : {"elephant", "zebra", "giraffe", "bear"}
#   → "zoo / safari", indoor = False
#
#   triggers : {"horse", "cow", "sheep"}
#   → "campagne / ferme", indoor = False
#
#   triggers : {"bird", "cat", "dog"} (sans autres indices)
#   → "extérieur / jardin", indoor = False
#
# priorité 4 — Circulation et voirie
#   triggers : {"car", "truck", "bus", "motorcycle", "bicycle",
#               "traffic light", "stop sign", "parking meter", "fire hydrant"}
#   → "rue / circulation urbaine", indoor = False
#
# priorité 5 — Voyage et transit
#   triggers : {"suitcase", "backpack", "handbag"} + {"bench"}
#   → "gare / aéroport / zone d'attente", indoor = None
#
#   triggers : {"suitcase"} seul
#   → "voyage / déplacement", indoor = None
#
# priorité 6 — Pièces de la maison (spécifiques)
#   triggers : {"bed", "teddy bear"}
#   → "chambre à coucher", indoor = True
#
#   triggers : {"toilet", "toothbrush", "hair drier", "sink"}
#   → "salle de bain", indoor = True
#
#   triggers : {"microwave", "oven", "toaster", "refrigerator", "sink"}
#   → "cuisine", indoor = True
#
#   triggers : {"couch", "remote", "tv"}
#   → "salon / salle de séjour", indoor = True
#
# priorité 7 — Repas et gastronomie
#   triggers : {"dining table", "fork", "knife", "spoon", "bowl",
#               "wine glass", "bottle", "cup",
#               "pizza", "cake", "sandwich", "hot dog", "donut",
#               "banana", "apple", "orange", "broccoli", "carrot"}
#   → "repas / table à manger", indoor = True
#
# priorité 8 — Bureau et travail
#   triggers : {"laptop", "keyboard", "mouse", "book", "tie"}
#   → "bureau / espace de travail", indoor = True
#
# priorité 9 — Réunion / événement
#   triggers : {"wine glass", "bottle", "cake"}
#   → "célébration / fête", indoor = True
#
# priorité 10 — Espace public avec foule
#   triggers : {"person"} et count(person) >= 5
#   → "foule / espace public", indoor = None
#
#   triggers : {"person"} et count(person) in [2, 4]
#   → "scène de groupe", indoor = None
#
# priorité 11 — Générique intérieur
#   triggers : {"chair", "potted plant", "clock", "vase", "book",
#               "cell phone", "scissors", "toothbrush", "umbrella"}
#   → "intérieur / pièce de vie", indoor = True
#
# priorité 12 — Défaut
#   → "scène générale", confidence = 0.5, indoor = None
```

#### `app/services/description.py`

Génère une description textuelle en langage naturel à partir des détections. Deux responsabilités : la **traduction** des labels COCO (anglais → français) et la **génération** de phrases.

```python
# ─── Table de traduction COCO → Français (80 classes) ────────────────────────
#
# Chaque entrée : "label_coco": ("singulier_fr", "pluriel_fr")
#
COCO_FR = {
    # Personnes
    "person":          ("une personne",        "{n} personnes"),
    # Véhicules
    "bicycle":         ("un vélo",             "{n} vélos"),
    "car":             ("une voiture",          "{n} voitures"),
    "motorcycle":      ("une moto",             "{n} motos"),
    "airplane":        ("un avion",             "{n} avions"),
    "bus":             ("un bus",               "{n} bus"),
    "train":           ("un train",             "{n} trains"),
    "truck":           ("un camion",            "{n} camions"),
    "boat":            ("un bateau",            "{n} bateaux"),
    # Voirie
    "traffic light":   ("un feu de circulation","  {n} feux de circulation"),
    "fire hydrant":    ("une borne incendie",   "{n} bornes incendie"),
    "stop sign":       ("un panneau stop",      "{n} panneaux stop"),
    "parking meter":   ("un horodateur",        "{n} horodateurs"),
    "bench":           ("un banc",              "{n} bancs"),
    # Animaux
    "bird":            ("un oiseau",            "{n} oiseaux"),
    "cat":             ("un chat",              "{n} chats"),
    "dog":             ("un chien",             "{n} chiens"),
    "horse":           ("un cheval",            "{n} chevaux"),
    "sheep":           ("un mouton",            "{n} moutons"),
    "cow":             ("une vache",            "{n} vaches"),
    "elephant":        ("un éléphant",          "{n} éléphants"),
    "bear":            ("un ours",              "{n} ours"),
    "zebra":           ("un zèbre",             "{n} zèbres"),
    "giraffe":         ("une girafe",           "{n} girafes"),
    # Accessoires
    "backpack":        ("un sac à dos",         "{n} sacs à dos"),
    "umbrella":        ("un parapluie",         "{n} parapluies"),
    "handbag":         ("un sac à main",        "{n} sacs à main"),
    "tie":             ("une cravate",          "{n} cravates"),
    "suitcase":        ("une valise",           "{n} valises"),
    # Sports
    "frisbee":         ("un frisbee",           "{n} frisbees"),
    "skis":            ("une paire de skis",    "{n} paires de skis"),
    "snowboard":       ("un snowboard",         "{n} snowboards"),
    "sports ball":     ("un ballon de sport",   "{n} ballons de sport"),
    "kite":            ("un cerf-volant",       "{n} cerfs-volants"),
    "baseball bat":    ("une batte de baseball","  {n} battes de baseball"),
    "baseball glove":  ("un gant de baseball",  "{n} gants de baseball"),
    "skateboard":      ("un skateboard",        "{n} skateboards"),
    "surfboard":       ("une planche de surf",  "{n} planches de surf"),
    "tennis racket":   ("une raquette de tennis","  {n} raquettes de tennis"),
    # Ustensiles et boissons
    "bottle":          ("une bouteille",        "{n} bouteilles"),
    "wine glass":      ("un verre à vin",       "{n} verres à vin"),
    "cup":             ("une tasse",            "{n} tasses"),
    "fork":            ("une fourchette",       "{n} fourchettes"),
    "knife":           ("un couteau",           "{n} couteaux"),
    "spoon":           ("une cuillère",         "{n} cuillères"),
    "bowl":            ("un bol",               "{n} bols"),
    # Nourriture
    "banana":          ("une banane",           "{n} bananes"),
    "apple":           ("une pomme",            "{n} pommes"),
    "sandwich":        ("un sandwich",          "{n} sandwichs"),
    "orange":          ("une orange",           "{n} oranges"),
    "broccoli":        ("un brocoli",           "{n} brocolis"),
    "carrot":          ("une carotte",          "{n} carottes"),
    "hot dog":         ("un hot-dog",           "{n} hot-dogs"),
    "pizza":           ("une pizza",            "{n} pizzas"),
    "donut":           ("un beignet",           "{n} beignets"),
    "cake":            ("un gâteau",            "{n} gâteaux"),
    # Mobilier intérieur
    "chair":           ("une chaise",           "{n} chaises"),
    "couch":           ("un canapé",            "{n} canapés"),
    "potted plant":    ("une plante en pot",    "{n} plantes en pot"),
    "bed":             ("un lit",               "{n} lits"),
    "dining table":    ("une table",            "{n} tables"),
    "toilet":          ("des toilettes",        "{n} toilettes"),
    # Électronique
    "tv":              ("un téléviseur",        "{n} téléviseurs"),
    "laptop":          ("un ordinateur portable","  {n} ordinateurs portables"),
    "mouse":           ("une souris",           "{n} souris"),
    "remote":          ("une télécommande",     "{n} télécommandes"),
    "keyboard":        ("un clavier",           "{n} claviers"),
    "cell phone":      ("un téléphone portable","  {n} téléphones portables"),
    # Électroménager
    "microwave":       ("un micro-ondes",       "{n} micro-ondes"),
    "oven":            ("un four",              "{n} fours"),
    "toaster":         ("un grille-pain",       "{n} grille-pains"),
    "sink":            ("un évier",             "{n} éviers"),
    "refrigerator":    ("un réfrigérateur",     "{n} réfrigérateurs"),
    # Divers
    "book":            ("un livre",             "{n} livres"),
    "clock":           ("une horloge",          "{n} horloges"),
    "vase":            ("un vase",              "{n} vases"),
    "scissors":        ("des ciseaux",          "{n} paires de ciseaux"),
    "teddy bear":      ("un ours en peluche",   "{n} ours en peluche"),
    "hair drier":      ("un sèche-cheveux",     "{n} sèche-cheveux"),
    "toothbrush":      ("une brosse à dents",   "{n} brosses à dents"),
}
#
# ─── Génération de la description ────────────────────────────────────────────
#
# generate(objects, scene, prompt, lang) -> str
#
# 1. Compter les occurrences : Counter([obj.label for obj in objects])
#    ex: {"car": 2, "person": 1, "dog": 1}
#
# 2. Traduire chaque label selon lang :
#    lang="fr" → utiliser COCO_FR[label][0 si n=1, 1 si n>1].format(n=n)
#    lang="en" → utiliser le label COCO brut avec article ("a car", "2 cars")
#
# 3. Construire la liste en prose :
#    ["une voiture", "un chien"] → "une voiture et un chien"
#    ["2 voitures", "une personne", "un chien"] → "2 voitures, une personne et un chien"
#
# 4. Assembler avec le contexte de scène :
#    fr : "L'image montre {liste} dans un contexte de {scene.label_fr}."
#    en : "The image shows {liste} in a {scene.label_en} setting."
#
# 5. Si prompt fourni :
#    fr : "En réponse à « {prompt} » : l'image montre {liste}..."
#    en : "Regarding « {prompt} »: the image shows {liste}..."
#
# 6. Si aucun objet détecté (objects = []) mais prompt présent :
#    fr : "Aucun objet reconnu n'a été détecté. Concernant votre question « {prompt} » :
#          l'image ne contient pas d'éléments identifiables parmi les 80 classes supportées."
#
# 7. Si aucun objet et aucun prompt :
#    fr : "Aucun objet reconnu n'a été détecté dans cette image."
```

#### `app/services/video.py`

```python
# extract_frames(video_base64: str, n_frames: int = 5) -> list[PIL.Image.Image]
#
# 1. Décoder base64 → bytes → fichier temporaire (tempfile.NamedTemporaryFile)
# 2. cv2.VideoCapture(tmp_path)
# 3. Calculer les positions : [0, 25%, 50%, 75%, 100%] du total de frames
# 4. cap.set(cv2.CAP_PROP_POS_FRAMES, pos) → cap.read() → frame BGR
# 5. Convertir BGR → RGB → PIL.Image
# 6. Supprimer le fichier temporaire
# 7. Retourner la liste de frames PIL
```

#### `app/utils/image.py`

```python
# decode_base64(b64: str) -> PIL.Image.Image
#   base64.b64decode → BytesIO → Image.open()

# resize_for_model(img: PIL.Image.Image, max_size: int = 1280) -> PIL.Image.Image
#   Redimensionne en conservant le ratio si la dimension max dépasse max_size
#   YOLO gère nativement le resize interne mais le pré-resize économise de la mémoire

# get_dominant_colors(img: PIL.Image.Image, n: int = 3) -> list[str]
#   img.quantize(colors=n) → palette → convertir en hex #RRGGBB
#   Retourne les n couleurs les plus présentes triées par fréquence décroissante
```

### 5.5 Pipeline de traitement complet

```
Requête POST /process reçue
        │
        ├─ type = "image"
        │   ├── decode_base64(imageBase64) → PIL.Image
        │   │   ou fetch(imageUrl) → PIL.Image
        │   ├── resize_for_model(image, max_size=1280)
        │   ├── yolo_runner.predict(image)  ← inférence YOLO
        │   ├── extraire DetectedObjects (boxes + labels + conf)
        │   ├── scene.infer_scene(objects)
        │   ├── image.get_dominant_colors(image, n=3)
        │   ├── description.generate(objects, scene, prompt, lang)
        │   └── → ProcessResponse
        │
        ├─ type = "video"
        │   ├── video.extract_frames(videoBase64, n_frames=5)
        │   ├── pour chaque frame → pipeline image ci-dessus
        │   ├── agréger : fusionner les objets uniques, garder le meilleur score
        │   ├── scene la plus fréquente parmi les frames
        │   └── → ProcessResponse (description agrégée)
        │
        └─ type = "prompt"
            ├── Pas d'image → objects = [], scene = défaut
            ├── description.generate([], scene_default, prompt, lang)
            └── → ProcessResponse (description basée sur le prompt seul)
```

### 5.6 Variables d'environnement

```bash
# .env.example

PORT=8000
AI_INTERNAL_KEY=supersecretkey123

# Variante YOLO : "yolo26l" (défaut, rapide) ou "yolo26x" (précis)
YOLO_MODEL_VARIANT=yolo26l

# Chemin vers le dossier contenant les fichiers .pt
YOLO_MODEL_PATH=../model

# Score de confiance minimum (0.0 → 1.0), défaut 0.25
YOLO_CONF_THRESHOLD=0.25
```

### 5.7 requirements.txt

```
fastapi==0.111.0
uvicorn[standard]==0.29.0
pydantic==2.7.0
pydantic-settings==2.3.0
pillow==10.3.0
opencv-python-headless==4.9.0.80
ultralytics==8.2.0
python-dotenv==1.0.0
```

> `ultralytics` inclut PyTorch comme dépendance. Sur CPU uniquement, ajouter `torch torchvision --index-url https://download.pytorch.org/whl/cpu` pour alléger l'installation. Sur GPU (CUDA), PyTorch s'installe avec le support CUDA automatiquement via ultralytics.

---

## 6. dyper-web — Frontend React

### 6.1 Stack technique

| Outil | Version | Usage |
|---|---|---|
| React | 18.x | Framework UI |
| TypeScript | 5.x | Typage statique |
| Vite | 5.x | Bundler et dev server |
| TailwindCSS | 3.x | Styles utilitaires |
| react-dropzone | 14.x | Drag & drop de fichiers |
| axios | 1.x | Appels HTTP |
| clsx | 2.x | Classes CSS conditionnelles |
| framer-motion | 11.x | Animations (messages, loading) |

### 6.2 Structure complète des fichiers

```
dyper-web/
├── src/
│   │
│   ├── main.tsx                        # Point d'entrée React, montage dans #root
│   ├── App.tsx                         # Root component, layout principal
│   │
│   ├── types/
│   │   └── index.ts                    # Tous les types TypeScript du projet
│   │
│   ├── services/
│   │   └── api.ts                      # Fonctions d'appel à dyper-api
│   │
│   ├── hooks/
│   │   ├── useAnalyze.ts               # Hook principal : gestion appel API + état
│   │   ├── useChat.ts                  # Hook gestion historique des messages
│   │   └── useDrop.ts                  # Hook gestion drag & drop (wrapping react-dropzone)
│   │
│   ├── components/
│   │   │
│   │   ├── Chat/
│   │   │   ├── ChatWindow.tsx          # Conteneur principal du chat
│   │   │   ├── MessageList.tsx         # Liste scrollable des messages
│   │   │   ├── Message.tsx             # Un message (user ou bot)
│   │   │   ├── TypingIndicator.tsx     # Animation "..." pendant le chargement
│   │   │   └── InputBar/
│   │   │       ├── InputBar.tsx        # Barre de saisie complète
│   │   │       ├── TextInput.tsx       # Champ texte du prompt
│   │   │       ├── SendButton.tsx      # Bouton d'envoi
│   │   │       └── DropZone.tsx        # Zone de drag & drop intégrée à l'InputBar
│   │   │
│   │   ├── Result/
│   │   │   ├── ResultCard.tsx          # Carte de résultat d'une analyse (orchestrateur)
│   │   │   ├── ObjectList.tsx          # Liste des objets détectés avec confidence bars
│   │   │   ├── SceneBadge.tsx          # Badge scène (indoor/outdoor + label)
│   │   │   ├── TagCloud.tsx            # Nuage de tags
│   │   │   └── ColorPalette.tsx        # Palette des couleurs dominantes (swatches hex)
│   │   │
│   │   └── UI/
│   │       ├── Spinner.tsx             # Indicateur de chargement générique
│   │       ├── ErrorBanner.tsx         # Affichage d'erreur dans le chat
│   │       └── ImagePreview.tsx        # Prévisualisation de l'image uploadée
│   │
│   └── utils/
│       ├── formatters.ts               # Formatage des données (confiance → %, hex → couleur)
│       └── fileHelpers.ts              # Validation MIME, taille, conversion File → base64
│
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── .env
└── package.json
```

### 6.3 Détail des types TypeScript

#### `src/types/index.ts`

```typescript
// ─── Messages du chat ───────────────────────────────────────────────────────

export type MessageRole = 'user' | 'bot' | 'error'

export interface ChatMessage {
  id: string
  role: MessageRole
  timestamp: Date
  content: MessageContent
}

export type MessageContent =
  | UserTextContent
  | UserImageContent
  | BotResultContent
  | ErrorContent

export interface UserTextContent {
  type: 'text'
  text: string
}

export interface UserImageContent {
  type: 'image'
  text?: string
  file: File
  previewUrl: string  // URL.createObjectURL(file)
}

export interface BotResultContent {
  type: 'result'
  result: AnalysisResult
}

export interface ErrorContent {
  type: 'error'
  message: string
  code: string
}

// ─── Résultat d'analyse ──────────────────────────────────────────────────────

export interface AnalysisResult {
  description: string
  visualization: Visualization
  model: string
  lang: string
  processingTime: number
  requestId: string
}

export interface Visualization {
  objects: DetectedObject[]
  scene: Scene
  colors: string[]   // hex #RRGGBB
  text: string[]     // toujours [] en v1 (OCR réservé v2)
  tags: string[]
}

export interface DetectedObject {
  label: string
  confidence: number
  boundingBox?: BoundingBox
}

export interface BoundingBox {
  x: number
  y: number
  w: number
  h: number
}

export interface Scene {
  label: string
  confidence: number
  indoor?: boolean
}

// ─── État de l'application ───────────────────────────────────────────────────

export type AnalyzeStatus = 'idle' | 'loading' | 'success' | 'error'

export interface AnalyzeState {
  status: AnalyzeStatus
  error: string | null
}

// ─── API ─────────────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean
  requestId: string
  processingTime: number
  result?: T
  error?: ApiError
}

export interface ApiError {
  code: string
  message: string
  details?: Record<string, unknown>
}
```

### 6.4 Détail des composants

#### `App.tsx`
Layout principal. Structure en plein écran avec `ChatWindow` centré. Gère le thème (dark/light si implémenté ultérieurement).

```tsx
// Structure :
// <div className="h-screen flex flex-col bg-gray-950">
//   <Header />               // Logo "Dyper" + éventuellement un bouton settings
//   <ChatWindow />           // Flex-grow, prend tout l'espace disponible
// </div>
```

#### `components/Chat/ChatWindow.tsx`
Composant racine du chat. Orchestre les hooks :

```tsx
// Hooks utilisés :
// const { messages, addMessage } = useChat()
// const { status, error, analyze } = useAnalyze()
// const { isDragging } = useDrop({ onDrop: handleDrop })
//
// Rendu :
// <div className="flex flex-col h-full">
//   <MessageList messages={messages} loading={status === 'loading'} />
//   <InputBar onSend={handleSend} onDrop={handleDrop} isDragging={isDragging} />
// </div>
```

#### `components/Chat/InputBar/InputBar.tsx`
Composant de saisie. Combine :
- `DropZone` : la zone entière est cliquable pour ouvrir le sélecteur de fichiers ET accepte le drag & drop
- `ImagePreview` : affichage miniature de l'image en attente d'envoi
- `TextInput` : champ texte pour le prompt
- `SendButton` : désactivé si `status === 'loading'`

```tsx
interface InputBarProps {
  onSend: (text: string, file?: File) => void
  isDragging: boolean
  disabled: boolean
}
// État local :
// const [text, setText] = useState('')
// const [pendingFile, setPendingFile] = useState<File | null>(null)
// const [previewUrl, setPreviewUrl] = useState<string | null>(null)
//
// handleSend() :
//   1. Vérifier que text ou pendingFile est renseigné
//   2. Appeler onSend(text, pendingFile ?? undefined)
//   3. Reset text, pendingFile, previewUrl
```

#### `components/Chat/Message.tsx`

```tsx
// Si message.role === 'user' :
//   → MessageContent = UserTextContent : bulle avec texte simple
//   → MessageContent = UserImageContent : miniature + texte (optionnel)
//
// Si message.role === 'bot' :
//   → MessageContent = BotResultContent : <ResultCard result={...} />
//
// Si message.role === 'error' :
//   → <ErrorBanner message={...} />
//
// Chaque message affiche son timestamp formaté (ex: "14:32")
```

#### `components/Result/ResultCard.tsx`
Composant principal d'affichage du résultat. Sections rendues conditionnellement :
1. Description textuelle (paragraphe principal)
2. `<SceneBadge scene={visualization.scene} />`
3. `<ObjectList objects={visualization.objects} />` — si `objects.length > 0`
4. `<ColorPalette colors={visualization.colors} />` — si `colors.length > 0`
5. `<TagCloud tags={visualization.tags} />` — si `tags.length > 0`
6. Footer discret : nom du modèle + temps de traitement en ms

#### `components/Result/ObjectList.tsx`

```tsx
// Liste chaque objet détecté avec :
// - Label
// - Barre de progression (confidence × 100%)
// - Badge "XX%"
// Triés par confidence décroissante
```

### 6.5 Détail des hooks

#### `hooks/useChat.ts`

```typescript
// Gère l'historique des messages du chat

interface UseChatReturn {
  messages: ChatMessage[]
  addUserMessage: (content: UserTextContent | UserImageContent) => string  // retourne l'id
  addBotMessage: (result: AnalysisResult) => void
  addErrorMessage: (error: ApiError) => void
  clearChat: () => void
}

// Implémentation :
// const [messages, setMessages] = useState<ChatMessage[]>([])
// addXxxMessage() : crée un ChatMessage avec id = nanoid() (package nanoid), timestamp = new Date()
// Auto-scroll : useEffect sur messages.length → scrollRef.current?.scrollIntoView({ behavior: 'smooth' })
```

#### `hooks/useAnalyze.ts`

```typescript
// Hook principal : orchestre l'appel API

interface UseAnalyzeReturn {
  status: AnalyzeStatus
  analyze: (text?: string, file?: File) => Promise<void>
}

// Logique interne :
// 1. setStatus('loading')
// 2. Si file → api.analyzeFile(file, text)
//    Si text seul → api.analyzePrompt(text)
// 3. En cas de succès → setStatus('success'), appeler addBotMessage()
// 4. En cas d'erreur → setStatus('error'), appeler addErrorMessage()
// 5. setStatus('idle')
```

#### `hooks/useDrop.ts`

```typescript
// Wrapper autour de react-dropzone

interface UseDropOptions {
  onDrop: (file: File) => void
}

interface UseDropReturn {
  isDragging: boolean
  getRootProps: () => object
  getInputProps: () => object
}

// useDropzone config :
// accept : { 'image/*': [], 'video/mp4': [] }
// maxFiles: 1
// onDrop: ([file]) => { validateFile(file); options.onDrop(file) }
// onDragEnter/Leave : toggle isDragging
```

### 6.6 Service API

#### `services/api.ts`

```typescript
import axios from 'axios'
import type { ApiResponse, AnalysisResult } from '../types'

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 30_000,
})

// Intercepteur réponse : normalisation des erreurs
client.interceptors.response.use(
  (res) => res,
  (err) => {
    const apiError = err.response?.data?.error ?? {
      code: 'NETWORK_ERROR',
      message: 'Impossible de joindre le serveur.',
    }
    return Promise.reject(apiError)
  }
)

export async function analyzeFile(
  file: File,
  prompt?: string,
  lang = 'fr'
): Promise<AnalysisResult> {
  const form = new FormData()
  form.append('file', file)
  if (prompt) form.append('prompt', prompt)
  form.append('lang', lang)
  const { data } = await client.post<ApiResponse<AnalysisResult>>('/analyze', form)
  return data.result!
}

export async function analyzeUrl(
  url: string,
  prompt?: string,
  lang = 'fr'
): Promise<AnalysisResult> {
  const { data } = await client.post<ApiResponse<AnalysisResult>>('/analyze/url', { url, prompt, lang })
  return data.result!
}

export async function analyzePrompt(
  prompt: string,
  lang = 'fr'
): Promise<AnalysisResult> {
  const { data } = await client.post<ApiResponse<AnalysisResult>>('/analyze/prompt', { prompt, lang })
  return data.result!
}
```

### 6.7 Variables d'environnement

```bash
# .env
VITE_API_URL=http://localhost:3000
```

### 6.8 `vite.config.ts`

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // En dev, toutes les requêtes vers /analyze et /health
      // sont proxifiées vers dyper-api pour éviter les problèmes CORS
      '/analyze': { target: 'http://localhost:3000', changeOrigin: true },
      '/health':  { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
})
```

### 6.9 `package.json` — dépendances

```json
{
  "scripts": {
    "dev":     "vite",
    "build":   "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "axios": "^1.7.0",
    "clsx": "^2.1.0",
    "framer-motion": "^11.0.0",
    "nanoid": "^5.0.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-dropzone": "^14.2.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.4.0",
    "vite": "^5.2.0"
  }
}
```

---

## 7. Types et interfaces TypeScript partagés

Les types définis dans `dyper-web/src/types/index.ts` constituent le contrat de données côté client. Ils doivent rester synchronisés avec les schémas Pydantic de `dyper-ai` et les réponses formatées de `dyper-api`.

### Correspondances de types

| TypeScript (dyper-web) | Pydantic (dyper-ai) | JSON key (dyper-api) |
|---|---|---|
| `AnalysisResult` | `ProcessResponse` | `result` |
| `Visualization` | `Visualization` | `result.visualization` |
| `DetectedObject` | `DetectedObject` | `result.visualization.objects[]` |
| `Scene` | `Scene` | `result.visualization.scene` |
| `BoundingBox` | `BoundingBox` | `result.visualization.objects[].boundingBox` |

---

## 8. Gestion des erreurs

### 8.1 Stratégie globale

Les erreurs sont propagées de `dyper-ai` → `dyper-api` → `dyper-web` avec un format unifié. Chaque couche ajoute du contexte sans masquer l'origine.

### 8.2 Codes d'erreur complets

| Code | Émetteur | HTTP | Description |
|---|---|---|---|
| `VALIDATION_ERROR` | dyper-api | 400 | Champ manquant ou invalide |
| `FILE_TOO_LARGE` | dyper-api | 413 | Fichier > MAX_FILE_SIZE_MB |
| `INVALID_FILE_TYPE` | dyper-api | 415 | MIME type non supporté |
| `RATE_LIMIT_EXCEEDED` | dyper-api | 429 | Trop de requêtes |
| `AI_SERVICE_UNAVAILABLE` | dyper-api | 503 | dyper-ai injoignable |
| `AI_PROCESSING_ERROR` | dyper-ai | 422 | Le modèle n'a pas pu traiter |
| `AI_TIMEOUT` | dyper-api | 504 | dyper-ai a mis trop longtemps |
| `INTERNAL_ERROR` | tous | 500 | Erreur non anticipée |
| `NETWORK_ERROR` | dyper-web | — | Pas de connexion au serveur |

### 8.3 Affichage dans dyper-web

- Les erreurs `VALIDATION_ERROR` et `FILE_TOO_LARGE` s'affichent dans l'`InputBar` (inline, sous le champ)
- Les erreurs `AI_*` et `INTERNAL_ERROR` s'affichent comme un message `role: 'error'` dans le chat
- `NETWORK_ERROR` affiche un bandeau persistant en haut de l'interface

---

## 9. Sécurité

### 9.1 Communication interne (dyper-api ↔ dyper-ai)

- Header `X-Internal-Key` partagé via variable d'environnement (`AI_INTERNAL_KEY`)
- `dyper-ai` n'est **pas exposé publiquement** — uniquement accessible en réseau interne (Docker network ou localhost)
- Valider que `X-Internal-Key` est présent et correct dans chaque requête sur `dyper-ai`

### 9.2 dyper-api

- `helmet()` : X-Content-Type-Options, X-Frame-Options, HSTS, etc.
- `cors` avec liste blanche (`ALLOWED_ORIGINS`)
- Rate limiting : 60 requêtes / minute / IP par défaut
- Validation stricte de tous les inputs (Zod) avant de toucher à quoi que ce soit
- Multer limite la taille et le type MIME en amont
- Ne jamais exposer les stack traces en production (`NODE_ENV=production`)

### 9.3 dyper-web

- Pas de clé API ni secret dans le code frontend
- Les fichiers ne quittent pas le navigateur sous forme brute (FormData natif)
- `URL.createObjectURL` pour la prévisualisation, révoqué après envoi (`URL.revokeObjectURL`)
- Validation côté client (taille, MIME) avant envoi pour UX, mais jamais comme seule protection

### 9.4 Fichiers sensibles à ne jamais commiter

```
# .gitignore commun
.env
*.key
node_modules/
__pycache__/
.venv/
dist/
build/
uploads/        # si stockage local de fichiers
model/*.pt      # modèles YOLO — trop volumineux pour git, télécharger séparément
```

---

## 10. Tests

### 10.1 Stratégie globale

Deux niveaux de tests pour chaque module backend :

| Niveau | Objectif | Fréquence |
|---|---|---|
| **Unitaire** | Tester une fonction ou classe en isolation, avec mocks sur toutes les dépendances externes | À chaque commit |
| **Régression** | Vérifier que des scénarios complets connus continuent de produire les résultats attendus après modification | À chaque PR |

Les tests de régression utilisent des **fixtures fixes** (images, payloads JSON) dont les sorties attendues sont vérifiées précisément, garantissant qu'une modification du code ne change pas silencieusement le comportement.

---

### 10.2 dyper-api

**Framework** : Jest + Supertest

#### Structure

```
dyper-api/
└── tests/
    ├── fixtures/
    │   ├── image.jpg               # Image de test fixe (100×100px, JPEG)
    │   ├── large_file.bin          # Fichier > 10 Mo pour tester la limite
    │   └── mock_ai_response.json   # Réponse mock de dyper-ai
    │
    ├── unit/
    │   ├── utils/
    │   │   ├── fileToBase64.test.js    # Conversion buffer → base64
    │   │   └── errors.test.js          # Classes AppError (code, statusCode, message)
    │   ├── middleware/
    │   │   ├── validate.test.js        # Factory Zod : champs requis, types invalides
    │   │   └── upload.test.js          # Multer : taille, MIME type
    │   └── services/
    │       └── aiService.test.js       # Mock axios : succès, timeout, erreur réseau
    │
    └── regression/
        ├── routes.analyze.test.js      # Scénarios complets POST /analyze
        ├── routes.analyzeUrl.test.js   # Scénarios complets POST /analyze/url
        ├── routes.analyzePrompt.test.js# Scénarios complets POST /analyze/prompt
        └── routes.health.test.js       # GET /health avec dyper-ai ok et unreachable
```

#### Tests unitaires — détail

**`unit/utils/fileToBase64.test.js`**
```js
// ✓ Convertit un Buffer non vide en chaîne base64 valide
// ✓ La chaîne produite est décodable vers le buffer original
// ✓ Lève une erreur si le buffer est null ou undefined
```

**`unit/utils/errors.test.js`**
```js
// ✓ AppError avec code FILE_TOO_LARGE → statusCode 413
// ✓ AppError avec code VALIDATION_ERROR → statusCode 400
// ✓ AppError avec code INTERNAL_ERROR → statusCode 500
// ✓ AppError hérite de Error (instanceof Error = true)
// ✓ Le champ details est {} par défaut
```

**`unit/middleware/validate.test.js`**
```js
// ✓ Schéma URL valide → next() appelé sans erreur
// ✓ URL manquante → next(AppError) avec code VALIDATION_ERROR
// ✓ URL invalide (pas une URL) → next(AppError)
// ✓ Prompt > 1000 chars → next(AppError)
// ✓ Prompt vide sur route /prompt → next(AppError)
```

**`unit/middleware/upload.test.js`**
```js
// ✓ MIME image/jpeg → accepté
// ✓ MIME image/png → accepté
// ✓ MIME image/webp → accepté
// ✓ MIME video/mp4 → accepté
// ✓ MIME application/pdf → rejeté (INVALID_FILE_TYPE)
// ✓ MIME text/plain → rejeté
// ✓ Fichier > MAX_FILE_SIZE_MB → rejeté (FILE_TOO_LARGE)
```

**`unit/services/aiService.test.js`**
```js
// Mock axios.post avec jest.mock('axios')
//
// ✓ Appel réussi → retourne le body de la réponse dyper-ai
// ✓ Timeout axios → lève AppError AI_TIMEOUT
// ✓ Erreur réseau (ECONNREFUSED) → lève AppError AI_SERVICE_UNAVAILABLE
// ✓ Réponse HTTP 500 de dyper-ai → lève AppError AI_PROCESSING_ERROR
// ✓ Le header X-Internal-Key est bien envoyé dans la requête
// ✓ Le requestId est inclus dans le payload
```

#### Tests de régression — détail

**`regression/routes.analyze.test.js`**
```js
// Utilise Supertest sur l'app Express
// aiService mocké pour retourner mock_ai_response.json
//
// SUCCÈS :
// ✓ POST /analyze avec image.jpg + prompt
//   → HTTP 200, body.success = true
//   → body.result contient description, visualization, model, lang
//   → body.result.visualization contient objects[], scene, colors[], tags[]
//
// ✓ POST /analyze avec image.jpg sans prompt
//   → HTTP 200, body.result.lang = "fr" (défaut)
//
// ERREURS :
// ✓ POST /analyze sans fichier → HTTP 400, error.code = VALIDATION_ERROR
// ✓ POST /analyze avec fichier PDF → HTTP 415, error.code = INVALID_FILE_TYPE
// ✓ POST /analyze avec fichier > 10 Mo → HTTP 413, error.code = FILE_TOO_LARGE
// ✓ POST /analyze avec prompt > 1000 chars → HTTP 400
// ✓ aiService qui lève AI_SERVICE_UNAVAILABLE → HTTP 503 propagé au client
// ✓ aiService qui lève AI_TIMEOUT → HTTP 504 propagé au client
```

**`regression/routes.health.test.js`**
```js
// ✓ GET /health avec dyper-ai joignable
//   → HTTP 200, { status: "ok", ai: "ok", uptime: number }
//
// ✓ GET /health avec dyper-ai injoignable (mock axios timeout)
//   → HTTP 200, { status: "ok", ai: "unreachable" }
//   (le service lui-même est ok, c'est dyper-ai qui est down)
```

#### Configuration Jest

```json
// package.json
{
  "scripts": {
    "test":            "jest",
    "test:unit":       "jest tests/unit",
    "test:regression": "jest tests/regression",
    "test:coverage":   "jest --coverage"
  },
  "jest": {
    "testEnvironment": "node",
    "coverageThreshold": {
      "global": { "lines": 80, "functions": 80 }
    }
  },
  "devDependencies": {
    "jest": "^29.0.0",
    "supertest": "^6.3.0"
  }
}
```

---

### 10.3 dyper-ai

**Framework** : pytest + pytest-asyncio + httpx (ASGI test client)

#### Structure

```
dyper-ai/
└── tests/
    ├── fixtures/
    │   ├── office.jpg              # Image bureau : laptop, keyboard, cup, book
    │   ├── street.jpg              # Image rue : car, person, traffic light
    │   ├── kitchen.jpg             # Image cuisine : microwave, sink, bottle
    │   ├── animals.jpg             # Image animaux : dog, cat, bird
    │   ├── sports.jpg              # Image sport : sports ball, person
    │   ├── blank.jpg               # Image 1×1 blanche (cas limite : aucune détection)
    │   └── expected/
    │       ├── office_objects.json     # Objets attendus pour office.jpg
    │       ├── street_scene.json       # Scène attendue pour street.jpg
    │       └── kitchen_scene.json      # Scène attendue pour kitchen.jpg
    │
    ├── conftest.py                 # Fixtures pytest partagées (runner, client)
    │
    ├── unit/
    │   ├── test_image_utils.py     # decode_base64, resize, get_dominant_colors
    │   ├── test_scene.py           # infer_scene pour toutes les règles COCO
    │   ├── test_description.py     # generate() : tous les labels fr/en, cas limites
    │   └── test_auth.py            # verify_internal_key : clé valide, invalide, absente
    │
    └── regression/
        ├── test_pipeline_image.py  # Pipeline complet image → ProcessResponse
        ├── test_pipeline_scenes.py # Chaque catégorie de scène déclenchée correctement
        ├── test_pipeline_video.py  # Extraction frames + agrégation (vidéo courte .mp4)
        └── test_routes.py          # Routes FastAPI : /process et /health
```

#### `tests/conftest.py`

```python
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.yolo_runner import YoloRunner

@pytest.fixture(scope="session")
def yolo_runner():
    """Charge le modèle une seule fois pour toute la session de tests."""
    runner = YoloRunner()
    runner.load()
    return runner

@pytest.fixture(scope="session")
def client():
    """Client HTTP synchrone pour tester les routes FastAPI."""
    return TestClient(app)
```

#### Tests unitaires — détail

**`unit/test_image_utils.py`**
```python
# ✓ decode_base64(b64_valide) → PIL.Image.Image avec bon mode (RGB)
# ✓ decode_base64(chaîne_invalide) → lève ValueError
# ✓ decode_base64(chaîne_vide) → lève ValueError
# ✓ resize_for_model(img_800x600, max_size=1280) → inchangée (< max)
# ✓ resize_for_model(img_2000x1500, max_size=1280) → 1280x960 (ratio conservé)
# ✓ resize_for_model(img_carré_2000x2000, max_size=1280) → 1280x1280
# ✓ get_dominant_colors(img, n=3) → liste de 3 chaînes hex "#RRGGBB"
# ✓ get_dominant_colors(img_rouge_pur, n=1) → ["#FF0000"] ou proche
```

**`unit/test_scene.py`**
```python
# Tests pour chaque règle de scene.py
# Format : infer_scene([DetectedObject(label=..., confidence=0.9)]) → Scene
#
# ✓ {"airplane"} → label contient "aéroport", indoor = False
# ✓ {"boat"} → label contient "port", indoor = False
# ✓ {"train"} → label contient "gare", indoor = False
# ✓ {"skis"} → label contient "ski", indoor = False
# ✓ {"surfboard"} → label contient "plage", indoor = False
# ✓ {"tennis racket"} → label contient "sport", indoor = False
# ✓ {"skateboard"} → indoor = False
# ✓ {"kite"} → indoor = False
# ✓ {"elephant"} → label contient "zoo" ou "safari", indoor = False
# ✓ {"horse"} → label contient "campagne", indoor = False
# ✓ {"car", "traffic light"} → label contient "rue", indoor = False
# ✓ {"suitcase", "bench"} → indoor = None
# ✓ {"bed"} → label contient "chambre", indoor = True
# ✓ {"toilet"} → label contient "salle de bain", indoor = True
# ✓ {"microwave"} → label contient "cuisine", indoor = True
# ✓ {"couch", "remote"} → label contient "salon", indoor = True
# ✓ {"fork", "dining table"} → label contient "repas", indoor = True
# ✓ {"laptop", "keyboard"} → label contient "bureau", indoor = True
# ✓ {"wine glass", "cake"} → label contient "célébration", indoor = True
# ✓ 5 × {"person"} → label contient "foule", indoor = None
# ✓ 2 × {"person"} → label contient "groupe", indoor = None
# ✓ {} (vide) → "scène générale", confidence = 0.5
# ✓ La confidence de scène = moyenne des confidences des objets déclencheurs
# ✓ Priorité : {"airplane", "car"} → scène airplane (priorité 1 > 4)
```

**`unit/test_description.py`**
```python
# Tests de generate(objects, scene, prompt, lang)
#
# Traduction française :
# ✓ [person×1] → description contient "une personne"
# ✓ [person×3] → description contient "3 personnes"
# ✓ [car×1, dog×1] → description contient "une voiture" et "un chien"
# ✓ [car×2, person×1] → description contient "2 voitures" et "une personne"
# ✓ Liste de 3 éléments → format "X, Y et Z"
# ✓ Liste de 1 élément → pas de virgule ni "et"
# ✓ Label inconnu (hors COCO) → utilisé tel quel sans planter
#
# Traduction anglaise (lang="en") :
# ✓ [car×1] → "a car"
# ✓ [car×2] → "2 cars"
#
# Intégration de la scène :
# ✓ Description contient le label de scène
#
# Cas avec prompt :
# ✓ Prompt non vide → description commence par l'incorporation du prompt
#
# Cas limites :
# ✓ objects=[] sans prompt → "Aucun objet reconnu n'a été détecté dans cette image."
# ✓ objects=[] avec prompt → message spécifique mentionnant les 80 classes supportées
# ✓ Tous les 80 labels COCO peuvent être traduits sans KeyError
```

#### Tests de régression — détail

**`regression/test_pipeline_image.py`**
```python
# Utilise yolo_runner fixture (modèle réel chargé)
# Teste le pipeline complet : image → ProcessResponse
#
# ✓ office.jpg → ProcessResponse valide
#   - description non vide
#   - visualization.objects est une liste non vide
#   - chaque DetectedObject a label, confidence ∈ [0, 1], boundingBox
#   - visualization.scene.label non vide
#   - visualization.colors est une liste de 3 hex valides
#   - visualization.tags est non vide
#   - model = "yolo26l" (ou yolo26x selon config)
#   - processingTimeMs > 0
#
# ✓ blank.jpg (image blanche) → ProcessResponse valide
#   - objects = []
#   - description = "Aucun objet reconnu..."
#   - scene.label = "scène générale"
#   - colors non vide (couleurs extraites même sans objets)
#
# RÉGRESSION : résultats stables entre exécutions
# ✓ office.jpg → les mêmes labels principaux détectés à chaque run
#   (ex: "laptop" et "keyboard" toujours présents, conf > 0.5)
# ✓ street.jpg → "car" ou "person" toujours détecté
```

**`regression/test_pipeline_scenes.py`**
```python
# Vérifie que chaque catégorie de scène est correctement déclenchée
# sur les images de fixtures correspondantes
#
# ✓ street.jpg → scene.label contient "rue" ou "circulation"
#                scene.indoor = False
#
# ✓ kitchen.jpg → scene.label contient "cuisine"
#                 scene.indoor = True
#
# ✓ office.jpg → scene.label contient "bureau" ou "travail"
#                scene.indoor = True
#
# ✓ animals.jpg → scene.label contient "jardin" ou "extérieur" ou "zoo"
#
# RÉGRESSION : une modification des règles de scène ne doit pas
# inverser indoor/outdoor sur les fixtures connues
```

**`regression/test_routes.py`**
```python
# Utilise TestClient FastAPI (client fixture)
#
# POST /process — succès :
# ✓ Payload valide avec imageBase64 → HTTP 200, ProcessResponse valide
# ✓ Payload valide avec imageUrl → HTTP 200
# ✓ Payload type="prompt" sans image → HTTP 200
#
# POST /process — erreurs :
# ✓ Sans header X-Internal-Key → HTTP 403
# ✓ X-Internal-Key invalide → HTTP 403
# ✓ imageBase64 corrompue (pas du base64) → HTTP 422
# ✓ type="image" sans imageBase64 ni imageUrl → HTTP 422
#
# GET /health :
# ✓ → HTTP 200, { "status": "ok" }
#
# RÉGRESSION : le schéma de réponse ProcessResponse ne change pas
# ✓ Les champs requestId, description, visualization, model, processingTimeMs
#   sont toujours présents dans la réponse
```

#### Configuration pytest

```ini
# pyproject.toml
[tool.pytest.ini_options]
testpaths = ["tests"]
asyncio_mode = "auto"
markers = [
    "unit: tests unitaires rapides, sans dépendance externe",
    "regression: tests de régression, nécessitent le modèle YOLO"
]

# Lancer uniquement les tests unitaires (CI rapide) :
#   pytest -m unit
# Lancer les tests de régression (CI complet) :
#   pytest -m regression
# Lancer tout :
#   pytest
```

```
# requirements-dev.txt
pytest==8.2.0
pytest-asyncio==0.23.0
httpx==0.27.0
```

---

### 10.4 dyper-web

**Framework** : Vitest + React Testing Library

```
dyper-web/
└── src/
    └── __tests__/
        ├── hooks/
        │   ├── useChat.test.ts       # Ajout de messages, auto-scroll, clearChat
        │   └── useAnalyze.test.ts    # États loading/success/error, appels API mockés
        ├── components/
        │   ├── InputBar.test.tsx     # Saisie texte, drop fichier, envoi, reset
        │   └── ResultCard.test.tsx   # Rendu conditionnel sections, données mock
        └── services/
            └── api.test.ts           # Mock axios : analyzeFile, analyzeUrl, analyzePrompt
```

---

## 11. GitHub Actions — Workflows CI

Les workflows se trouvent dans `.github/workflows/` à la racine du monorepo. Chaque module a son propre fichier de workflow, déclenchés uniquement quand les fichiers du module concerné sont modifiés.

### 11.1 `.github/workflows/dyper-api.yml`

```yaml
name: CI — dyper-api

on:
  push:
    paths:
      - 'dyper-api/**'
      - '.github/workflows/dyper-api.yml'
  pull_request:
    paths:
      - 'dyper-api/**'
      - '.github/workflows/dyper-api.yml'

jobs:
  test:
    name: Tests Node.js
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js 20
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: dyper-api/package-lock.json

      - name: Install dependencies
        working-directory: dyper-api
        run: npm ci

      - name: Run unit tests
        working-directory: dyper-api
        run: npm run test:unit

      - name: Run regression tests
        working-directory: dyper-api
        run: npm run test:regression

      - name: Upload coverage report
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: dyper-api-coverage
          path: dyper-api/coverage/
          retention-days: 7
```

### 11.2 `.github/workflows/dyper-ai.yml`

```yaml
name: CI — dyper-ai

on:
  push:
    paths:
      - 'dyper-ai/**'
      - '.github/workflows/dyper-ai.yml'
  pull_request:
    paths:
      - 'dyper-ai/**'
      - '.github/workflows/dyper-ai.yml'

jobs:
  test-unit:
    name: Tests unitaires Python
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Python 3.11
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'
          cache: 'pip'
          cache-dependency-path: dyper-ai/requirements*.txt

      - name: Install CPU-only PyTorch
        run: pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu

      - name: Install dependencies
        working-directory: dyper-ai
        run: |
          pip install -r requirements.txt
          pip install -r requirements-dev.txt

      - name: Run unit tests
        working-directory: dyper-ai
        run: pytest -m unit -v

  test-regression:
    name: Tests de régression Python
    runs-on: ubuntu-latest
    needs: test-unit   # ne tourne que si les tests unitaires passent

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Python 3.11
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'
          cache: 'pip'
          cache-dependency-path: dyper-ai/requirements*.txt

      - name: Install CPU-only PyTorch
        run: pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu

      - name: Install dependencies
        working-directory: dyper-ai
        run: |
          pip install -r requirements.txt
          pip install -r requirements-dev.txt

      - name: Download YOLO models
        # Les modèles ne sont pas dans le repo git.
        # En CI, les télécharger depuis un stockage sécurisé (ex: GitHub Releases ou S3).
        # Ici : variable secrète MODEL_DOWNLOAD_URL définie dans les secrets du repo.
        working-directory: dyper-ai
        env:
          MODEL_DOWNLOAD_URL: ${{ secrets.MODEL_DOWNLOAD_URL }}
        run: |
          mkdir -p ../model
          curl -L "$MODEL_DOWNLOAD_URL/yolo26l.pt" -o ../model/yolo26l.pt
          curl -L "$MODEL_DOWNLOAD_URL/yolo26x.pt" -o ../model/yolo26x.pt

      - name: Run regression tests
        working-directory: dyper-ai
        env:
          YOLO_MODEL_PATH: ../model
          YOLO_MODEL_VARIANT: yolo26l
          AI_INTERNAL_KEY: ci_test_key
        run: pytest -m regression -v

      - name: Upload test report
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: dyper-ai-pytest-report
          path: dyper-ai/.pytest_cache/
          retention-days: 7
```

### 11.3 `.github/workflows/dyper-web.yml`

```yaml
name: CI — dyper-web

on:
  push:
    paths:
      - 'dyper-web/**'
      - '.github/workflows/dyper-web.yml'
  pull_request:
    paths:
      - 'dyper-web/**'
      - '.github/workflows/dyper-web.yml'

jobs:
  test:
    name: Tests et build React
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js 20
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: dyper-web/package-lock.json

      - name: Install dependencies
        working-directory: dyper-web
        run: npm ci

      - name: Run tests
        working-directory: dyper-web
        run: npm run test

      - name: TypeScript check
        working-directory: dyper-web
        run: npx tsc --noEmit

      - name: Build
        working-directory: dyper-web
        env:
          VITE_API_URL: http://localhost:3000
        run: npm run build

      - name: Upload build artifact
        uses: actions/upload-artifact@v4
        with:
          name: dyper-web-dist
          path: dyper-web/dist/
          retention-days: 3
```

### 11.4 Secrets GitHub requis

| Secret | Usage | Où le configurer |
|---|---|---|
| `MODEL_DOWNLOAD_URL` | URL de base pour télécharger les `.pt` en CI | Settings → Secrets → Actions |

> Les modèles `.pt` ne doivent **pas** être commités dans le repo git (trop volumineux). En production, les stocker dans GitHub Releases (assets), un bucket S3 privé, ou un registre OCI. Le secret `MODEL_DOWNLOAD_URL` pointe vers ce stockage.

### 11.5 Badges de statut (README)

```markdown
![dyper-api CI](https://github.com/<org>/dyper/actions/workflows/dyper-api.yml/badge.svg)
![dyper-ai CI](https://github.com/<org>/dyper/actions/workflows/dyper-ai.yml/badge.svg)
![dyper-web CI](https://github.com/<org>/dyper/actions/workflows/dyper-web.yml/badge.svg)
```

---

## 12. Déploiement

### 12.1 Développement local

```bash
# 1. dyper-ai (terminal 1)
cd dyper-ai
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate

# CPU uniquement (plus léger) :
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
# GPU CUDA (si dispo) : pip install torch torchvision

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
# → Le modèle yolo26l.pt est chargé au démarrage (quelques secondes)

# 2. dyper-api (terminal 2)
cd dyper-api
npm install
npm run dev                        # nodemon sur port 3000

# 3. dyper-web (terminal 3)
cd dyper-web
npm install
npm run dev                        # Vite sur port 5173
```

### 12.2 Docker (production)

Chaque module a son propre `Dockerfile`. Un `docker-compose.yml` à la racine orchestre les trois services.

#### `dyper-api/Dockerfile`

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src
EXPOSE 3000
CMD ["node", "src/index.js"]
```

#### `dyper-ai/Dockerfile`

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

#### `dyper-web/Dockerfile`

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
```

#### `docker-compose.yml` (racine)

```yaml
version: '3.9'

services:
  dyper-ai:
    build: ./dyper-ai
    env_file: ./dyper-ai/.env
    volumes:
      - ./model:/app/model:ro   # modèles YOLO montés en lecture seule
    environment:
      YOLO_MODEL_PATH: /app/model
    expose: ["8000"]
    networks: [internal]

  dyper-api:
    build: ./dyper-api
    env_file: ./dyper-api/.env
    environment:
      AI_SERVICE_URL: http://dyper-ai:8000
    ports: ["3000:3000"]
    networks: [internal, external]
    depends_on: [dyper-ai]

  dyper-web:
    build: ./dyper-web
    ports: ["80:80"]
    networks: [external]
    depends_on: [dyper-api]

networks:
  internal:   # dyper-ai n'est pas exposé
  external:   # dyper-api et dyper-web sont accessibles
```

> `dyper-ai` n'est exposé que sur le réseau interne Docker — inaccessible depuis l'extérieur.

---

## 13. Conventions de code

### 13.1 Nommage

| Contexte | Convention | Exemple |
|---|---|---|
| Fichiers JS/TS | camelCase | `aiService.js`, `useAnalyze.ts` |
| Composants React | PascalCase | `ResultCard.tsx`, `InputBar.tsx` |
| Fichiers Python | snake_case | `image.py`, `yolo_runner.py`, `scene.py` |
| Classes Python | PascalCase | `YoloRunner`, `ProcessResponse`, `Visualization` |
| Variables / fonctions | camelCase (JS/TS), snake_case (Python) | |
| Constantes | UPPER_SNAKE_CASE | `MAX_FILE_SIZE_MB` |
| Types TypeScript | PascalCase | `AnalysisResult`, `ChatMessage` |

### 13.2 Structure des commits

```
type(scope): description courte

Types : feat, fix, docs, style, refactor, test, chore
Scopes : api, ai, web, config, docker

Exemples :
feat(api): add /analyze/url endpoint
fix(ai): handle empty image buffer gracefully
refactor(web): extract ResultCard sub-components
```

### 13.3 Variables d'environnement — règles

- Toutes les variables sont documentées dans `.env.example`
- Les variables sensibles (clés API, secrets) ne sont **jamais** commitées
- En production, injectées par le système de déploiement (Docker secrets, CI/CD)
- Préfixe `VITE_` obligatoire pour les variables exposées au frontend

---

## 14. Roadmap

### v1.0 — MVP

- [x] Architecture 3 modules définie
- [x] Modèles YOLO custom (yolo26l / yolo26x, COCO 80 classes)
- [ ] `dyper-api` : routes `/analyze`, `/analyze/url`, `/analyze/prompt`, `/health`
- [ ] `dyper-ai` : inférence YOLO locale, 12 catégories de scène, traduction FR/EN des 80 classes
- [ ] `dyper-web` : chat + drag & drop + affichage résultat
- [ ] Docker Compose fonctionnel

### v1.1 — Améliorations UX

- [ ] Streaming de la réponse (Server-Sent Events) pour affichage progressif
- [ ] Historique de session persistant (localStorage)
- [ ] Copie de la description en un clic
- [ ] Mode sombre / clair

### v1.2 — Fonctionnalités avancées

- [ ] Support vidéo complet (extraction frames + analyse agrégée)
- [ ] Authentification par clé API (pour usage externe)
- [ ] Tableau de bord d'utilisation (requêtes, modèles, temps)
- [ ] Export des résultats (JSON, PDF)

### v2.0 — Scale

- [ ] Base de données (stockage historique des analyses)
- [ ] Système de queue (BullMQ / Celery) pour les analyses lourdes (vidéo)
- [ ] Support multi-modèles (choix du modèle par requête)
- [ ] SDK client TypeScript publié sur npm
