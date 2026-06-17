# Dyper — Démo API (détection temps réel)

Second frontend **minimal**, sur le même stack que `dyper-web` (**React + TypeScript + Vite**), qui
démontre l'usage de l'**API publique Dyper** :

1. **Génère une clé API** (connexion/inscription puis `POST /api/v1/me/api-keys`).
2. **Capture un vrai flux vidéo** (caméra ou partage d'écran), **enregistré** via `MediaRecorder`,
   tout en envoyant des frames à l'API (`Authorization: Bearer …`, `fast=true`) pour afficher les
   **boîtes de détection en temps réel** — sans aucune description textuelle pendant la capture.
3. **À l'arrêt**, la **vidéo enregistrée** est envoyée au **pipeline vidéo complet** (comme un envoi
   vidéo classique) pour une **description détaillée** de ce qui s'est passé, avec **relecture**.

> **Mode temps réel.** Tous les appels portent `realtime=true` : les frames ne sont **ni persistées ni
> décomptées du quota mensuel**, et l'endpoint d'analyse bénéficie d'une limite de débit relevée
> (`ANALYZE_RATE_LIMIT_MAX`, défaut 600/min). La cadence réelle dépend de la vitesse du moteur ; le
> résumé final nécessite une séquence ≤ 5 min.

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
