from __future__ import annotations

import json
import hashlib
from pathlib import Path

ML_ROOT = Path(__file__).resolve().parents[1]
APP_ROOT = ML_ROOT.parent
DATA_DIR = ML_ROOT / "data"
ARTIFACT_DIR = ML_ROOT / "artifacts"
PUBLIC_MODEL_DIR = APP_ROOT / "public" / "models" / "glyph-recognizer-v1"
GLYPH_TEMPLATE_PATH = APP_ROOT / "src" / "data" / "glyphTemplates.seed.json"
RUNE_MANIFEST_PATH = APP_ROOT / "src" / "data" / "magicRunesV2.seed.json"
MAGIC_CATALOG_PATH = APP_ROOT / "src" / "data" / "magicCatalogV2.seed.json"

RASTER_SIZE = 128
RASTER_PADDING = 12
RASTER_LINE_WIDTH = 5.0
INPUT_MEAN = 0.15
INPUT_STD = 0.35
SEED = 20260608
DATASET_SCHEMA_VERSION = 2


def load_rune_manifest() -> dict:
    manifest = json.loads(RUNE_MANIFEST_PATH.read_text(encoding="utf-8"))
    catalog = json.loads(MAGIC_CATALOG_PATH.read_text(encoding="utf-8"))
    if manifest.get("schemaVersion") != 1:
        raise RuntimeError("Unsupported magic rune manifest schema.")
    if manifest.get("catalogVersion") != catalog.get("version"):
        raise RuntimeError(
            "Magic rune manifest and magic catalog versions do not match."
        )
    runes = manifest.get("runes")
    if not isinstance(runes, list) or not runes:
        raise RuntimeError("Magic rune manifest does not contain runes.")
    template_ids = [rune.get("templateId") for rune in runes]
    if len(template_ids) != len(set(template_ids)):
        raise RuntimeError("Magic rune manifest contains duplicate template ids.")
    return manifest


def load_classes() -> list[str]:
    manifest = load_rune_manifest()
    defaults = manifest["defaults"]
    classes = [
        rune["templateId"]
        for rune in manifest["runes"]
        if rune.get("active", defaults["active"])
        and rune["binding"]["type"] != "casting_circle"
    ]
    if "UNKNOWN" in classes:
        raise RuntimeError('Rune template id "UNKNOWN" is reserved.')
    return [*classes, "UNKNOWN"]


def load_class_bindings() -> dict[str, dict]:
    manifest = load_rune_manifest()
    defaults = manifest["defaults"]
    return {
        rune["templateId"]: rune["binding"]
        for rune in manifest["runes"]
        if rune.get("active", defaults["active"])
        and rune["binding"]["type"] != "casting_circle"
    }


def load_unknown_negative_template_ids() -> list[str]:
    return list(load_rune_manifest().get("unknownNegativeTemplateIds", []))


def load_catalog_version() -> str:
    return str(load_rune_manifest()["catalogVersion"])


def class_manifest_sha256(classes: list[str]) -> str:
    payload = json.dumps(classes, separators=(",", ":"), ensure_ascii=True)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def file_sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_templates() -> dict[str, dict]:
    templates = json.loads(GLYPH_TEMPLATE_PATH.read_text(encoding="utf-8"))
    template_ids = [template["id"] for template in templates]
    if len(template_ids) != len(set(template_ids)):
        raise RuntimeError("Glyph template catalog contains duplicate ids.")
    indexed = {template["id"]: template for template in templates}
    referenced_ids = [
        class_id for class_id in load_classes() if class_id != "UNKNOWN"
    ] + load_unknown_negative_template_ids()
    missing_ids = sorted(set(referenced_ids) - indexed.keys())
    if missing_ids:
        raise RuntimeError(
            f"Rune manifest references missing glyph templates: {missing_ids}"
        )
    return indexed
