# Checklist de présentation — machine de démo (IA sur serveur GPU distant)

Procédure pour préparer la **machine de démo** à partir du dépôt GitHub, puis dérouler la démo
sans surprise. **Le modèle ne tourne plus en local** : `dyper-ai` est déployé sur un **serveur GPU
distant** (cf. [HOSTING.md](HOSTING.md) pour son déploiement). La machine de démo n'exécute donc
plus que **`dyper-api`** et **`dyper-web`** (Node) — ni Python, ni CUDA, ni poids de modèle à
installer en local.

> **Pré-requis côté serveur** : le serveur `dyper-ai` distant doit être **démarré et joignable**
> avant la démo. Vérifiable via le badge de santé de l'interface (IA vert) — voir §6.

---

## 1. Prérequis à installer si absents

| Outil | Version | Note |
|---|---|---|
| Node.js | **20 LTS** | nodejs.org — passerelle + frontend |
| Git | dernière | git-scm.com |

(Plus besoin de Python ni du pilote NVIDIA sur la machine de démo : l'inférence est distante.)

## 2. Cloner le projet

```powershell
git clone https://github.com/GTGpuke/Dyper-API.git
cd Dyper-API
```

## 3. Installer dyper-api et dyper-web (Node)

```powershell
cd dyper-api ; npm install
cd ..\dyper-web ; npm install
```

## 4. Fichiers .env

Copier chaque `.env.example` en `.env` (dans `dyper-api/` et `dyper-web/`), puis renseigner.
Ces fichiers **contiennent des clés** — à apporter par clé USB ou à recréer ici, jamais sur GitHub.

- **dyper-api/.env** :
  - **`AI_SERVICE_URL`** → URL du **serveur `dyper-ai` distant** (ex. `https://ai.votre-domaine.tld`).
    C'est LA variable qui pointe la passerelle vers l'IA hébergée.
  - **`AI_INTERNAL_KEY`** → **identique** à celle configurée sur le serveur `dyper-ai` distant
    (authentification interne passerelle ↔ IA).
  - `APP_KEY` + `JWT_SECRET` (chaînes aléatoires longues).
  - **`GROQ_API_KEY`** (console.groq.com) — utilisée par la passerelle pour le **chat de suivi**
    (les réponses conversationnelles). Indispensable pour des réponses riches.
- **dyper-web/.env** : `VITE_APP_KEY` (= `APP_KEY` de dyper-api), `VITE_API_URL` laissé vide
  (la passerelle est servie en local).

## 5. Démarrage local

Deux terminaux (la machine de démo n'exécute plus dyper-ai) :

```powershell
# 1 — dyper-api
cd dyper-api ; npm run dev

# 2 — dyper-web
cd dyper-web ; npm run dev
```

## 6. Vérification (la veille, obligatoire)

Ouvrir http://localhost:5173, se connecter au compte de démo, puis vérifier le **badge de santé**
en bas de la sidebar :

- **Base** vert → SQLite/passerelle OK.
- **IA** vert → le **serveur `dyper-ai` distant est joignable** via `AI_SERVICE_URL`. S'il est
  rouge : serveur distant éteint, mauvaise URL, ou `AI_INTERNAL_KEY` différente (cf. §4).

Puis dérouler la répétition générale :

1. **Créer le compte de démo** (le garder pour le jour J — les analyses restent en historique).
2. Analyser **une image** → description riche ET cadres alignés dessus.
3. Analyser **une vidéo** (< 5 min) → lecteur annoté, chronologie cliquable, transcription.
4. Coller **un lien YouTube** court → analyse complète.
5. Poser **une question de suivi** (« que voit-on à gauche ? ») → réponse fondée sur l'image.

---

## Le jour J

### Démarrage (10 min avant)
1. **Connexion internet requise** : l'inférence (serveur IA distant), la compréhension riche
   (vision Groq), la transcription, la musique et les liens YouTube passent par le réseau. Prévoir
   le **partage de connexion du téléphone en secours**.
2. S'assurer que le **serveur `dyper-ai` distant est démarré** (et, s'il est saturé, qu'aucune
   analyse lourde n'est déjà en cours).
3. Lancer les 2 terminaux locaux (dyper-api → dyper-web, commandes de l'étape 5).
4. Ouvrir http://localhost:5173, se connecter, vérifier le badge de santé (**Base + IA verts**).

### Temps d'analyse
Les durées dépendent du **serveur GPU distant** : calez votre discours sur vos mesures réelles, et
ajustez `AVG_ANALYSIS_SECONDS` (dyper-api) pour que l'estimation d'attente affichée colle. La barre
de progression et les étapes s'affichent pendant l'analyse — c'est un moment de narration, pas un
temps mort. Sous forte charge, l'interface annonce un **délai estimé avant démarrage** (file
d'attente de calcul).

### Plan B
| Problème | Conséquence | Réaction |
|---|---|---|
| Plus d'internet sur la machine de démo | L'IA distante et les APIs (Groq) sont injoignables → **aucune nouvelle analyse** | Partage de connexion du téléphone, ou démo sur les analyses déjà en **historique** |
| Serveur IA distant injoignable / éteint | Badge **IA rouge**, analyses en échec | Le redémarrer ; vérifier `AI_SERVICE_URL` et `AI_INTERNAL_KEY` ; en attendant, démo sur l'historique |
| Service saturé (plusieurs analyses) | Mise en file, délai annoncé à l'écran | Patienter (l'attente est affichée) ; lancer les analyses lourdes à l'avance |
| Un service local (api/web) plante | — | Relancer son terminal ; l'historique et les comptes sont persistés (SQLite) |

## Dépannage express

| Symptôme | Cause probable | Solution |
|---|---|---|
| Badge **IA rouge** / analyses qui échouent | Serveur distant éteint, `AI_SERVICE_URL` erronée, ou `AI_INTERNAL_KEY` ≠ serveur | Démarrer le serveur, corriger l'URL/la clé dans `dyper-api/.env`, relancer la passerelle |
| Descriptions « template » pauvres | `GROQ_API_KEY` vide/invalide dans `dyper-api/.env` (chat) | La renseigner, redémarrer dyper-api |
| 401 dans l'interface | `VITE_APP_KEY` ≠ `APP_KEY` | Les aligner, relancer dyper-web |
| Lenteur / file d'attente | Forte charge sur le serveur GPU distant | Voir le délai annoncé ; pré-lancer les analyses lourdes ; régler `MAX_CONCURRENT_ANALYSES` côté serveur |
