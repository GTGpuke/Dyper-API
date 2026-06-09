"""Inférence de scène à partir des objets détectés par YOLO, selon des règles priorisées.

Chaque règle porte un label français **et** anglais : la scène retournée est localisée
selon la langue demandée (corrige le bug où `scene.label` restait en français en mode EN).
"""

from typing import NamedTuple

from app.schemas.response import DetectedObject, Scene


class SceneRule(NamedTuple):
    """Règle de scène : ensemble de déclencheurs, labels localisés et indicateur intérieur."""

    triggers: frozenset[str]
    label_fr: str
    label_en: str
    indoor: bool | None


# Règles ordonnées du plus spécifique au plus général (la première qui matche gagne).
SCENE_RULES: list[SceneRule] = [
    # Priorité 1 — Transports spécifiques.
    SceneRule(frozenset({"airplane"}), "aéroport / zone aérienne", "airport / air zone", False),
    SceneRule(frozenset({"boat"}), "port / étendue d'eau", "harbor / body of water", False),
    SceneRule(frozenset({"train"}), "gare / voie ferrée", "station / railway", False),
    # Priorité 2 — Sports et loisirs outdoor.
    SceneRule(
        frozenset({"skis", "snowboard"}),
        "domaine skiable / montagne enneigée",
        "ski resort / snowy mountain",
        False,
    ),
    SceneRule(frozenset({"surfboard"}), "plage / surf", "beach / surf", False),
    SceneRule(
        frozenset({"sports ball", "baseball bat", "baseball glove", "tennis racket"}),
        "terrain de sport",
        "sports field",
        False,
    ),
    SceneRule(
        frozenset({"skateboard"}), "espace urbain / skatepark", "urban area / skatepark", False
    ),
    SceneRule(frozenset({"kite", "frisbee"}), "espace ouvert / parc", "open space / park", False),
    # Priorité 3 — Nature et animaux sauvages.
    SceneRule(
        frozenset({"elephant", "zebra", "giraffe", "bear"}), "zoo / safari", "zoo / safari", False
    ),
    SceneRule(
        frozenset({"horse", "cow", "sheep"}), "campagne / ferme", "countryside / farm", False
    ),
    SceneRule(frozenset({"bird", "cat", "dog"}), "extérieur / jardin", "outdoors / garden", False),
    # Priorité 4 — Circulation.
    SceneRule(
        frozenset(
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
            }
        ),
        "rue / circulation urbaine",
        "street / urban traffic",
        False,
    ),
    # Priorité 5 — Voyage et transit.
    SceneRule(
        frozenset({"suitcase", "backpack", "handbag", "bench"}),
        "gare / aéroport / zone d'attente",
        "station / airport / waiting area",
        None,
    ),
    SceneRule(frozenset({"suitcase"}), "voyage / déplacement", "travel / commute", None),
    # Priorité 6 — Pièces de la maison.
    SceneRule(frozenset({"bed", "teddy bear"}), "chambre à coucher", "bedroom", True),
    # « sink » est ambigu (cuisine ET salle de bain) : on le réserve à la cuisine et on
    # s'appuie sur toilet/toothbrush/hair drier pour la salle de bain (évite les faux positifs).
    SceneRule(
        frozenset({"toilet", "toothbrush", "hair drier"}),
        "salle de bain",
        "bathroom",
        True,
    ),
    SceneRule(
        frozenset({"microwave", "oven", "toaster", "refrigerator", "sink"}),
        "cuisine",
        "kitchen",
        True,
    ),
    SceneRule(frozenset({"couch", "remote", "tv"}), "salon / salle de séjour", "living room", True),
    # Priorité 7 — Repas.
    SceneRule(
        frozenset(
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
            }
        ),
        "repas / table à manger",
        "meal / dining table",
        True,
    ),
    # Priorité 8 — Bureau.
    SceneRule(
        frozenset({"laptop", "keyboard", "mouse", "book", "tie"}),
        "bureau / espace de travail",
        "office / workspace",
        True,
    ),
    # Priorité 9 — Célébration.
    SceneRule(
        frozenset({"wine glass", "bottle", "cake"}),
        "célébration / fête",
        "celebration / party",
        True,
    ),
    # Priorité 11 — Intérieur générique.
    SceneRule(
        frozenset(
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
            }
        ),
        "intérieur / pièce de vie",
        "interior / living space",
        True,
    ),
]

# Libellés localisés des scènes calculées hors table de règles.
_CROWD = ("foule / espace public", "crowd / public space")
_GROUP = ("scène de groupe", "group scene")
_DEFAULT = ("scène générale", "general scene")


def _localized(labels: tuple[str, str], lang: str) -> str:
    """Retourne le label français ou anglais selon la langue (`fr` par défaut)."""
    return labels[1] if lang == "en" else labels[0]


def infer_scene(objects: list[DetectedObject], lang: str = "fr") -> Scene:
    """Infère la scène la plus probable à partir des objets détectés.

    Applique d'abord la logique de foule (basée sur le nombre de personnes), puis les règles
    par ordre de priorité. La confiance est la moyenne des confidences des objets ayant
    déclenché la règle. Retourne la scène par défaut si rien ne correspond.
    """
    labels = [obj.label for obj in objects]
    label_set = set(labels)

    # Priorité 10 — Foule / groupe (logique numérique sur les personnes).
    person_confs = [obj.confidence for obj in objects if obj.label == "person"]
    person_count = len(person_confs)
    if person_count >= 5:
        confidence = sum(person_confs) / person_count
        return Scene(label=_localized(_CROWD, lang), confidence=round(confidence, 4), indoor=None)
    if 2 <= person_count <= 4:
        confidence = sum(person_confs) / person_count
        return Scene(label=_localized(_GROUP, lang), confidence=round(confidence, 4), indoor=None)

    # Application des règles de priorité 1 à 9 puis 11.
    for rule in SCENE_RULES:
        matched = rule.triggers & label_set
        if matched:
            confs = [obj.confidence for obj in objects if obj.label in matched]
            confidence = sum(confs) / len(confs) if confs else 0.5
            label = rule.label_en if lang == "en" else rule.label_fr
            return Scene(label=label, confidence=round(confidence, 4), indoor=rule.indoor)

    # Priorité 12 — Scène par défaut.
    return Scene(label=_localized(_DEFAULT, lang), confidence=0.5, indoor=None)
