# syntax=docker/dockerfile:1
# Image du service d'inférence dyper-ai (Python / FastAPI / Ultralytics YOLO).
FROM python:3.11-slim

# Dépendances système : OpenCV (libGL, glib) + git (requis par pip pour `clip @ git+https://…`).
RUN apt-get update \
  && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 git \
  && rm -rf /var/lib/apt/lists/*

ENV PYTHONUNBUFFERED=1 \
    PORT=8000 \
    # Le modèle .pt est monté en volume (voir docker-compose.yml).
    YOLO_MODEL_PATH=/model

WORKDIR /app

# Torch CUDA (cu128) d'abord, pour exploiter le GPU (L40S — driver 580 / CUDA 13). Installer
# explicitement la wheel CUDA évite qu'ultralytics tire une variante non maîtrisée.
RUN pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cu128

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
