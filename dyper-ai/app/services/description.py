"""Génération de comptes rendus textuels en français et en anglais à partir des détections YOLO.

Trois responsabilités : la traduction des labels COCO (anglais → français), l'assemblage de
phrases naturelles, et l'enrichissement du compte rendu (composition spatiale via les boîtes
englobantes, fiabilité des détections, couleurs nommées, cadre intérieur/extérieur, chronologie
vidéo). Le label de scène (`scene.label`) est déjà localisé en amont par
`scene.infer_scene(objects, lang)`, ce qui garantit une description entièrement cohérente.
"""

from collections import Counter

from app.schemas.response import DetectedObject, Scene, TimelineEntry

# Palette de couleurs nommées (RGB de référence) pour traduire les hexadécimaux en mots.
_NAMED_COLORS: list[tuple[str, str, tuple[int, int, int]]] = [
    ("noir", "black", (20, 20, 20)),
    ("blanc", "white", (240, 240, 240)),
    ("gris", "gray", (128, 128, 128)),
    ("rouge", "red", (200, 40, 40)),
    ("orange", "orange", (230, 130, 40)),
    ("jaune", "yellow", (230, 210, 60)),
    ("vert", "green", (60, 160, 70)),
    ("bleu", "blue", (50, 90, 200)),
    ("violet", "purple", (130, 70, 180)),
    ("rose", "pink", (230, 130, 180)),
    ("marron", "brown", (120, 80, 50)),
    ("beige", "beige", (210, 190, 160)),
]

# Table de traduction COCO vers le français : "label": (singulier, pluriel formaté avec {n}).
COCO_FR: dict[str, tuple[str, str]] = {
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

    # Anglais : label COCO brut, pluriel naïf et article « a/an » selon la voyelle initiale.
    if count > 1:
        return f"{count} {label}s"
    article = "an" if label[:1].lower() in "aeiou" else "a"
    return f"{article} {label}"


def _build_list_prose(items: list[str], lang: str) -> str:
    """Assemble une liste en prose avec virgules et la conjonction finale (« et » / « and »)."""
    if not items:
        return ""
    if len(items) == 1:
        return items[0]
    conjunction = "and" if lang == "en" else "et"
    return ", ".join(items[:-1]) + f" {conjunction} " + items[-1]


def _name_color(hex_color: str, lang: str) -> str | None:
    """Traduit une couleur hexadécimale (#RRGGBB) en nom de couleur le plus proche."""
    value = hex_color.lstrip("#")
    if len(value) != 6:
        return None
    try:
        r, g, b = int(value[0:2], 16), int(value[2:4], 16), int(value[4:6], 16)
    except ValueError:
        return None
    best = min(
        _NAMED_COLORS,
        key=lambda c: (c[2][0] - r) ** 2 + (c[2][1] - g) ** 2 + (c[2][2] - b) ** 2,
    )
    return best[0] if lang == "fr" else best[1]


def _composition_sentence(
    objects: list[DetectedObject], image_size: tuple[int, int], lang: str
) -> str | None:
    """Décrit la position et l'emprise du sujet principal (objet le plus fiable avec boîte)."""
    width, height = image_size
    if width <= 0 or height <= 0:
        return None
    boxed = [o for o in objects if o.boundingBox is not None]
    if not boxed:
        return None

    subject = max(boxed, key=lambda o: o.confidence)
    box = subject.boundingBox
    assert box is not None  # Garanti par le filtre ci-dessus.
    center_x = box.x + box.w / 2
    area_pct = round(100 * (box.w * box.h) / (width * height))

    if lang == "fr":
        position = (
            "dans la partie gauche"
            if center_x < width / 3
            else "dans la partie droite"
            if center_x > 2 * width / 3
            else "au centre"
        )
        label = _translate_label(subject.label, 1, "fr")
        sentence = f"Le sujet principal — {label} — se situe {position} de l'image"
        if area_pct >= 5:
            sentence += f" et occupe environ {area_pct} % du cadre"
        return sentence + "."

    position = (
        "on the left side"
        if center_x < width / 3
        else "on the right side"
        if center_x > 2 * width / 3
        else "in the center"
    )
    label = _translate_label(subject.label, 1, "en")
    sentence = f"The main subject — {label} — sits {position} of the frame"
    if area_pct >= 5:
        sentence += f" and covers about {area_pct}% of the image"
    return sentence + "."


def _confidence_sentence(objects: list[DetectedObject], lang: str) -> str:
    """Qualifie la fiabilité globale des détections selon la confiance moyenne."""
    mean = sum(o.confidence for o in objects) / len(objects)
    if lang == "fr":
        if mean >= 0.8:
            return "Les détections sont très fiables."
        if mean >= 0.5:
            return "Les détections sont globalement fiables."
        return "Les détections sont à considérer avec prudence."
    if mean >= 0.8:
        return "Detections are highly reliable."
    if mean >= 0.5:
        return "Detections are generally reliable."
    return "Detections should be considered with caution."


def _colors_sentence(colors: list[str], lang: str) -> str | None:
    """Décrit les teintes dominantes en mots (noms de couleurs dédupliqués)."""
    names: list[str] = []
    for hex_color in colors:
        name = _name_color(hex_color, lang)
        if name and name not in names:
            names.append(name)
    if not names:
        return None
    prose = _build_list_prose(names, lang)
    if lang == "fr":
        return f"Les teintes dominantes sont : {prose}."
    return f"The dominant tones are: {prose}."


def _format_timecode(seconds: float) -> str:
    """Formate une durée en secondes au format m:ss."""
    total = max(0, round(seconds))
    return f"{total // 60}:{total % 60:02d}"


def _timeline_sentences(timeline: list[TimelineEntry], lang: str) -> list[str]:
    """Décrit la durée de la vidéo et la présence des principaux objets dans le temps."""
    if not timeline:
        return []
    duration = max(entry.t for entry in timeline)
    total_samples = len(timeline)

    # Taux de présence et première apparition par label.
    presence: dict[str, int] = {}
    first_seen: dict[str, float] = {}
    for entry in timeline:
        for label in entry.labels:
            presence[label] = presence.get(label, 0) + 1
            first_seen.setdefault(label, entry.t)

    sentences: list[str] = []
    if lang == "fr":
        sentences.append(f"La vidéo dure environ {_format_timecode(duration)}.")
    else:
        sentences.append(f"The video lasts about {_format_timecode(duration)}.")

    # Les trois objets les plus présents, qualifiés par leur taux de présence.
    top = sorted(presence.items(), key=lambda kv: kv[1], reverse=True)[:3]
    for label, count in top:
        ratio = count / total_samples
        translated = _translate_label(label, 1, lang)
        if lang == "fr":
            if ratio >= 0.8:
                sentences.append(f"{translated} est visible tout au long de la vidéo.".capitalize())
            elif ratio >= 0.4:
                sentences.append(
                    f"{translated} apparaît pendant une grande partie de la vidéo.".capitalize()
                )
            else:
                sentences.append(
                    f"{translated} apparaît ponctuellement "
                    f"(vers {_format_timecode(first_seen[label])}).".capitalize()
                )
        else:
            if ratio >= 0.8:
                sentences.append(f"{translated} is visible throughout the video.".capitalize())
            elif ratio >= 0.4:
                sentences.append(f"{translated} appears during most of the video.".capitalize())
            else:
                sentences.append(
                    f"{translated} appears briefly "
                    f"(around {_format_timecode(first_seen[label])}).".capitalize()
                )
    return sentences


def generate(
    objects: list[DetectedObject],
    scene: Scene,
    prompt: str | None,
    lang: str,
    *,
    colors: list[str] | None = None,
    image_size: tuple[int, int] | None = None,
    timeline: list[TimelineEntry] | None = None,
) -> str:
    """Génère un compte rendu textuel complet à partir des détections.

    La première phrase conserve sa forme historique (« L'image montre … » / « The image
    shows … ») ; les arguments nommés optionnels enrichissent le compte rendu : composition
    spatiale (`image_size`), couleurs nommées (`colors`) et chronologie vidéo (`timeline`).
    """
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
                f'Regarding your question "{prompt}": '
                f"the visual analysis could not identify relevant elements."
            )
        if lang == "fr":
            return "Aucun objet reconnu n'a été détecté dans cette image."
        return "No recognized object was detected in this image."

    counts = Counter(obj.label for obj in objects)
    translated_items = [_translate_label(label, count, lang) for label, count in counts.items()]
    prose_list = _build_list_prose(translated_items, lang)

    # Phrase d'ouverture (forme historique préservée).
    if lang == "fr":
        if prompt:
            opening = (
                f"En réponse à « {prompt} » : l'image montre {prose_list} "
                f"dans un contexte de {scene.label}."
            )
        else:
            opening = f"L'image montre {prose_list} dans un contexte de {scene.label}."
    elif prompt:
        opening = (
            f'In response to "{prompt}": the image shows {prose_list} '
            f"in a context of {scene.label}."
        )
    else:
        opening = f"The image shows {prose_list} in a context of {scene.label}."

    sentences: list[str] = [opening]

    # Cadre intérieur / extérieur.
    if scene.indoor is True:
        sentences.append(
            "La scène se déroule en intérieur."
            if lang == "fr"
            else "The scene takes place indoors."
        )
    elif scene.indoor is False:
        sentences.append(
            "La scène se déroule en extérieur."
            if lang == "fr"
            else "The scene takes place outdoors."
        )

    # Composition spatiale (sujet principal, position, emprise).
    if image_size is not None:
        composition = _composition_sentence(objects, image_size, lang)
        if composition:
            sentences.append(composition)

    # Chronologie vidéo (durée + présence des principaux objets).
    if timeline:
        sentences.extend(_timeline_sentences(timeline, lang))

    # Couleurs dominantes en mots.
    if colors:
        colors_sentence = _colors_sentence(colors, lang)
        if colors_sentence:
            sentences.append(colors_sentence)

    # Fiabilité globale des détections.
    sentences.append(_confidence_sentence(objects, lang))

    return " ".join(sentences)
