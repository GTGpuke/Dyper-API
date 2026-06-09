# syntax=docker/dockerfile:1
# --- Étape 1 : build du bundle statique --------------------------------------
FROM node:20-alpine AS build
WORKDIR /app

# Les variables VITE_* sont injectées au build (valeurs figées dans le bundle).
ARG VITE_API_URL=http://localhost:3000
ARG VITE_APP_KEY=
ENV VITE_API_URL=$VITE_API_URL \
    VITE_APP_KEY=$VITE_APP_KEY

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
