# syntax=docker/dockerfile:1
# Démo API Dyper (Vite/React) : build statique servi par nginx.
# Origine unique : l'app appelle /api et /health en relatif ; Caddy les proxifie vers dyper-api.

# --- Étape 1 : build du bundle statique --------------------------------------
FROM node:20-alpine AS build
WORKDIR /app

# VITE_APP_KEY est figée dans le bundle au build. DOIT correspondre à APP_KEY de dyper-api
# (sinon 401 sur /api/auth et /api/v1/me/api-keys).
ARG VITE_APP_KEY=
ENV VITE_APP_KEY=$VITE_APP_KEY

COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- Étape 2 : service statique via nginx ------------------------------------
FROM nginx:alpine AS production
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
