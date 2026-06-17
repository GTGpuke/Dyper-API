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

# Index des wheels Torch. CPU par défaut (dev local et CI sans GPU) ; on bascule sur un index CUDA
# (ex. https://download.pytorch.org/whl/cu124 pour une L40S) via --build-arg en déploiement GPU
# (cf. docker-compose.gpu.yml). Installer Torch d'abord évite qu'ultralytics ne tire des wheels non voulus.
ARG TORCH_INDEX_URL=https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir torch torchvision --index-url ${TORCH_INDEX_URL}

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
