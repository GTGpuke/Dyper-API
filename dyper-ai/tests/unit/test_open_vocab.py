"""Tests unitaires de la construction du vocabulaire ouvert transmis à YOLO-World."""

import pytest
from app.data.open_vocab import build_vocabulary


@pytest.mark.unit
class TestBuildVocabulary:
    """Tests de build_vocabulary (vision-grounded par défaut, base LVIS optionnelle, filtrage décor)."""

    def test_elements_vision_places_en_tete(self):
        """Vérifie que les éléments contextuels (vision) sont placés avant la base."""
        vocab = build_vocabulary(["zebra"])
        assert vocab[0] == "zebra"

    def test_filtre_les_termes_de_decor(self):
        """Vérifie que les surfaces non localisables (floor, wall…) sont écartées, les objets gardés."""
        vocab = build_vocabulary(["floor", "wall", "cat"])
        assert "floor" not in vocab
        assert "wall" not in vocab
        assert "cat" in vocab

    def test_deduplication_insensible_a_la_casse(self):
        """Vérifie la déduplication insensible à la casse."""
        vocab = build_vocabulary(["Cat", "cat"])
        assert vocab.count("cat") == 1

    def test_base_lvis_exclue_par_defaut(self):
        """Vérifie que par défaut le vocabulaire se limite aux éléments vision (pas de base LVIS).

        C'est ce qui rend impossibles les hallucinations de classes obscures (necklace, birdbath…) :
        absentes du vocabulaire, World ne peut pas les émettre.
        """
        vocab = build_vocabulary(["cat"])
        assert vocab == ["cat"]
        assert "birdbath" not in vocab
        assert "necklace" not in vocab

    def test_base_lvis_incluse_si_demandee(self):
        """Vérifie qu'avec include_base=True la base LVIS complète le vocabulaire (vision en tête)."""
        vocab = build_vocabulary(["cat"], include_base=True)
        assert vocab[0] == "cat"  # Les éléments vision restent prioritaires.
        assert "birdbath" in vocab  # La base étendue est bien réintroduite.
        assert len(vocab) > 1
