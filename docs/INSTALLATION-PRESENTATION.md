# Checklist de présentation — installation et jour J (laptop RTX 3050)

Procédure complète pour installer Dyper sur la machine de présentation à partir du dépôt
GitHub, puis dérouler la démo sans surprise.

> **À faire LA VEILLE, avec une bonne connexion internet** (≈ 6 Go de téléchargements).
> Durée estimée : 45 minutes. Prévoir **≥ 15 Go d'espace disque libre**.

---

## 1. Prérequis à installer si absents

| Outil | Version | Note |
|---|---|---|
| Python | **3.11 ou 3.12** (pas 3.13+) | python.org — cocher « Add to PATH » |
| Node.js | **20 LTS** | nodejs.org |
| Git | dernière | git-scm.com |
| Pilote NVIDIA | récent (≥ 551) | GeForce Experience ou nvidia.com |

## 2. Cloner le projet

```powershell
git clone https://github.com/GTGpuke/Dyper-API.git
cd Dyper-API
```

## 3. Fichiers NON versionnés à apporter (clé USB depuis le PC fixe)

| Fichier | Source sur le PC fixe | Destination sur le laptop |
|---|---|---|
| `yolo26l.pt` (~50 Mo) | `model/` | `model/` |
| `yolov8x-worldv2.pt` (~140 Mo) | `model/` | `model/` — évite le re-téléchargement |
| `weights/clip/ViT-B-32.pt` (~340 Mo) | `dyper-ai/weights/clip/` | `dyper-ai/weights/clip/` — encodeur texte du vocabulaire ouvert, évite ~10 min de téléchargement |
| Les 3 fichiers `.env` | `dyper-ai/`, `dyper-api/`, `dyper-web/` | mêmes emplacements — **contiennent les clés API**, jamais sur GitHub |

Sans clé USB : les modèles se re-téléchargent automatiquement (YOLO-World) ou depuis leur
source (yolo26l), et les `.env` se recréent depuis les `.env.example` (étape 6).

## 4. dyper-ai (Python + GPU)

```powershell
cd dyper-ai
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt

# Accélération GPU — cu128 couvre la RTX 3050 (et les RTX 50xx) — ~3,3 Go :
pip uninstall -y torch torchvision
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu128

# Vérification OBLIGATOIRE (doit afficher « cuda: True ») :
python -c "import torch; print('cuda:', torch.cuda.is_available())"
```

## 5. dyper-api et dyper-web (Node)

```powershell
cd ..\dyper-api ; npm install
cd ..\dyper-web ; npm install
```

## 6. Fichiers .env (si non copiés par USB)

Copier chaque `.env.example` en `.env`, puis renseigner :

- **dyper-ai/.env** : `AI_INTERNAL_KEY` (chaîne au choix, identique à dyper-api),
  **`GROQ_API_KEY`** (console.groq.com — indispensable pour les descriptions riches),
  `AUDD_API_TOKEN` (optionnel — reconnaissance musicale, audd.io).
- **dyper-api/.env** : `APP_KEY` + `JWT_SECRET` (chaînes aléatoires longues),
  `AI_INTERNAL_KEY` (= dyper-ai), `GROQ_API_KEY` (la même).
- **dyper-web/.env** : `VITE_APP_KEY` (= `APP_KEY` de dyper-api), `VITE_API_URL` laissé vide.

## 7. Premier démarrage (AVEC internet — force les derniers téléchargements)

Trois terminaux :

```powershell
# 1 — dyper-ai (peut télécharger YOLO-World + l'encodeur CLIP au premier lancement)
cd dyper-ai ; .venv\Scripts\activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload --reload-dir app

# 2 — dyper-api
cd dyper-api ; npm run dev

# 3 — dyper-web
cd dyper-web ; npm run dev
```

## 8. Répétition générale (la veille, obligatoire)

Ouvrir http://localhost:5173 puis :

1. **Créer le compte de démo** (le garder pour le jour J — les analyses restent en historique).
2. Analyser **une image** → vérifier la description riche ET les cadres alignés dessus.
3. Analyser **une vidéo** (< 5 min) → lecteur annoté, chronologie cliquable, transcription.
4. Coller **un lien YouTube** court → analyse complète.
5. Poser **une question de suivi** (« que voit-on à gauche ? ») → réponse fondée sur l'image.

Cette répétition force tous les téléchargements de modèles — en particulier **l'encodeur CLIP
(~340 Mo) qui se télécharge à la PREMIÈRE ANALYSE** (pas au démarrage du serveur) si
`dyper-ai/weights/clip/ViT-B-32.pt` n'a pas été copié par USB. Le jour J, plus rien ne se
télécharge côté modèles.

---

## Le jour J

### Démarrage (10 min avant)
1. **Connexion internet requise** : la compréhension riche (vision Groq), la transcription,
   la musique et les liens YouTube passent par des APIs. Prévoir le **partage de connexion du
   téléphone en secours**.
2. Lancer les 3 terminaux (ordre : dyper-ai → dyper-api → dyper-web, commandes de l'étape 7).
3. Attendre dans le terminal dyper-ai : « Modèle yolo26l chargé » et « yolov8x-worldv2
   (vocabulaire ouvert) chargé ».
4. Ouvrir http://localhost:5173, se connecter au compte de démo, vérifier le badge de santé
   (Base + IA verts) en bas de la sidebar.

### Temps d'analyse à annoncer (RTX 3050)
| Média | Durée attendue |
|---|---|
| Image | ~3 à 8 s |
| Vidéo 30 s | ~30 à 60 s |
| Vidéo 2-3 min / lien YouTube | 1 à 3 min |

(La barre de progression et les étapes s'affichent pendant l'analyse — c'est un moment de
narration, pas un temps mort.)

### Plan B
| Problème | Conséquence | Réaction |
|---|---|---|
| Plus d'internet | Descriptions riches/audio/YouTube indisponibles ; **la détection locale COCO et le lecteur continuent de fonctionner** | Partage de connexion, ou démo sur les analyses déjà en historique |
| VRAM saturée (rare) | Bascule CPU automatique (plus lent, jamais bloquant) | Option : `WORLD_MODEL_VARIANT=yolov8l-worldv2` dans dyper-ai/.env + relancer |
| Un service plante | — | Relancer son terminal ; l'historique et les comptes sont persistés (SQLite) |

## Dépannage express

| Symptôme | Cause probable | Solution |
|---|---|---|
| dyper-ai crash au démarrage | `yolo26l.pt` absent | Le copier dans `model/` |
| Descriptions « template » pauvres | `GROQ_API_KEY` vide ou invalide | La renseigner dans LES DEUX .env, redémarrer |
| Cadres limités aux 80 objets COCO | YOLO-World pas chargé (voir log au démarrage) | Vérifier internet au 1er lancement, ou copier `yolov8x-worldv2.pt` dans `model/` |
| 401 dans l'interface | `VITE_APP_KEY` ≠ `APP_KEY` | Les aligner, relancer dyper-web |
| `cuda: False` | Pilote NVIDIA trop ancien | Mettre à jour le pilote |
