"""Inférence de scène à partir des objets détectés par YOLO selon 12 niveaux de priorité."""

from typing import List, Optional, Tuple
from app.schemas.response import DetectedObject, Scene


# Définition des règles de scène par ordre de priorité décroissante.
# Chaque règle est un tuple : (triggers, label_scène, indoor).
SCENE_RULES: List[Tuple[set, str, Optional[bool]]] = [
    # Priorité 1 — Transports spécifiques.
    ({"airplane"}, "aéroport / zone aérienne", False),
    ({"boat"}, "port / étendue d'eau", False),
    ({"train"}, "gare / voie ferrée", False),
    # Priorité 2 — Sports et loisirs outdoor.
    ({"skis", "snowboard"}, "domaine skiable / montagne enneigée", False),
    ({"surfboard"}, "plage / surf", False),
    (
        {"sports ball", "baseball bat", "baseball glove", "tennis racket"},
        "terrain de sport",
        False,
    ),
    ({"skateboard"}, "espace urbain / skatepark", False),
    ({"kite", "frisbee"}, "espace ouvert / parc", False),
    # Priorité 3 — Nature et animaux sauvages.
    ({"elephant", "zebra", "giraffe", "bear"}, "zoo / safari", False),
    ({"horse", "cow", "sheep"}, "campagne / ferme", False),
    ({"bird", "cat", "dog"}, "extérieur / jardin", False),
    # Priorité 4 — Circulation.
    (
        {
            "car",
            "truck",
            "bus",
            "motorcycle",
            "bicycle",
            "traffic light",
            "stop sign",
            "parking meter",
            "fire hydrant",
        },
        "rue / circulation urbaine",
        False,
    ),
    # Priorité 5 — Voyage.
    ({"suitcase", "backpack", "handbag", "bench"}, "gare / aéroport / zone d'attente", None),
    ({"suitcase"}, "voyage / déplacement", None),
    # Priorité 6 — Pièces maison.
    ({"bed", "teddy bear"}, "chambre à coucher", True),
    ({"toilet", "toothbrush", "hair drier", "sink"}, "salle de bain", True),
    ({"microwave", "oven", "toaster", "refrigerator", "sink"}, "cuisine", True),
    ({"couch", "remote", "tv"}, "salon / salle de séjour", True),
    # Priorité 7 — Repas.
    (
        {
            "dining table",
            "fork",
            "knife",
            "spoon",
            "bowl",
            "wine glass",
            "bottle",
            "cup",
            "pizza",
            "cake",
            "sandwich",
            "hot dog",
            "donut",
            "banana",
            "apple",
            "orange",
            "broccoli",
            "carrot",
        },
        "repas / table à manger",
        True,
    ),
    # Priorité 8 — Bureau.
    ({"laptop", "keyboard", "mouse", "book", "tie"}, "bureau / espace de travail", True),
    # Priorité 9 — Célébration.
    ({"wine glass", "bottle", "cake"}, "célébration / fête", True),
    # Priorité 11 — Intérieur générique.
    (
        {
            "chair",
            "potted plant",
            "clock",
            "vase",
            "book",
            "cell phone",
            "scissors",
            "toothbrush",
            "umbrella",
        },
        "intérieur / pièce de vie",
        True,
    ),
]


def infer_scene(objects: List[DetectedObject]) -> Scene:
    """Infère la scène la plus probable à partir des objets détectés.

    Applique les règles dans l'ordre de priorité. Retourne la scène par défaut
    si aucune règle ne correspond. La confiance est calculée comme la moyenne
    des confidences des objets ayant déclenché la règle.
    """
    labels = [obj.label for obj in objects]
    label_set = set(labels)
    label_conf: dict = {obj.label: obj.confidence for obj in objects}

    # Priorité 10 — Foule (logique basée sur le nombre de personnes).
    person_count = labels.count("person")
    if person_count >= 5:
        person_confs = [obj.confidence for obj in objects if obj.label == "person"]
        confidence = sum(person_confs) / len(person_confs)
        return Scene(label="foule / espace public", confidence=round(confidence, 4), indoor=None)
    if 2 <= person_count <= 4:
        person_confs = [obj.confidence for obj in objects if obj.label == "person"]
        confidence = sum(person_confs) / len(person_confs)
        return Scene(label="scène de groupe", confidence=round(confidence, 4), indoor=None)

    # Application des règles de priorité 1 à 9 puis 11.
    for triggers, scene_label, indoor in SCENE_RULES:
        matched = triggers & label_set
        if matched:
            confs = [label_conf[lbl] for lbl in matched if lbl in label_conf]
            confidence = sum(confs) / len(confs) if confs else 0.5
            return Scene(label=scene_label, confidence=round(confidence, 4), indoor=indoor)

    # Priorité 12 — Scène par défaut.
    return Scene(label="scène générale", confidence=0.5, indoor=None)
