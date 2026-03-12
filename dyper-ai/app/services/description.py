"""Génération de descriptions textuelles en français et en anglais à partir des détections YOLO."""

from collections import Counter
from typing import List, Optional

from app.schemas.response import DetectedObject, Scene


# Table de traduction COCO vers le français (singulier, pluriel formaté).
COCO_FR: dict = {
    "person": ("une personne", "{n} personnes"),
    "bicycle": ("un vélo", "{n} vélos"),
    "car": ("une voiture", "{n} voitures"),
    "motorcycle": ("une moto", "{n} motos"),
    "airplane": ("un avion", "{n} avions"),
    "bus": ("un bus", "{n} bus"),
    "train": ("un train", "{n} trains"),
    "truck": ("un camion", "{n} camions"),
    "boat": ("un bateau", "{n} bateaux"),
    "traffic light": ("un feu de circulation", "{n} feux de circulation"),
    "fire hydrant": ("une borne incendie", "{n} bornes incendie"),
    "stop sign": ("un panneau stop", "{n} panneaux stop"),
    "parking meter": ("un horodateur", "{n} horodateurs"),
    "bench": ("un banc", "{n} bancs"),
    "bird": ("un oiseau", "{n} oiseaux"),
    "cat": ("un chat", "{n} chats"),
    "dog": ("un chien", "{n} chiens"),
    "horse": ("un cheval", "{n} chevaux"),
    "sheep": ("un mouton", "{n} moutons"),
    "cow": ("une vache", "{n} vaches"),
    "elephant": ("un éléphant", "{n} éléphants"),
    "bear": ("un ours", "{n} ours"),
    "zebra": ("un zèbre", "{n} zèbres"),
    "giraffe": ("une girafe", "{n} girafes"),
    "backpack": ("un sac à dos", "{n} sacs à dos"),
    "umbrella": ("un parapluie", "{n} parapluies"),
    "handbag": ("un sac à main", "{n} sacs à main"),
    "tie": ("une cravate", "{n} cravates"),
    "suitcase": ("une valise", "{n} valises"),
    "frisbee": ("un frisbee", "{n} frisbees"),
    "skis": ("une paire de skis", "{n} paires de skis"),
    "snowboard": ("un snowboard", "{n} snowboards"),
    "sports ball": ("un ballon de sport", "{n} ballons de sport"),
    "kite": ("un cerf-volant", "{n} cerfs-volants"),
    "baseball bat": ("une batte de baseball", "{n} battes de baseball"),
    "baseball glove": ("un gant de baseball", "{n} gants de baseball"),
    "skateboard": ("un skateboard", "{n} skateboards"),
    "surfboard": ("une planche de surf", "{n} planches de surf"),
    "tennis racket": ("une raquette de tennis", "{n} raquettes de tennis"),
    "bottle": ("une bouteille", "{n} bouteilles"),
    "wine glass": ("un verre à vin", "{n} verres à vin"),
    "cup": ("une tasse", "{n} tasses"),
    "fork": ("une fourchette", "{n} fourchettes"),
    "knife": ("un couteau", "{n} couteaux"),
    "spoon": ("une cuillère", "{n} cuillères"),
    "bowl": ("un bol", "{n} bols"),
    "banana": ("une banane", "{n} bananes"),
    "apple": ("une pomme", "{n} pommes"),
    "sandwich": ("un sandwich", "{n} sandwichs"),
    "orange": ("une orange", "{n} oranges"),
    "broccoli": ("un brocoli", "{n} brocolis"),
    "carrot": ("une carotte", "{n} carottes"),
    "hot dog": ("un hot-dog", "{n} hot-dogs"),
    "pizza": ("une pizza", "{n} pizzas"),
    "donut": ("un beignet", "{n} beignets"),
    "cake": ("un gâteau", "{n} gâteaux"),
    "chair": ("une chaise", "{n} chaises"),
    "couch": ("un canapé", "{n} canapés"),
    "potted plant": ("une plante en pot", "{n} plantes en pot"),
    "bed": ("un lit", "{n} lits"),
    "dining table": ("une table", "{n} tables"),
    "toilet": ("des toilettes", "{n} toilettes"),
    "tv": ("un téléviseur", "{n} téléviseurs"),
    "laptop": ("un ordinateur portable", "{n} ordinateurs portables"),
    "mouse": ("une souris", "{n} souris"),
    "remote": ("une télécommande", "{n} télécommandes"),
    "keyboard": ("un clavier", "{n} claviers"),
    "cell phone": ("un téléphone portable", "{n} téléphones portables"),
    "microwave": ("un micro-ondes", "{n} micro-ondes"),
    "oven": ("un four", "{n} fours"),
    "toaster": ("un grille-pain", "{n} grille-pains"),
    "sink": ("un évier", "{n} éviers"),
    "refrigerator": ("un réfrigérateur", "{n} réfrigérateurs"),
    "book": ("un livre", "{n} livres"),
    "clock": ("une horloge", "{n} horloges"),
    "vase": ("un vase", "{n} vases"),
    "scissors": ("des ciseaux", "{n} paires de ciseaux"),
    "teddy bear": ("un ours en peluche", "{n} ours en peluche"),
    "hair drier": ("un sèche-cheveux", "{n} sèche-cheveux"),
    "toothbrush": ("une brosse à dents", "{n} brosses à dents"),
}


def _translate_label(label: str, count: int, lang: str) -> str:
    """Traduit un label COCO avec son article et gère le singulier/pluriel selon la langue."""
    if lang == "fr":
        if label in COCO_FR:
            singular, plural = COCO_FR[label]
            return singular if count == 1 else plural.format(n=count)
        return f"{count} {label}" if count > 1 else f"un {label}"
    else:
        # Anglais : utilise le label COCO brut avec article indéfini ou quantité.
        return f"{count} {label}{'s' if count > 1 else ''}" if count > 1 else f"a {label}"


def _build_list_prose(items: List[str]) -> str:
    """Assemble une liste en prose avec des virgules et 'et' avant le dernier élément."""
    if not items:
        return ""
    if len(items) == 1:
        return items[0]
    return ", ".join(items[:-1]) + " et " + items[-1]


def generate(
    objects: List[DetectedObject],
    scene: Scene,
    prompt: Optional[str],
    lang: str,
) -> str:
    """Génère une description textuelle cohérente à partir des objets, de la scène et du prompt.

    Retourne une phrase décrivant le contenu visuel adapté à la langue demandée.
    """
    counts = Counter(obj.label for obj in objects)

    if not objects:
        if prompt:
            if lang == "fr":
                return (
                    f"Aucun objet reconnu n'a été détecté. "
                    f"Concernant votre question « {prompt} » : "
                    f"l'analyse visuelle n'a pas permis d'identifier d'éléments pertinents."
                )
            return (
                f"No recognized object was detected. "
                f"Regarding your question \"{prompt}\": "
                f"the visual analysis could not identify relevant elements."
            )
        if lang == "fr":
            return "Aucun objet reconnu n'a été détecté dans cette image."
        return "No recognized object was detected in this image."

    translated_items = [
        _translate_label(label, count, lang) for label, count in counts.items()
    ]
    prose_list = _build_list_prose(translated_items)

    if lang == "fr":
        base = f"L'image montre {prose_list} dans un contexte de {scene.label}."
        if prompt:
            return (
                f"En réponse à « {prompt} » : l'image montre {prose_list} "
                f"dans un contexte de {scene.label}."
            )
        return base
    else:
        base = f"The image shows {prose_list} in a context of {scene.label}."
        if prompt:
            return (
                f"In response to \"{prompt}\": the image shows {prose_list} "
                f"in a context of {scene.label}."
            )
        return base
