from __future__ import annotations

import hashlib
import json
import sys
from datetime import UTC, datetime

import numpy as np
import onnxruntime as ort
import torch

from .config import (
    ARTIFACT_DIR,
    DATASET_SCHEMA_VERSION,
    DATA_DIR,
    INPUT_MEAN,
    INPUT_STD,
    PUBLIC_MODEL_DIR,
    RASTER_LINE_WIDTH,
    RASTER_PADDING,
    RASTER_SIZE,
    SEED,
    class_manifest_sha256,
    file_sha256,
    load_catalog_version,
    load_class_bindings,
    load_classes,
    load_templates,
)
from .model import build_model


if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


def _dataset_metrics(
    session: ort.InferenceSession,
    classes: list[str],
    temperature: float,
    class_thresholds: dict[str, float],
    minimum_semantic_margin: float,
) -> dict[str, float]:
    payload = np.load(DATA_DIR / "test.npz")
    if payload["classes"].tolist() != classes:
        raise RuntimeError("Test dataset classes do not match the checkpoint.")
    if int(payload["dataset_schema_version"]) != DATASET_SCHEMA_VERSION:
        raise RuntimeError("Test dataset schema is stale.")
    if str(payload["catalog_version"]) != load_catalog_version():
        raise RuntimeError("Test dataset catalog version is stale.")
    if str(payload["class_manifest_sha256"]) != class_manifest_sha256(classes):
        raise RuntimeError("Test dataset class manifest is stale.")
    images = payload["images"].astype(np.float32) / 255.0
    images = ((images - INPUT_MEAN) / INPUT_STD)[:, None, :, :]
    labels = payload["labels"]
    stroke_counts = payload["stroke_counts"]
    loop_counts = payload["loop_counts"]
    open_stroke_counts = payload["open_stroke_counts"]
    logits = np.concatenate(
        [
            session.run(None, {"input": images[index : index + 1]})[0]
            for index in range(len(images))
        ],
        axis=0,
    ) / temperature
    shifted = logits - logits.max(axis=1, keepdims=True)
    probabilities = np.exp(shifted)
    probabilities /= probabilities.sum(axis=1, keepdims=True)
    predictions = probabilities.argmax(axis=1)
    top3 = np.argsort(logits, axis=1)[:, -3:]
    unknown_index = classes.index("UNKNOWN")
    unknown_mask = labels == unknown_index
    templates = load_templates()
    sorted_probabilities = np.sort(probabilities, axis=1)
    margins = sorted_probabilities[:, -1] - sorted_probabilities[:, -2]
    accepted_non_unknown = np.array(
        [
            prediction != unknown_index
            and probabilities[index, prediction] >= class_thresholds[classes[prediction]]
            and margins[index] >= minimum_semantic_margin
            and stroke_counts[index] == len(templates[classes[prediction]]["strokes"])
            and loop_counts[index]
            == templates[classes[prediction]]["topology_signature"]["loops"]
            and open_stroke_counts[index]
            == templates[classes[prediction]]["topology_signature"]["open_strokes"]
            for index, prediction in enumerate(predictions)
        ]
    )
    unknown_false_accept = (
        float(np.mean(accepted_non_unknown[unknown_mask]))
        if np.any(unknown_mask)
        else 0.0
    )
    return {
        "top1Accuracy": float(np.mean(predictions == labels)),
        "top3Accuracy": float(np.mean(np.any(top3 == labels[:, None], axis=1))),
        "unknownFalseAcceptRate": unknown_false_accept,
    }


def main() -> None:
    checkpoint = torch.load(
        ARTIFACT_DIR / "glyph-recognizer-v1.pt",
        map_location="cpu",
        weights_only=False,
    )
    classes = checkpoint["classes"]
    active_classes = load_classes()
    if classes != active_classes:
        raise RuntimeError(
            "Checkpoint classes do not match the active rune manifest. Retrain first."
        )
    expected_provenance = {
        "catalog_version": load_catalog_version(),
        "class_manifest_sha256": class_manifest_sha256(classes),
        "dataset_schema_version": DATASET_SCHEMA_VERSION,
        "train_sha256": file_sha256(DATA_DIR / "train.npz"),
        "val_sha256": file_sha256(DATA_DIR / "val.npz"),
    }
    for key, expected in expected_provenance.items():
        if checkpoint.get(key) != expected:
            raise RuntimeError(
                f"Checkpoint provenance field {key} is stale. Regenerate and retrain."
            )
    test_payload = np.load(DATA_DIR / "test.npz")
    if (
        str(test_payload["generation_spec_sha256"])
        != checkpoint["generation_spec_sha256"]
    ):
        raise RuntimeError("Test dataset does not match the checkpoint generation spec.")
    model = build_model(len(classes), pretrained=False)
    model.load_state_dict(checkpoint["state_dict"])
    model.eval()
    PUBLIC_MODEL_DIR.mkdir(parents=True, exist_ok=True)
    model_path = PUBLIC_MODEL_DIR / "model.onnx"
    example = torch.zeros(1, 1, RASTER_SIZE, RASTER_SIZE)
    torch.onnx.export(
        model,
        (example,),
        model_path,
        input_names=["input"],
        output_names=["logits"],
        opset_version=18,
        dynamo=True,
        external_data=False,
    )
    model_size = model_path.stat().st_size
    if model_size >= 15 * 1024 * 1024:
        raise RuntimeError(f"ONNX model is too large: {model_size} bytes")
    session = ort.InferenceSession(str(model_path), providers=["CPUExecutionProvider"])
    minimum_semantic_margin = 0.035
    metrics = _dataset_metrics(
        session,
        classes,
        checkpoint["temperature"],
        checkpoint["class_thresholds"],
        minimum_semantic_margin,
    )
    sha256 = hashlib.sha256(model_path.read_bytes()).hexdigest()
    model_version = (
        f"1.0.0-{datetime.now(UTC).strftime('%Y%m%d')}-{sha256[:8]}"
    )
    metadata = {
        "schemaVersion": 1,
        "modelVersion": model_version,
        "modelFile": "model.onnx",
        "classes": classes,
        "catalogVersion": load_catalog_version(),
        "classManifestSha256": class_manifest_sha256(classes),
        "classBindings": load_class_bindings(),
        "unknownClass": "UNKNOWN",
        "input": {
            "width": RASTER_SIZE,
            "height": RASTER_SIZE,
            "channels": 1,
            "padding": RASTER_PADDING,
            "lineWidth": RASTER_LINE_WIDTH,
            "mean": INPUT_MEAN,
            "std": INPUT_STD,
        },
        "temperature": checkpoint["temperature"],
        "classThresholds": checkpoint["class_thresholds"],
        "minimumSemanticMargin": minimum_semantic_margin,
        "metrics": metrics,
        "sha256": sha256,
        "trainingSeed": SEED,
        "trainingProvenance": {
            "datasetSchemaVersion": DATASET_SCHEMA_VERSION,
            "generationSpecSha256": checkpoint["generation_spec_sha256"],
            "trainSha256": checkpoint["train_sha256"],
            "valSha256": checkpoint["val_sha256"],
            "testSha256": file_sha256(DATA_DIR / "test.npz"),
        },
    }
    (PUBLIC_MODEL_DIR / "metadata.json").write_text(
        json.dumps(metadata, indent=2),
        encoding="utf-8",
    )
    (PUBLIC_MODEL_DIR / "MODEL_CARD.md").write_text(
        "\n".join(
            [
                "# Glyph Recognizer v1",
                "",
                "MobileNetV3-Small trained for the closed v2.2 glyph catalog.",
                "",
                f"- Classes: {len(classes)}",
                f"- Catalog: {load_catalog_version()}",
                f"- Class manifest SHA-256: `{class_manifest_sha256(classes)}`",
                f"- Input: 1x{RASTER_SIZE}x{RASTER_SIZE}",
                f"- Test top-1: {metrics['top1Accuracy']:.4f}",
                f"- Test top-3: {metrics['top3Accuracy']:.4f}",
                f"- UNKNOWN false accept: {metrics['unknownFalseAcceptRate']:.4f}",
                f"- ONNX bytes: {model_size}",
                f"- SHA-256: `{sha256}`",
                f"- Dataset spec SHA-256: `{checkpoint['generation_spec_sha256']}`",
                "",
                "The model proposes candidates only. Topology and MagicFormulaV2 grammar remain authoritative.",
            ]
        ),
        encoding="utf-8",
    )
    print(json.dumps({"modelBytes": model_size, "metrics": metrics}, indent=2))


if __name__ == "__main__":
    main()
