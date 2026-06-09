# dyper-api — Passerelle API Dyper (Fastify / TypeScript)

Passerelle publique de la plateforme Dyper. Elle valide les requêtes, relaie l'inférence au microservice `dyper-ai`, expose un chat de suivi (Groq) et persiste l'historique des analyses dans SQLite.

## Stack technique

| Domaine | Choix |
|---|---|
| Framework HTTP | **Fastify 5** |
| Langage | **TypeScript** (strict) |
| ORM / Base | **Sequelize 6** + **SQLite** |
| Upload | `@fastify/multipart` |
| Sécurité | `@fastify/helmet`, `@fastify/cors`, `@fastify/rate-limit`, header `X-App-Key` |
| Docs API | `@fastify/swagger` + Swagger UI (`/docs`, dev uniquement) |
| Chat LLM | `groq-sdk` (Llama 3.1) |
| Logs | **Winston** |
| Lint / Format | **Biome** |
| Tests | **Jest** + `fastify.inject` |
| Process / Conteneur | **PM2**, **Docker** |

## Scripts

```bash
npm run dev          # développement (tsx watch)
npm run build        # compilation TypeScript → dist/
npm start            # exécution du build
npm run start:prod   # PM2 (production)
npm run lint         # Biome (lint + format check)
npm run lint:fix     # Biome avec corrections
npm test             # Jest
npm run test:coverage
```

## Architecture (`src/`)

```
src/
├── app.ts                 # buildApp() : factory Fastify, gestionnaire d'erreurs, plugins, routes
├── server.ts              # bootstrap : modèles, DB, signaux, listen
├── controllers/           # logique métier (analyze, chat, analysis)
├── routes/                # définitions de routes schema-first (validation + Swagger)
├── middlewares/           # verifyAppKey (X-App-Key)
├── models/                # Analysis, ChatExchange (Sequelize) + associations
├── services/
│   ├── env.service.ts     # configuration centralisée (fail-fast)
│   ├── logger.service.ts  # Winston
│   ├── db/                # Sequelize (SQLite) + connectDatabase()
│   ├── ai/                # client HTTP vers dyper-ai
│   └── chat/              # client Groq
├── utils/                 # AppError (hiérarchie), fileToBase64
└── types/                 # types de domaine partagés
```

## Contrat de réponse

Succès : `{ success: true, requestId, processingTime, result: { description, visualization, model, lang } }`
Erreur : `{ success: false, requestId, error: { code, message, details } }`

## Sécurité

- **`X-App-Key`** (header) : exigé sur toutes les routes `/api/*` (middleware `verifyAppKey`). `/health` et `/docs` restent publics.
- **`X-Internal-Key`** : envoyé par la passerelle à `dyper-ai`.
- Rate limiting : `RATE_LIMIT_MAX` requêtes par `RATE_LIMIT_WINDOW` (défaut 60/min) sur `/api/*`.

## Variables d'environnement

Voir [`.env.example`](.env.example). Requises : `CORS_ORIGIN`, `APP_KEY`, `AI_SERVICE_URL`, `AI_INTERNAL_KEY`. `GROQ_API_KEY` est nécessaire pour `/api/chat`.

## Tests

`npm test` exécute les tests unitaires (`tests/unit`) et de régression (`tests/regression`). Les appels à `dyper-ai` sont mockés et la base SQLite est en mémoire (`:memory:`) — aucun service externe requis.

## Docker

```bash
docker build -t dyper-api .
docker run -p 3000:3000 --env-file .env -v $(pwd)/data:/app/data dyper-api
```
