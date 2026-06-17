# Dyper — Démo API (détection temps réel)

Second frontend **minimal**, sur le même stack que `dyper-web` (**React + TypeScript + Vite**), qui
démontre l'usage de l'**API publique Dyper** :

1. **Génère une clé API** (connexion/inscription puis `POST /api/v1/me/api-keys`).
2. **Utilise cette clé** (`Authorization: Bearer …`) pour analyser en **temps réel** les images d'une
   **caméra** ou d'un **partage d'écran**, via `POST /api/v1/analyze`.
3. Affiche les boîtes de détection sur la vidéo et tient une **transcription cumulée** en dessous,
   pilotée par un bouton **Démarrer / Arrêter**.

> L'analyse temps réel envoie une frame à la fois (séquentiel, ≥ 1,2 s d'intervalle) pour rester sous
> la limite de débit globale de la passerelle (60 req/min). La cadence réelle dépend de la vitesse du moteur.

### Limites du forfait API « free »

Une clé fraîchement générée est en forfait API **free** : **100 requêtes/mois** (et 60 req/min global).
Une session de détection continue consomme donc vite ce quota — la démo **s'arrête proprement** quand
le quota mensuel est atteint (message explicite). Pour une démonstration soutenue en temps réel, utilise
une clé sur un forfait API supérieur.

## Prérequis

La passerelle **dyper-api** doit tourner sur `http://localhost:3000` (et `dyper-ai` derrière elle).
Les appels de la démo sont relayés par le **proxy Vite** vers `:3000` — donc même origine, **sans CORS**.

## Lancer

```bash
cd dyper-demo
npm install
npm run dev
# → http://localhost:5174
```

## Configuration

| Variable        | Rôle                                                      | Défaut (dev)                                   |
|-----------------|-----------------------------------------------------------|------------------------------------------------|
| `VITE_APP_KEY`  | En-tête `X-App-Key` exigé sur `/api/auth` et `/api/me`.   | `dev-appkey-0123456789abcdef0123456789abcdef`  |

Crée un `.env` local pour surcharger si ton `APP_KEY` de passerelle diffère :

```
VITE_APP_KEY=ta-cle-applicative
```

## Notes

- **HTTPS / localhost requis** pour la caméra et le partage d'écran (contexte sécurisé du navigateur).
- La clé API n'a besoin **ni** de cookie **ni** de `X-App-Key` : `Authorization: Bearer <clé>` suffit —
  c'est tout l'intérêt de la démo (prouver que la clé fonctionne seule).
- Tu peux aussi **coller une clé existante** plutôt que d'en générer une.
