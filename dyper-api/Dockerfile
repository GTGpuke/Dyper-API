# syntax=docker/dockerfile:1
# --- Étape 1 : build TypeScript -------------------------------------------------
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# --- Étape 2 : image de production ---------------------------------------------
FROM node:20-alpine AS production
ENV NODE_ENV=production
WORKDIR /app

# Dépendances de production uniquement (sqlite3 compile ses bindings natifs).
COPY package*.json ./
RUN apk add --no-cache python3 make g++ \
  && npm ci --omit=dev \
  && apk del python3 make g++

COPY --from=build /app/dist ./dist

# Dossier de la base SQLite (volume recommandé en production).
RUN mkdir -p /app/data /app/logs
EXPOSE 3000
CMD ["node", "dist/server.js"]
