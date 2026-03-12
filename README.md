# Dyper — Reconnaissance visuelle multimodale

Plateforme de reconnaissance visuelle basée sur YOLO. Accepte une image, une vidéo ou un prompt texte et retourne une description naturelle ainsi qu'une visualisation structurée des objets détectés.

---

## Architecture

| Module | Technologie | Rôle | Port |
|---|---|---|---|
| `dyper-ai` | Python / FastAPI | Inférence YOLO locale | 8000 |
| `dyper-api` | Node.js / Express | Gateway API publique | 3000 |
| `dyper-web` | React / TypeScript / Vite | Interface chatbot | 5173 |

---

## Prérequis

### Versions requises

| Outil | Version minimale | Vérification |
|---|---|---|
| Python | **3.12** (recommandé) — 3.13 accepté, **3.14+ non supporté** | `python --version` |
| pip | 23 | `pip --version` |
| Node.js | 20 LTS | `node --version` |
| npm | 10 | `npm --version` |

### Installer Python 3.12

> Python 3.14+ n'est pas supporté : plusieurs dépendances (`pydantic-core`, `pillow`) n'ont pas de wheel précompilé pour cette version et nécessitent un compilateur Rust/C, ce qui fait échouer l'installation.

**Windows** — Télécharger Python 3.12 sur [python.org/downloads/release/python-3120](https://www.python.org/downloads/release/python-3120/).
Cocher "Add Python to PATH" lors de l'installation.

**macOS** (via Homebrew) :
```bash
brew install python@3.12
```

**Linux (Ubuntu/Debian)** :
```bash
sudo apt update && sudo apt install python3.12 python3.12-venv python3-pip
```

Vérifier l'installation :
```bash
python --version   # Python 3.12.x
pip --version      # pip 23.x
```

### Installer Node.js 20 LTS

**Windows / macOS** — Télécharger l'installeur LTS sur [nodejs.org](https://nodejs.org/).

**Linux (via nvm — recommandé)** :
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
nvm install 20
nvm use 20
```

Vérifier l'installation :
```bash
node --version   # v20.x.x
npm --version    # 10.x.x
```

### Modèles YOLO

Les fichiers `.pt` doivent être placés dans `model/` à la racine :
- `model/yolo26l.pt` — variante large (défaut)
- `model/yolo26x.pt` — variante extra-large (optionnel)

---

## Installation et démarrage

Ouvrir **trois terminaux** depuis la racine du projet.

### Étape 1 — dyper-ai (microservice Python)

```bash
cd dyper-ai

# Créer et activer un environnement virtuel
python -m venv .venv
#source .venv/bin/activate        # Linux / macOS
.venv\Scripts\activate         # Windows

# Installer les dépendances
pip install -r requirements.txt

# Configurer les variables d'environnement
cp .env.example .env
# Éditer .env si nécessaire (clé interne, variante du modèle, etc.)

# Démarrer le service
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Le service est disponible sur [http://localhost:8000](http://localhost:8000).
La documentation Swagger auto-générée est accessible sur [http://localhost:8000/docs](http://localhost:8000/docs).

---

### Étape 2 — dyper-api (gateway Express)

```bash
cd dyper-api

# Installer les dépendances
npm install

# Configurer les variables d'environnement
cp .env.example .env
# Éditer .env si nécessaire (clé interne partagée avec dyper-ai, origines CORS, etc.)

# Démarrer le serveur en mode développement
npm run dev
```

Le serveur est disponible sur [http://localhost:3000](http://localhost:3000).

---

### Étape 3 — dyper-web (frontend React)

```bash
cd dyper-web

# Installer les dépendances
npm install

# Configurer les variables d'environnement
cp .env.example .env
# VITE_API_URL doit pointer vers dyper-api (http://localhost:3000 par défaut)

# Démarrer le serveur de développement
npm run dev
```

L'interface est disponible sur [http://localhost:5173](http://localhost:5173).

---

## Variables d'environnement

### dyper-ai — `.env`

| Variable | Défaut | Description |
|---|---|---|
| `PORT` | `8000` | Port d'écoute du service |
| `AI_INTERNAL_KEY` | *(requis)* | Clé secrète partagée avec dyper-api |
| `YOLO_MODEL_VARIANT` | `yolo26l` | Variante du modèle : `yolo26l` ou `yolo26x` |
| `YOLO_MODEL_PATH` | `../model` | Chemin vers le dossier contenant les fichiers `.pt` |
| `YOLO_CONF_THRESHOLD` | `0.25` | Score de confiance minimum (0.0 → 1.0) |

### dyper-api — `.env`

| Variable | Défaut | Description |
|---|---|---|
| `PORT` | `3000` | Port d'écoute de la gateway |
| `AI_SERVICE_URL` | `http://localhost:8000` | URL du microservice dyper-ai |
| `AI_INTERNAL_KEY` | *(requis)* | Clé secrète partagée avec dyper-ai |
| `ALLOWED_ORIGINS` | `http://localhost:5173` | Origines CORS autorisées (séparées par des virgules) |
| `MAX_FILE_SIZE_MB` | `10` | Taille maximale des fichiers uploadés (Mo) |
| `REQUEST_TIMEOUT_MS` | `30000` | Timeout des appels vers dyper-ai (ms) |

### dyper-web — `.env`

| Variable | Défaut | Description |
|---|---|---|
| `VITE_API_URL` | `http://localhost:3000` | URL de base de dyper-api |

> **Important :** `AI_INTERNAL_KEY` doit être identique dans `dyper-ai/.env` et `dyper-api/.env`.

---

## Tests

### dyper-api — Tests Node.js (Jest + Supertest)

```bash
cd dyper-api

# Tous les tests
npm test

# Tests unitaires uniquement
npm run test:unit

# Tests de régression uniquement
npm run test:regression
```

### dyper-ai — Tests Python (pytest)

```bash
cd dyper-ai

# Activer l'environnement virtuel
source .venv/bin/activate   # Linux / macOS
# .venv\Scripts\activate    # Windows

# Installer les dépendances de développement (si pas encore fait)
pip install -r requirements-dev.txt

# Générer les fixtures de test (image blanche synthétique)
python tests/fixtures/generate_blank.py

# Tous les tests
pytest

# Tests unitaires uniquement
pytest tests/unit -m unit -v

# Tests de régression uniquement
pytest tests/regression -m regression -v
```

---

## Endpoints principaux

### dyper-api (port 3000)

| Méthode | Route | Description |
|---|---|---|
| `POST` | `/analyze` | Analyse d'un fichier uploadé (image ou vidéo) |
| `POST` | `/analyze/url` | Analyse d'une image par URL publique |
| `POST` | `/analyze/prompt` | Analyse d'un texte seul (sans image) |
| `GET` | `/health` | Statut de la gateway et de dyper-ai |

### dyper-ai (port 8000, accès interne uniquement)

| Méthode | Route | Description |
|---|---|---|
| `POST` | `/process` | Traitement IA d'une requête (image / vidéo / prompt) |
| `GET` | `/health` | Statut du microservice et du modèle chargé |

---

## Formats MIME acceptés

| Type | Extensions |
|---|---|
| Image | `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif` |
| Vidéo | `.mp4` |

Taille maximale : **10 Mo** (configurable via `MAX_FILE_SIZE_MB`).

---

## Modèles YOLO

Les fichiers `.pt` ne sont **pas versionnés** dans ce dépôt (trop volumineux). Ils doivent être placés manuellement dans le dossier `model/` à la racine :

```
model/
├── yolo26l.pt    # Variante large — vitesse/précision équilibrée (recommandé)
└── yolo26x.pt    # Variante extra-large — précision maximale
```

Le modèle utilisé est sélectionnable via `YOLO_MODEL_VARIANT` dans `.env` de dyper-ai.

---

## CI / GitHub Actions

Trois workflows indépendants se déclenchent automatiquement sur les modifications de chaque module :

| Workflow | Fichier | Déclencheur |
|---|---|---|
| dyper-api CI | `.github/workflows/dyper-api.yml` | Push / PR sur `dyper-api/**` |
| dyper-ai CI | `.github/workflows/dyper-ai.yml` | Push / PR sur `dyper-ai/**` |
| dyper-web CI | `.github/workflows/dyper-web.yml` | Push / PR sur `dyper-web/**` |
