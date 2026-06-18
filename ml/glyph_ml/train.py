from __future__ import annotations

import argparse
import json
import random

import numpy as np
import torch
from torch import nn
from torch.utils.data import DataLoader, Dataset

from .config import (
    ARTIFACT_DIR,
    DATASET_SCHEMA_VERSION,
    DATA_DIR,
    INPUT_MEAN,
    INPUT_STD,
    SEED,
    class_manifest_sha256,
    file_sha256,
    load_catalog_version,
    load_classes,
)
from .model import build_model


class GlyphDataset(Dataset):
    def __init__(self, path, expected_classes: list[str]):
        payload = np.load(path)
        dataset_classes = payload["classes"].tolist()
        if dataset_classes != expected_classes:
            raise RuntimeError(
                f"Dataset classes in {path} do not match the active rune manifest."
            )
        if int(payload["dataset_schema_version"]) != DATASET_SCHEMA_VERSION:
            raise RuntimeError(f"Dataset schema in {path} is stale.")
        if str(payload["catalog_version"]) != load_catalog_version():
            raise RuntimeError(f"Dataset catalog version in {path} is stale.")
        expected_manifest_hash = class_manifest_sha256(expected_classes)
        if str(payload["class_manifest_sha256"]) != expected_manifest_hash:
            raise RuntimeError(f"Dataset class manifest in {path} is stale.")
        self.generation_spec_sha256 = str(payload["generation_spec_sha256"])
        self.images = payload["images"]
        self.labels = payload["labels"]

    def __len__(self) -> int:
        return len(self.labels)

    def __getitem__(self, index: int):
        image = torch.from_numpy(self.images[index].astype(np.float32) / 255.0).unsqueeze(0)
        image = (image - INPUT_MEAN) / INPUT_STD
        return image, int(self.labels[index])


def _metrics(logits: torch.Tensor, labels: torch.Tensor) -> dict[str, float]:
    top1 = (logits.argmax(dim=1) == labels).float().mean().item()
    top3 = (
        logits.topk(min(3, logits.shape[1]), dim=1).indices
        .eq(labels[:, None])
        .any(dim=1)
        .float()
        .mean()
        .item()
    )
    return {"top1": top1, "top3": top3}


def _evaluate(model, loader, device):
    model.eval()
    logits_parts = []
    label_parts = []
    with torch.no_grad():
        for images, labels in loader:
            images = images.to(device)
            logits_parts.append(model(images).cpu())
            label_parts.append(labels)
    logits = torch.cat(logits_parts)
    labels = torch.cat(label_parts)
    return logits, labels, _metrics(logits, labels)


def _calibrate_temperature(logits: torch.Tensor, labels: torch.Tensor) -> float:
    log_temperature = nn.Parameter(torch.zeros(()))
    optimizer = torch.optim.LBFGS([log_temperature], lr=0.05, max_iter=80)
    loss_fn = nn.CrossEntropyLoss()

    def closure():
        optimizer.zero_grad()
        temperature = log_temperature.exp().clamp(0.05, 10)
        loss = loss_fn(logits / temperature, labels)
        loss.backward()
        return loss

    optimizer.step(closure)
    return float(log_temperature.exp().clamp(0.05, 10).detach())


def _class_thresholds(
    logits: torch.Tensor,
    labels: torch.Tensor,
    classes: list[str],
    temperature: float,
) -> dict[str, float]:
    probabilities = torch.softmax(logits / temperature, dim=1)
    predictions = probabilities.argmax(dim=1)
    thresholds: dict[str, float] = {}
    for index, label in enumerate(classes):
        correct = probabilities[(labels == index) & (predictions == index), index]
        if len(correct) == 0:
            thresholds[label] = 0.65
            continue
        quantile = float(torch.quantile(correct, 0.05))
        thresholds[label] = round(max(0.35, min(0.8, quantile * 0.88)), 4)
    thresholds["UNKNOWN"] = 0.5
    return thresholds


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--epochs", type=int, default=14)
    parser.add_argument("--batch-size", type=int, default=64)
    parser.add_argument("--learning-rate", type=float, default=0.0015)
    parser.add_argument("--no-pretrained", action="store_true")
    args = parser.parse_args()

    random.seed(SEED)
    np.random.seed(SEED)
    torch.manual_seed(SEED)
    classes = load_classes()
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    train_dataset = GlyphDataset(DATA_DIR / "train.npz", classes)
    val_dataset = GlyphDataset(DATA_DIR / "val.npz", classes)
    if train_dataset.generation_spec_sha256 != val_dataset.generation_spec_sha256:
        raise RuntimeError("Train and validation datasets use different generation specs.")
    train_loader = DataLoader(
        train_dataset,
        batch_size=args.batch_size,
        shuffle=True,
        num_workers=0,
    )
    val_loader = DataLoader(
        val_dataset,
        batch_size=args.batch_size,
        shuffle=False,
        num_workers=0,
    )
    model = build_model(len(classes), pretrained=not args.no_pretrained).to(device)
    optimizer = torch.optim.AdamW(
        model.parameters(),
        lr=args.learning_rate,
        weight_decay=0.0005,
    )
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=args.epochs)
    loss_fn = nn.CrossEntropyLoss(label_smoothing=0.04)
    best_top1 = -1.0
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)

    for epoch in range(1, args.epochs + 1):
        model.train()
        running_loss = 0.0
        for images, labels in train_loader:
            images = images.to(device)
            labels = labels.to(device)
            optimizer.zero_grad(set_to_none=True)
            logits = model(images)
            loss = loss_fn(logits, labels)
            loss.backward()
            optimizer.step()
            running_loss += float(loss.detach()) * len(labels)
        scheduler.step()
        val_logits, val_labels, metrics = _evaluate(model, val_loader, device)
        print(
            f"epoch={epoch} loss={running_loss / len(train_loader.dataset):.4f} "
            f"val_top1={metrics['top1']:.4f} val_top3={metrics['top3']:.4f}"
        )
        if metrics["top1"] > best_top1:
            best_top1 = metrics["top1"]
            temperature = _calibrate_temperature(val_logits, val_labels)
            thresholds = _class_thresholds(
                val_logits,
                val_labels,
                classes,
                temperature,
            )
            torch.save(
                {
                    "state_dict": model.state_dict(),
                    "classes": classes,
                    "temperature": temperature,
                    "class_thresholds": thresholds,
                    "validation_metrics": metrics,
                    "seed": SEED,
                    "catalog_version": load_catalog_version(),
                    "class_manifest_sha256": class_manifest_sha256(classes),
                    "dataset_schema_version": DATASET_SCHEMA_VERSION,
                    "generation_spec_sha256": train_dataset.generation_spec_sha256,
                    "train_sha256": file_sha256(DATA_DIR / "train.npz"),
                    "val_sha256": file_sha256(DATA_DIR / "val.npz"),
                },
                ARTIFACT_DIR / "glyph-recognizer-v1.pt",
            )
            (ARTIFACT_DIR / "training-summary.json").write_text(
                json.dumps(
                    {
                        "device": str(device),
                        "epochsCompleted": epoch,
                        "bestValidationMetrics": metrics,
                        "temperature": temperature,
                        "classThresholds": thresholds,
                        "catalogVersion": load_catalog_version(),
                        "classManifestSha256": class_manifest_sha256(classes),
                        "datasetSchemaVersion": DATASET_SCHEMA_VERSION,
                        "generationSpecSha256": train_dataset.generation_spec_sha256,
                        "trainSha256": file_sha256(DATA_DIR / "train.npz"),
                        "valSha256": file_sha256(DATA_DIR / "val.npz"),
                    },
                    indent=2,
                ),
                encoding="utf-8",
            )


if __name__ == "__main__":
    main()
