from __future__ import annotations

import json

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
    RASTER_SIZE,
    class_manifest_sha256,
    file_sha256,
    load_catalog_version,
    load_classes,
)
from .model import build_model


def main() -> None:
    checkpoint = torch.load(
        ARTIFACT_DIR / "glyph-recognizer-v1.pt",
        map_location="cpu",
        weights_only=False,
    )
    model = build_model(len(checkpoint["classes"]), pretrained=False)
    model.load_state_dict(checkpoint["state_dict"])
    model.eval()
    rng = np.random.default_rng(20260608)
    batch = rng.random((1, 1, RASTER_SIZE, RASTER_SIZE), dtype=np.float32)
    batch = (batch - INPUT_MEAN) / INPUT_STD
    with torch.no_grad():
        torch_logits = model(torch.from_numpy(batch)).numpy()
    session = ort.InferenceSession(
        str(PUBLIC_MODEL_DIR / "model.onnx"),
        providers=["CPUExecutionProvider"],
    )
    onnx_logits = session.run(None, {"input": batch})[0]
    max_error = float(np.max(np.abs(torch_logits - onnx_logits)))
    metadata = json.loads((PUBLIC_MODEL_DIR / "metadata.json").read_text(encoding="utf-8"))
    expected_classes = load_classes()
    if checkpoint["classes"] != expected_classes:
        raise RuntimeError("Checkpoint classes do not match the active rune manifest.")
    if metadata["classes"] != expected_classes:
        raise RuntimeError("Model metadata classes do not match the active rune manifest.")
    if metadata.get("catalogVersion") != load_catalog_version():
        raise RuntimeError("Model metadata catalog version is stale.")
    if metadata.get("classManifestSha256") != class_manifest_sha256(expected_classes):
        raise RuntimeError("Model metadata class manifest hash is stale.")
    provenance = metadata.get("trainingProvenance", {})
    expected_provenance = {
        "datasetSchemaVersion": DATASET_SCHEMA_VERSION,
        "generationSpecSha256": checkpoint.get("generation_spec_sha256"),
        "trainSha256": file_sha256(DATA_DIR / "train.npz"),
        "valSha256": file_sha256(DATA_DIR / "val.npz"),
        "testSha256": file_sha256(DATA_DIR / "test.npz"),
    }
    if provenance != expected_provenance:
        raise RuntimeError("Model metadata dataset provenance is stale.")
    metrics = metadata["metrics"]
    if max_error > 1e-4:
        raise RuntimeError(f"PyTorch/ONNX parity failed: {max_error}")
    if metrics["top1Accuracy"] < 0.95:
        raise RuntimeError(f"Top-1 acceptance failed: {metrics['top1Accuracy']}")
    if metrics["top3Accuracy"] < 0.99:
        raise RuntimeError(f"Top-3 acceptance failed: {metrics['top3Accuracy']}")
    if metrics["unknownFalseAcceptRate"] >= 0.02:
        raise RuntimeError(
            f"UNKNOWN false-accept acceptance failed: {metrics['unknownFalseAcceptRate']}"
        )
    print(
        json.dumps(
            {
                "maxParityError": max_error,
                "metrics": metrics,
                "modelVersion": metadata["modelVersion"],
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
