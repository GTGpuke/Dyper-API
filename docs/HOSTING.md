# Hébergement de Dyper — un domaine, trois services

> Document de référence pour mettre Dyper en ligne. Domaine d'exemple : **`dyper.app`**
> (remplacez-le partout par le vôtre). Toutes les commandes supposent un hôte Linux (Ubuntu 22.04+).

Dyper est composé de **trois services** qui se déploient derrière **un seul domaine** :

| Service     | Rôle                                              | Port interne | Exposé publiquement |
|-------------|---------------------------------------------------|--------------|---------------------|
| `dyper-web` | Interface React (SPA, fichiers statiques)         | 80 (nginx)   | Oui — `/`           |
| `dyper-api` | Passerelle Fastify (auth, quotas, file, données)  | 3000         | Oui — `/api`        |
| `dyper-ai`  | Moteur d'inférence FastAPI (YOLO + vision + audio)| 8000         | **Non — interne**   |

Principe directeur : **`dyper-ai` n'est jamais exposé à Internet**. Seule la passerelle l'appelle,
sur le réseau privé, avec la clé interne `AI_INTERNAL_KEY`. C'est la frontière de sécurité du système.

---

## 1. Topologie recommandée — origine unique (path-based)

Un **reverse proxy** en façade termine le TLS et route selon le chemin :

```
                          ┌──────────────────────────────────────────┐
   Navigateur  ──HTTPS──► │  Reverse proxy (Caddy / nginx) :443        │
   https://dyper.app      │   dyper.app                                │
                          │   ├─ /api/*  ──────────►  dyper-api  :3000 │
                          │   └─ /*      ──────────►  dyper-web  :80   │
                          └───────────────────────────────┬───────────┘
                                                           │ réseau privé
                                                           ▼
                                                     dyper-ai  :8000
                                              (interne, jamais public)
```

**Pourquoi l'origine unique (et non des sous-domaines) ?**

- **Cookies first-party** : le cookie de session httpOnly `dyper_token` est posé sur `dyper.app` et
  renvoyé automatiquement aux appels `/api` — pas de problème `SameSite`, pas de CORS cross-site.
- **Zéro CORS en production** : le front et l'API partagent l'origine `https://dyper.app`. Réglez
  alors `VITE_API_URL=""` (chemins relatifs) au build du front.
- **Un seul certificat TLS**, une seule entrée DNS.

> **Variante sous-domaines** (`app.dyper.app` + `api.dyper.app`) : possible, mais il faut alors
> configurer `CORS_ORIGIN=https://app.dyper.app`, `credentials: include` (déjà le cas) et des
> cookies `SameSite=None; Secure`. L'origine unique reste l'option la plus simple et la plus sûre.

### DNS

Un seul enregistrement suffit pour l'origine unique :

```
dyper.app.      A     <IP_DU_SERVEUR>
www.dyper.app.  CNAME dyper.app.
```

---

## 2. Reverse proxy + TLS

### Option A — Caddy (recommandée : TLS automatique Let's Encrypt)

`/etc/caddy/Caddyfile` :

```caddy
dyper.app {
    encode zstd gzip

    # API → passerelle Fastify. Le chemin /api est conservé (la passerelle l'attend).
    handle /api/* {
        reverse_proxy 127.0.0.1:3000
    }

    # Health check public de la passerelle (sans /api).
    handle /health {
        reverse_proxy 127.0.0.1:3000
    }

    # Tout le reste → SPA dyper-web.
    handle {
        reverse_proxy 127.0.0.1:8080   # dyper-web exposé en local sur 8080 (cf. §4)
    }
}
```

Caddy obtient et renouvelle le certificat seul. Rien d'autre à faire pour le TLS.

### Option B — nginx + certbot

```nginx
server {
    listen 443 ssl http2;
    server_name dyper.app;

    ssl_certificate     /etc/letsencrypt/live/dyper.app/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/dyper.app/privkey.pem;

    client_max_body_size 110m;            # cohérent avec MAX_VIDEO_SIZE_MB (100 Mo) + marge

    location /api/ { proxy_pass http://127.0.0.1:3000; proxy_set_header Host $host;
                     proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
                     proxy_set_header X-Forwarded-Proto $scheme;
                     proxy_read_timeout 920s; }   # > AI_VIDEO_TIMEOUT_MS (analyses vidéo longues)
    location /health { proxy_pass http://127.0.0.1:3000; }
    location /        { proxy_pass http://127.0.0.1:8080; }
}
server { listen 80; server_name dyper.app; return 301 https://$host$request_uri; }
```

> **Important** : `client_max_body_size` et `proxy_read_timeout` doivent dépasser respectivement la
> taille de vidéo autorisée et la durée d'analyse vidéo, sinon le proxy coupe les longues requêtes.

---

## 3. Modèle de capacité (un seul backend, pas de multi-instance)

Dyper est conçu pour tourner sur **une seule instance** de chaque service. Ce choix est assumé :

- **`dyper-ai`** s'appuie sur **un GPU local** et les **poids du modèle** chargés en mémoire.
  Multiplier les instances multiplierait le coût GPU sans bénéfice pour une démo.
- **`dyper-api`** persiste dans **SQLite** (fichier local) et stocke les **médias sur disque**.
  La **file d'attente** et le **sémaphore de capacité** (cf. `capacity.service.ts`) sont **en
  mémoire** : ils ne sont valables que dans un processus unique.

L'**allocation de capacité** garantit que chaque traitement dispose d'une part stable de calcul,
même sous forte charge :

- `MAX_CONCURRENT_ANALYSES` (défaut **2**) borne le nombre d'analyses simultanées envoyées à
  `dyper-ai`. Au-delà, les requêtes patientent dans une **file prioritaire** (forfaits payants
  d'abord). Réglez cette valeur selon la VRAM du GPU (cf. tableau ci-dessous).
- Les **quotas par forfait** (analyses/mois, minutes vidéo, taille de fichier) sont appliqués par
  la passerelle, indépendamment de la qualité d'analyse — **identique pour tous les forfaits**.

**Dimensionnement indicatif** (analyse vidéo, modèle `yolo26l` + vision + audio) :

| GPU                     | `MAX_CONCURRENT_ANALYSES` | Remarque                              |
|-------------------------|---------------------------|---------------------------------------|
| RTX 3050 (8 Go) — démo  | 1                         | Vidéos courtes ; ajuster les knobs ci-dessous |
| RTX 5070 Ti (16 Go)     | 2                         | Confort dev/prod légère               |
| L4 / A10 (24 Go)        | 3–4                       | Production                            |

> **Mise à l'échelle.** Pour aller au-delà d'un nœud, la voie est la **mise à l'échelle verticale**
> (GPU plus puissant, `MAX_CONCURRENT_ANALYSES` plus élevé). Une mise à l'échelle horizontale
> exigerait au préalable : base Postgres managée à la place de SQLite, stockage objet (S3) pour les
> médias, et une file partagée (Redis) à la place de la file en mémoire. Hors périmètre de cette V2.

**Knobs de performance côté `dyper-ai`** (variables d'environnement, sans toucher au code) :
`VIDEO_SAMPLE_FPS`, `VIDEO_MAX_FRAMES`, `OPEN_VOCAB_MAX`, `WORLD_IMGSZ`. Réduisez-les si le budget
de 5 min est dépassé sur un petit GPU.

---

## 4. Déploiement avec Docker Compose

Le dépôt fournit un [`docker-compose.yml`](../docker-compose.yml) prêt à l'emploi. En production,
exposez `dyper-web` en local (pas publiquement) pour que le reverse proxy le serve :

`docker-compose.prod.yml` (surcharge) :

```yaml
services:
  dyper-web:
    ports: ["127.0.0.1:8080:80"]      # le proxy de façade sert dyper.app
  dyper-api:
    ports: ["127.0.0.1:3000:3000"]    # jamais 0.0.0.0 en prod : le proxy gère le public
    environment:
      MAX_CONCURRENT_ANALYSES: "2"
  # dyper-ai n'expose AUCUN port : seul dyper-api l'atteint via le réseau Docker interne.
```

Lancement :

```bash
# 1. Poids du modèle (jamais commités) déposés dans ./model/yolo26l.pt
# 2. Variables d'environnement dans un fichier .env racine (cf. §5)
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

> **Build du front** : passez `VITE_API_URL=""` (origine unique) et `VITE_APP_KEY=$APP_KEY` en
> arguments de build pour que la SPA appelle `/api/v1` en relatif.

---

## 5. Secrets & variables d'environnement

| Variable             | Service    | Rôle                                                        |
|----------------------|------------|-------------------------------------------------------------|
| `APP_KEY`            | api + web  | Clé applicative `X-App-Key`. **Forte, aléatoire.**          |
| `JWT_SECRET`         | api        | Signature des sessions JWT. **Fort, aléatoire.**            |
| `AI_INTERNAL_KEY`    | api + ai   | Authentifie la passerelle auprès de `dyper-ai`.             |
| `CORS_ORIGIN`        | api        | `https://dyper.app` (ou vide en origine unique stricte).    |
| `GROQ_API_KEY`       | api + ai   | Compréhension multimodale & chat (optionnel).               |
| `AUDD_API_TOKEN`     | ai         | Reconnaissance musicale (optionnel).                        |
| `VITE_API_URL`       | web (build)| `""` en origine unique ; sinon `https://api.dyper.app`.     |
| `MAX_CONCURRENT_ANALYSES` | api   | Capacité simultanée (cf. §3).                               |

**Règles d'or :**

- Les fichiers `.env` et les poids `.pt` ne doivent **jamais** être commités (déjà gitignorés).
- Générez les secrets avec `openssl rand -hex 32`.
- Stockez-les comme **secrets GitHub Actions** pour le déploiement (cf. §7), jamais en clair.

---

## 6. Persistance & sauvegardes

| Donnée            | Emplacement (conteneur)      | Volume                | Sauvegarde            |
|-------------------|------------------------------|-----------------------|-----------------------|
| Base SQLite       | `/app/data/dyper.sqlite`     | `dyper-data`          | `sqlite3 .backup` quotidien |
| Médias (miniatures, vidéos) | `/app/data/uploads` | `dyper-data`          | inclus dans le volume |
| Poids du modèle   | `/model` (lecture seule)     | bind `./model`        | n/a (artefact)        |

Sauvegarde simple (cron) :

```bash
docker compose exec dyper-api sqlite3 /app/data/dyper.sqlite ".backup '/app/data/backup-$(date +%F).sqlite'"
```

---

## 7. CI/CD (GitHub Actions)

Le dépôt contient quatre workflows dans [`.github/workflows`](../.github/workflows) :

- `dyper-ai.yml`, `dyper-api.yml`, `dyper-web.yml` — **qualité par service** (lint, types, tests),
  exécutés sur chaque push touchant le service.
- `ci-deploy.yml` — **déploiement** : qualité agrégée puis déploiement `dev` (branche `dev`) et
  `prod` (branche `main`) par SSH + `docker compose`.

Les étapes de déploiement sont **gardées** : elles ne s'exécutent que si les secrets sont présents
(sinon elles sont ignorées, sans faire échouer la CI). Secrets à configurer dans
**Settings → Secrets and variables → Actions** :

| Secret               | Usage                                  |
|----------------------|----------------------------------------|
| `PROD_SERVER_HOST`   | IP/host du serveur de production       |
| `PROD_SERVER_USER`   | Utilisateur SSH                        |
| `PROD_SERVER_SSH_KEY`| Clé privée SSH (déploiement)           |
| `DEV_SERVER_HOST` / `DEV_SERVER_USER` / `DEV_SERVER_SSH_KEY` | idem pour le serveur de test |

Le serveur cible doit avoir : Docker + Docker Compose, le dépôt cloné dans `/opt/dyper`, le fichier
`.env` rempli et les poids du modèle dans `/opt/dyper/model`. Le déploiement exécute alors
`git pull` puis `docker compose up -d --build`.

---

## 8. Observabilité & santé

- **Health check** : `GET https://dyper.app/health` agrège l'état de la base et de `dyper-ai`.
  À brancher sur la sonde de l'hébergeur / un moniteur externe.
- **Traçabilité** : chaque réponse porte un en-tête `X-Request-Id` (réutilisé s'il est fourni, sinon
  généré) et propagé jusqu'à `dyper-ai` — corrélation des journaux de bout en bout.
- **Limitation de débit** : en-têtes `x-ratelimit-*` sur les réponses `/api` ; 429 au-delà.

---

## 9. Check-list de mise en ligne

- [ ] DNS `dyper.app` → IP du serveur.
- [ ] Reverse proxy (Caddy/nginx) configuré, TLS actif, `client_max_body_size`/timeouts ajustés.
- [ ] `.env` racine rempli (secrets forts), poids du modèle dans `./model`.
- [ ] `docker compose ... up -d --build` ; `GET /health` renvoie `ok`.
- [ ] `dyper-ai` **non** joignable depuis Internet (test depuis l'extérieur).
- [ ] `MAX_CONCURRENT_ANALYSES` ajusté au GPU.
- [ ] Secrets GitHub Actions configurés ; un push sur `main` déploie.
- [ ] Sauvegarde SQLite planifiée.
```
