
import hashlib
import json
from pathlib import Path


def load_config(path: str) -> dict:
    """Lee un archivo de configuración JSON y lo devuelve como dict."""
    return json.loads(Path(path).read_text(encoding="utf-8"))


def file_checksum(path: str) -> str:
    """Calcula el SHA-256 de un archivo, leyéndolo por bloques."""
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def slugify(text: str) -> str:
    """Convierte un texto en un slug seguro para URLs."""
    return "-".join(text.lower().split())
