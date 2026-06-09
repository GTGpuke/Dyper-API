# dyper-ai — Moteur d'inférence visuelle (Python / FastAPI / YOLO)

Microservice interne d'inférence. Reçoit une image / vidéo / prompt, exécute le modèle YOLO local et retourne une analyse structurée (objets, scène localisée FR/EN, couleurs dominantes, description en langage naturel).

## Stack technique

| Domaine | Choix |
|---|---|
| Framework | **FastAPI** (async) |
| Validation | **Pydantic v2** |
| Inférence | **Ultralytics YOLO** (`.pt` locaux) |
| Images / Vidéo | **Pillow**, **OpenCV** |
| Lint / Format | **ruff** |
| Typage | **mypy** |
| Tests | **pytest** |

## Démarrage

```bash
python -m venv .venv && .venv\Scripts\activate    # (source .venv/bin/activate sous Unix)
pip install -r requirements.txt
cp .env.example .env                               # définir AI_INTERNAL_KEY
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Docs Swagger auto-générées : http://localhost:8000/docs.

## Modèle YOLO

Le fichier `.pt` correspondant à `YOLO_MODEL_VARIANT` (`yolo26l` par défaut) doit être présent dans `YOLO_MODEL_PATH` (`../model`). En son absence, le service **échoue au démarrage** avec un message explicite. Variantes : `yolo26l` (large) ou `yolo26x` (extra-large).

## Configuration

Voir [`.env.example`](.env.example). `AI_INTERNAL_KEY` est **requis** (clé partagée avec dyper-api, vérifiée en temps constant). Réglages : `YOLO_CONF_THRESHOLD`, `IMAGE_MAX_DIM`, `IMAGE_FETCH_TIMEOUT`, `VIDEO_FRAMES`.

## Qualité & tests

```bash
pip install -r requirements-dev.txt
ruff check app tests        # lint
ruff format --check app tests
mypy app                    # typage
python tests/fixtures/generate_blank.py
pytest                      # unit + régression
```

Le runner YOLO est **mocké** dans les tests : ils s'exécutent **sans fichier `.pt`** ni stack ML lourde (torch). Marqueurs : `unit` (isolés) et `regression`.

## Pipeline (`app/`)

```
main.py            # lifespan : chargement unique du modèle au démarrage
routes/process.py  # POST /process (image | video | prompt), gestion d'erreurs 422
routes/health.py   # GET /health
services/
  yolo_runner.py   # chargement + inférence (import ultralytics différé)
  detector.py      # orchestration : YOLO → scène → description
  scene.py         # inférence de scène (règles priorisées, labels FR/EN)
  description.py   # génération de description bilingue (table COCO_FR)
  video.py         # extraction de frames (OpenCV)
utils/             # image (decode/colors), auth (X-Internal-Key), logger JSON
schemas/           # ProcessRequest / ProcessResponse (Pydantic v2)
```

## Docker

```bash
docker build -t dyper-ai .
docker run -p 8000:8000 -e AI_INTERNAL_KEY=... -v $(pwd)/../model:/model:ro dyper-ai
```
