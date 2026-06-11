# Dyper — Reconnaissance visuelle multimodale

Plateforme de reconnaissance visuelle basée sur YOLO. Accepte une image, une vidéo ou un prompt texte et retourne une description naturelle ainsi qu'une visualisation structurée des objets détectés (objets, scène, couleurs dominantes, tags). Un chat de suivi (LLM Groq) permet de poser des questions sur un résultat.

---

## Architecture

| Module | Technologie | Rôle | Port |
|---|---|---|---|
| `dyper-ai` | **Python / FastAPI / Ultralytics** | Pipeline « **décrire puis ancrer** » : le modèle vision (Llama 4 Scout via Groq) liste les éléments visibles, puis **YOLO-World** (vocabulaire ouvert, GPU) les localise — cadres alignés sur la description. Repli YOLO COCO sans clé. + Whisper (audio) et AudD (musique) | 8000 |
| `dyper-api` | **Fastify / TypeScript** (passerelle pro) | API publique + comptes + conversations + historique (SQLite) + médias | 3000 |
| `dyper-web` | **React / TypeScript / Vite / Tailwind** | SPA conversationnelle (chat façon claude.ai, streaming SSE), historique, dashboard, paramètres, docs API publiques (`/api-docs`), i18n FR/EN, mode sombre | 5173 |

**Stack qualité de la passerelle `dyper-api`** : Fastify 5, TypeScript strict, Sequelize (SQLite), Winston, Swagger (`/docs`), Biome (lint/format), Jest, PM2, Docker, CI GitHub Actions. Authentification frontend → passerelle par header **`X-App-Key`** ; passerelle → `dyper-ai` par header **`X-Internal-Key`**. **Comptes utilisateurs** : JWT en cookie httpOnly (bcrypt), données cloisonnées par utilisateur.

> Le flux complet, les contrats inter-services et les détails d'implémentation sont documentés dans [docs/docs.md](docs/docs.md).

---

## Démarrage rapide (Docker)

Prérequis : Docker + le modèle YOLO dans `./model` (voir [Modèles YOLO](#modèles-yolo)).

```bash
# À la racine, créer un .env avec au moins :
#   APP_KEY=$(openssl rand -hex 32)
#   JWT_SECRET=$(openssl rand -hex 32)
#   AI_INTERNAL_KEY=$(openssl rand -hex 32)
#   GROQ_API_KEY=...        # optionnel (chat)
docker compose up --build
```

- Frontend : http://localhost:5173
- API : http://localhost:3000 (Swagger en dev : http://localhost:3000/docs)

---

## Installation manuelle (développement)

Ouvrir **trois terminaux** depuis la racine.

### 1 — dyper-ai (microservice Python)

```bash
cd dyper-ai
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # Linux / macOS
pip install -r requirements.txt
cp .env.example .env            # éditer AI_INTERNAL_KEY, variante, etc.
# Windows PowerShell : Copy-Item .env.example .env
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload --reload-dir app
```
Service sur http://localhost:8000 (Swagger : `/docs`).

### 2 — dyper-api (passerelle Fastify)

```bash
cd dyper-api
npm install
cp .env.example .env            # APP_KEY, JWT_SECRET, AI_INTERNAL_KEY (= dyper-ai), CORS_ORIGIN…
# Windows PowerShell : Copy-Item .env.example .env
npm run dev
```
Passerelle sur http://localhost:3000 (Swagger : `/docs`).

### 3 — dyper-web (frontend React)

```bash
cd dyper-web
npm install
cp .env.example .env            # VITE_API_URL + VITE_APP_KEY (= APP_KEY de dyper-api)
# Windows PowerShell : Copy-Item .env.example .env
npm run dev
```
Interface sur http://localhost:5173.

---

## Prérequis

| Outil | Version | Note |
|---|---|---|
| Python | **3.11 / 3.12** | 3.14+ non supporté (wheels manquants) |
| Node.js | **20 LTS** | passerelle + frontend |

### Accélération GPU (fortement recommandée)

L'inférence (YOLO COCO, YOLO-World, tracking) utilise automatiquement le GPU NVIDIA dès que
torch-CUDA est installé dans le venv de `dyper-ai`. Utiliser **cu128** (compatible des GPU
Ampere comme la RTX 3050 jusqu'aux Blackwell comme les RTX 50xx) :

```bash
# Dans dyper-ai, venv activé (~3,3 Go de téléchargement) :
pip uninstall -y torch torchvision
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu128
```

Sur un GPU à VRAM limitée (ex. **RTX 3050**), conserver la variante maximale fonctionne (bascule
CPU automatique en cas de mémoire insuffisante) ; pour rester sur GPU, abaisser la variante :
`WORLD_MODEL_VARIANT=yolov8l-worldv2` dans `dyper-ai/.env`. Penser à **démarrer une première
fois avec internet** : YOLO-World (~400 Mo) se télécharge automatiquement au premier lancement.

> **Installation complète sur une nouvelle machine (jour de présentation) :** suivre la
> checklist pas à pas [docs/INSTALLATION-PRESENTATION.md](docs/INSTALLATION-PRESENTATION.md).

---

## Variables d'environnement

### dyper-ai — `.env`
| Variable | Défaut | Description |
|---|---|---|
| `AI_INTERNAL_KEY` | *(requis)* | Clé partagée avec dyper-api (`X-Internal-Key`) |
| `YOLO_MODEL_VARIANT` | `yolo26l` | `yolo26l` ou `yolo26x` |
| `YOLO_MODEL_PATH` | `../model` | Dossier des fichiers `.pt` |
| `YOLO_CONF_THRESHOLD` | `0.25` | Seuil de confiance minimum |
| `GROQ_API_KEY` | — | **Compréhension multimodale** : description riche par modèle vision (Llama 4 Scout) + transcription audio des vidéos (Whisper). Vide : repli sur la description locale |
| `AUDD_API_TOKEN` | — | **Reconnaissance musicale** des vidéos (type Shazam, jeton gratuit sur audd.io). Vide : désactivée |
| `VIDEO_MAX_DURATION_S` / `VIDEO_SAMPLE_FPS` / `VIDEO_MAX_FRAMES` | `300` / `3` / `900` | Garde de durée (5 min) et échantillonnage à cadence pleine sur toute la durée admise |

### dyper-api — `.env`
| Variable | Défaut | Description |
|---|---|---|
| `CORS_ORIGIN` | *(requis)* | Origines CORS (virgules) — le front dyper-web |
| `APP_KEY` | *(requis)* | Clé applicative attendue dans `X-App-Key` |
| `JWT_SECRET` | *(requis)* | Secret de signature des JWT d'authentification (`openssl rand -hex 32`) |
| `AI_SERVICE_URL` | *(requis)* | URL de dyper-ai |
| `AI_INTERNAL_KEY` | *(requis)* | Identique à celle de dyper-ai |
| `DB_STORAGE` | `./data/dyper.sqlite` | Fichier SQLite (comptes + conversations + historique) |
| `MEDIA_DIR` | `./data/uploads` | Dossier des miniatures d'analyses (servies par `/api/media`) |
| `GROQ_API_KEY` | — | Clé Groq (requise pour `/api/chat`) |
| `MAX_FILE_SIZE_MB` | `10` | Taille max upload |

### dyper-web — `.env`
| Variable | Défaut | Description |
|---|---|---|
| `VITE_API_URL` | *(vide en dev)* | URL de dyper-api. **Laisser vide en dev** → proxy Vite (cookie de session first-party) |
| `VITE_APP_KEY` | — | Clé `X-App-Key` (= `APP_KEY` de dyper-api) |

> **Important :** `AI_INTERNAL_KEY` doit être identique côté `dyper-ai` et `dyper-api`, et `VITE_APP_KEY` (web) doit valoir `APP_KEY` (api).
>
> **Comptes :** l'app est protégée par authentification (JWT en cookie httpOnly). Chaque utilisateur ne voit que ses propres analyses. En dev, la base SQLite est synchronisée sans migration destructive ; **après un changement de schéma, supprimer `dyper-api/data/dyper.sqlite`** pour la recréer.

---

## Endpoints principaux — dyper-api (port 3000)

Toutes les routes `/api/*` exigent le header `X-App-Key`. `/health` et `/docs` sont publics.

| Méthode | Route | Description |
|---|---|---|
| `POST` | `/api/analyze` | Analyse d'un fichier (multipart, champ `file`) |
| `POST` | `/api/analyze/url` | Analyse par URL : image, **vidéo YouTube ou clip Twitch** (téléchargement contrôlé) |
| `POST` | `/api/analyze/prompt` | Analyse d'un prompt texte seul |
| `POST` | `/api/chat` | Question de suivi (LLM Groq) |
| `GET/POST` | `/api/conversations` | Liste / création de conversations |
| `GET/PATCH/DELETE` | `/api/conversations/:id` | Fil de messages / renommage / suppression |
| `POST` | `/api/conversations/:id/messages` | Envoi d'un message (texte, fichier, URL d'image ou **lien YouTube / Twitch**) |
| `POST` | `/api/conversations/:id/messages/stream` | Question de suivi **streamée (SSE)** |
| `GET` | `/api/media/:requestId` | Miniature JPEG d'une analyse (**cookie seul**, sans X-App-Key — utilisable en `<img>`) |
| `GET` | `/api/media/:requestId/video` | Vidéo originale d'une analyse en **streaming HTTP Range** (cookie seul — lecteur annoté) |
| `GET` | `/api/analyses` | Historique paginé des analyses |
| `GET` | `/api/analyses/:id` | Détail d'une analyse |
| `GET` | `/api/analyses/:requestId/chat` | Échanges de chat d'une analyse |
| `GET` | `/health` | Statut passerelle + base + dyper-ai |

> Documentation interactive complète (exemples curl / JavaScript / Python) : page **`/api-docs`** du
> frontend (publique), et Swagger de la passerelle en dev (`/docs`).

---

## Qualité, tests et lint

```bash
# dyper-api (Fastify/TS)
cd dyper-api && npm run lint && npm run build && npm test

# dyper-ai (Python)
cd dyper-ai && ruff check app tests && mypy app && pytest

# dyper-web (React/TS)
cd dyper-web && npm run lint && npm run build
```

Les tests `dyper-ai` mockent le runner YOLO : ils tournent **sans fichier `.pt`**. La base de `dyper-api` utilise SQLite en mémoire en test.

---

## Modèles YOLO

Les fichiers `.pt` ne sont **pas versionnés** (trop volumineux). Les placer dans `model/` à la racine :

```
model/
├── yolo26l.pt    # variante large (défaut)
└── yolo26x.pt    # variante extra-large (optionnel)
```

Le service `dyper-ai` échoue au démarrage avec un message explicite si le fichier attendu est absent.

---

## CI / GitHub Actions

| Workflow | Fichier | Déclencheur |
|---|---|---|
| dyper-api — Qualité | `.github/workflows/dyper-api.yml` | `dyper-api/**` — Biome, audit, tests, build |
| dyper-ai — Qualité | `.github/workflows/dyper-ai.yml` | `dyper-ai/**` — ruff, mypy, pytest |
| dyper-web — Qualité | `.github/workflows/dyper-web.yml` | `dyper-web/**` — ESLint, build |
| Déploiement | `.github/workflows/ci-deploy.yml` | push `dev` / `main` (stubs) |
