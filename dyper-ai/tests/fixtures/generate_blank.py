"""Script de génération d'une image blanche de test (blank.jpg) dans le dossier fixtures."""

import os
from PIL import Image

if __name__ == "__main__":
    output_path = os.path.join(os.path.dirname(__file__), "blank.jpg")
    img = Image.new("RGB", (100, 100), "white")
    img.save(output_path, format="JPEG")
    print(f"Image générée : {output_path}")
