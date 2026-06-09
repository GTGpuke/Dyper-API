# dyper-web — Interface chatbot Dyper (React / TypeScript / Vite)

Interface utilisateur de la plateforme Dyper : envoi d'image / URL / prompt (drag & drop), affichage du résultat structuré et chat de suivi.

## Stack technique

| Domaine | Choix |
|---|---|
| Framework | **React 18** |
| Build | **Vite 5** |
| Langage | **TypeScript** (strict) |
| Styles | **Tailwind CSS** |
| HTTP | **Axios** |
| Animations / Upload | framer-motion, react-dropzone |
| Lint | **ESLint 9** (flat config, typescript-eslint) |

## Scripts

```bash
npm run dev       # serveur de développement (port 5173, strict)
npm run build     # tsc -b && vite build
npm run lint      # ESLint
npm run preview   # prévisualisation du build
```

## Configuration

Copier [`.env.example`](.env.example) → `.env` :

| Variable | Description |
|---|---|
| `VITE_API_URL` | URL de la passerelle dyper-api (http://localhost:3000) |
| `VITE_APP_KEY` | Clé envoyée dans `X-App-Key` (doit valoir `APP_KEY` côté dyper-api) |

Le client API (`src/services/api.ts`) préfixe toutes les requêtes par `/api` et joint automatiquement le header `X-App-Key`.

## Structure (`src/`)

```
src/
├── App.tsx, main.tsx
├── components/   # Chat/, Result/, UI/
├── hooks/        # useAnalyze, useChat, useDrop
├── services/     # api.ts (appels à dyper-api)
├── types/        # types partagés (AnalysisResult, Visualization…)
└── utils/        # formatters, fileHelpers
```

## Docker

L'image construit le bundle puis le sert via nginx (avec fallback SPA). Les variables `VITE_*` sont figées au build (`--build-arg`).
