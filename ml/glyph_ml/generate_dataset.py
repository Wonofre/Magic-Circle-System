from __future__ import annotations

import argparse
import hashlib
import json
import random
from pathlib import Path

import numpy as np

from .config import (
    DATASET_SCHEMA_VERSION,
    DATA_DIR,
    GLYPH_TEMPLATE_PATH,
    RASTER_LINE_WIDTH,
    RASTER_PADDING,
    RASTER_SIZE,
    RUNE_MANIFEST_PATH,
    SEED,
    class_manifest_sha256,
    file_sha256,
    load_catalog_version,
    load_classes,
    load_templates,
    load_unknown_negative_template_ids,
)
from .rasterizer import Point, Stroke, rasterize_strokes


def _transform_template(
    source: list[list[list[float]]],
    rng: random.Random,
) -> list[Stroke]:
    angle = np.deg2rad(rng.uniform(-20, 20))
    cos_angle = float(np.cos(angle))
    sin_angle = float(np.sin(angle))
    scale_x = rng.uniform(0.78, 1.22)
    scale_y = rng.uniform(0.78, 1.22)
    shear = rng.uniform(-0.12, 0.12)
    jitter = rng.uniform(0.0, 3.2)
    strokes: list[Stroke] = []

    for raw_stroke in source:
        stroke: Stroke = []
        for x, y in raw_stroke:
            centered_x = x - 50
            centered_y = y - 50
            transformed_x = centered_x * scale_x + centered_y * shear
            transformed_y = centered_y * scale_y
            rotated_x = transformed_x * cos_angle - transformed_y * sin_angle
            rotated_y = transformed_x * sin_angle + transformed_y * cos_angle
            stroke.append(
                (
                    50 + rotated_x + rng.gauss(0, jitter),
                    50 + rotated_y + rng.gauss(0, jitter),
                )
            )
        if rng.random() < 0.12 and len(stroke) > 8:
            trim = rng.randint(1, max(1, len(stroke) // 10))
            stroke = stroke[trim:-trim] or stroke
        if rng.random() < 0.35:
            stroke.reverse()
        strokes.append(stroke)

    if rng.random() < 0.18 and strokes:
        index = rng.randrange(len(strokes))
        stroke = strokes[index]
        if len(stroke) > 8:
            split = rng.randint(3, len(stroke) - 3)
            strokes[index:index + 1] = [stroke[: split + 1], stroke[split:]]
    if rng.random() < 0.12 and strokes:
        source_stroke = rng.choice(strokes)
        strokes.append(
            [(x + rng.uniform(-1.8, 1.8), y + rng.uniform(-1.8, 1.8)) for x, y in source_stroke]
        )
    if rng.random() < 0.25:
        rng.shuffle(strokes)
    return strokes


def _normalize_strokes(strokes: list[Stroke]) -> list[Stroke]:
    points = [point for stroke in strokes for point in stroke]
    if not points:
        return []
    min_x = min(point[0] for point in points)
    min_y = min(point[1] for point in points)
    max_x = max(point[0] for point in points)
    max_y = max(point[1] for point in points)
    source_size = max(1.0, max_x - min_x, max_y - min_y)
    scale = 100.0 / source_size
    width = (max_x - min_x) * scale
    height = (max_y - min_y) * scale
    offset_x = (100.0 - width) / 2
    offset_y = (100.0 - height) / 2
    return [
        [
            (
                offset_x + (x - min_x) * scale,
                offset_y + (y - min_y) * scale,
            )
            for x, y in stroke
        ]
        for stroke in strokes
    ]


def _unknown_strokes(
    rng: random.Random,
    class_templates: dict[str, dict],
    negative_templates: dict[str, dict],
) -> list[Stroke]:
    mode = rng.randrange(8)
    if mode == 0:
        point_count = rng.randint(25, 90)
        x = rng.uniform(20, 80)
        y = rng.uniform(20, 80)
        stroke: Stroke = [(x, y)]
        for _ in range(point_count - 1):
            x += rng.uniform(-12, 12)
            y += rng.uniform(-12, 12)
            stroke.append((x, y))
        return [stroke]
    if mode == 1:
        return [
            [
                (rng.uniform(5, 95), rng.uniform(5, 95))
                for _ in range(rng.randint(2, 7))
            ]
            for _ in range(rng.randint(2, 8))
        ]
    if mode == 2:
        end = rng.uniform(np.pi * 0.8, np.pi * 1.75)
        radius = rng.uniform(28, 48)
        return [[
            (
                50 + np.cos(index / 48 * end) * radius,
                50 + np.sin(index / 48 * end) * radius,
            )
            for index in range(49)
        ]]
    if mode == 3:
        template = rng.choice(list(class_templates.values()))
        strokes = _transform_template(template["strokes"], rng)
        if strokes and len(strokes) > 1:
            strokes.pop(rng.randrange(len(strokes)))
        elif strokes and len(strokes[0]) > 8:
            stroke = strokes[0]
            start = rng.randint(1, len(stroke) // 3)
            end = rng.randint(max(start + 1, len(stroke) // 2), len(stroke) - 1)
            strokes[0] = stroke[:start] + stroke[end:]
        return strokes
    if mode == 4:
        return [
            [
                (rng.uniform(10, 90), rng.uniform(10, 90)),
                (rng.uniform(10, 90), rng.uniform(10, 90)),
            ]
            for _ in range(rng.randint(4, 12))
        ]
    if mode == 5:
        first, second = rng.sample(list(class_templates.values()), 2)
        first_strokes = _transform_template(first["strokes"], rng)
        second_strokes = _transform_template(second["strokes"], rng)
        return first_strokes[: max(1, len(first_strokes) // 2)] + second_strokes[
            : max(1, len(second_strokes) // 2)
        ]
    if mode == 6:
        template = rng.choice(list(class_templates.values()))
        strokes = _transform_template(template["strokes"], rng)
        strokes.extend([
            [
                (rng.uniform(10, 90), rng.uniform(10, 90)),
                (rng.uniform(10, 90), rng.uniform(10, 90)),
            ]
            for _ in range(rng.randint(2, 5))
        ])
        return strokes

    template = rng.choice(list(negative_templates.values()))
    strokes = _transform_template(template["strokes"], rng)
    return strokes


def _load_human_samples(
    path: Path | None,
    classes: list[str],
) -> list[tuple[str, list[Stroke]]]:
    if not path or not path.exists():
        return []
    samples: list[tuple[str, list[Stroke]]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        payload = json.loads(line)
        label = payload.get("label")
        if label not in classes or label == "UNKNOWN":
            raise RuntimeError(f'Human sample has invalid label "{label}".')
        sample_catalog_version = payload.get("catalogVersion")
        if (
            sample_catalog_version is not None
            and sample_catalog_version != load_catalog_version()
        ):
            raise RuntimeError(
                f"Human sample catalog {sample_catalog_version} does not match "
                f"{load_catalog_version()}."
            )
        strokes = [
            [(float(point["x"]), float(point["y"])) for point in stroke["points"]]
            for stroke in payload["strokes"]
        ]
        normalized = _normalize_strokes(strokes)
        if not normalized:
            raise RuntimeError("Human sample does not contain drawable points.")
        samples.append((label, normalized))
    return samples


def _topology_counts(strokes: list[Stroke]) -> tuple[int, int]:
    loops = 0
    open_strokes = 0
    for stroke in strokes:
        if len(stroke) < 2:
            continue
        path_length = sum(
            float(np.hypot(
                stroke[index][0] - stroke[index - 1][0],
                stroke[index][1] - stroke[index - 1][1],
            ))
            for index in range(1, len(stroke))
        )
        if path_length <= 0:
            continue
        closure_distance = float(np.hypot(
            stroke[-1][0] - stroke[0][0],
            stroke[-1][1] - stroke[0][1],
        ))
        closure_score = max(0.0, min(1.0, 1 - closure_distance / path_length))
        if closure_score >= 0.85:
            loops += 1
        else:
            open_strokes += 1
    return loops, open_strokes


def _make_split(
    split: str,
    samples_per_class: int,
    classes: list[str],
    class_templates: dict[str, dict],
    negative_templates: dict[str, dict],
    human_samples: list[tuple[str, list[Stroke]]],
    unknown_multiplier: int,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    rng = random.Random(f"{SEED}:{split}")
    images: list[np.ndarray] = []
    labels: list[int] = []
    stroke_counts: list[int] = []
    loop_counts: list[int] = []
    open_stroke_counts: list[int] = []
    class_to_index = {label: index for index, label in enumerate(classes)}

    for label in classes:
        class_sample_count = (
            samples_per_class * unknown_multiplier
            if label == "UNKNOWN"
            else samples_per_class
        )
        for _ in range(class_sample_count):
            strokes = (
                _unknown_strokes(rng, class_templates, negative_templates)
                if label == "UNKNOWN"
                else _transform_template(class_templates[label]["strokes"], rng)
            )
            line_width = rng.uniform(3.0, 8.0)
            images.append(
                (rasterize_strokes(strokes, line_width=line_width) * 255).astype(np.uint8)
            )
            labels.append(class_to_index[label])
            stroke_counts.append(len(strokes))
            loops, open_strokes = _topology_counts(strokes)
            loop_counts.append(loops)
            open_stroke_counts.append(open_strokes)

    if split == "train":
        for label, strokes in human_samples:
            if label not in class_to_index:
                continue
            for _ in range(4):
                images.append(
                    (
                        rasterize_strokes(
                            _transform_template(
                                [[[x, y] for x, y in stroke] for stroke in strokes],
                                rng,
                            ),
                            line_width=rng.uniform(3.0, 8.0),
                        )
                        * 255
                    ).astype(np.uint8)
                )
                labels.append(class_to_index[label])
                stroke_counts.append(len(strokes))
                loops, open_strokes = _topology_counts(strokes)
                loop_counts.append(loops)
                open_stroke_counts.append(open_strokes)

    order = list(range(len(labels)))
    rng.shuffle(order)
    return (
        np.stack([images[index] for index in order]),
        np.array([labels[index] for index in order], dtype=np.int64),
        np.array([stroke_counts[index] for index in order], dtype=np.int16),
        np.array([loop_counts[index] for index in order], dtype=np.int16),
        np.array([open_stroke_counts[index] for index in order], dtype=np.int16),
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--train-per-class", type=int, default=180)
    parser.add_argument("--val-per-class", type=int, default=36)
    parser.add_argument("--test-per-class", type=int, default=48)
    parser.add_argument("--human-jsonl", type=Path)
    parser.add_argument("--unknown-train-multiplier", type=int, default=8)
    parser.add_argument("--unknown-eval-multiplier", type=int, default=4)
    parser.add_argument(
        "--split",
        choices=["all", "train", "val", "test"],
        default="all",
    )
    args = parser.parse_args()
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    classes = load_classes()
    templates = load_templates()
    class_templates = {
        class_id: templates[class_id]
        for class_id in classes
        if class_id != "UNKNOWN"
    }
    negative_templates = {
        template_id: templates[template_id]
        for template_id in load_unknown_negative_template_ids()
    }
    if not negative_templates:
        raise RuntimeError("UNKNOWN generation requires explicit negative templates.")
    human_samples = _load_human_samples(args.human_jsonl, classes)
    generation_spec = {
        "datasetSchemaVersion": DATASET_SCHEMA_VERSION,
        "catalogVersion": load_catalog_version(),
        "classManifestSha256": class_manifest_sha256(classes),
        "glyphTemplatesSha256": file_sha256(GLYPH_TEMPLATE_PATH),
        "runeManifestSha256": file_sha256(RUNE_MANIFEST_PATH),
        "generatorSha256": file_sha256(Path(__file__)),
        "rasterizerSha256": file_sha256(Path(__file__).with_name("rasterizer.py")),
        "seed": SEED,
        "raster": {
            "size": RASTER_SIZE,
            "padding": RASTER_PADDING,
            "lineWidth": RASTER_LINE_WIDTH,
        },
        "samplesPerClass": {
            "train": args.train_per_class,
            "val": args.val_per_class,
            "test": args.test_per_class,
        },
        "unknownMultiplier": {
            "train": args.unknown_train_multiplier,
            "eval": args.unknown_eval_multiplier,
        },
        "humanSamplesSha256": (
            file_sha256(args.human_jsonl)
            if args.human_jsonl and args.human_jsonl.exists()
            else None
        ),
    }
    generation_spec_json = json.dumps(
        generation_spec,
        sort_keys=True,
        separators=(",", ":"),
    )
    generation_spec_sha256 = hashlib.sha256(
        generation_spec_json.encode("utf-8")
    ).hexdigest()
    split_hashes: dict[str, str] = {}

    split_counts = (
        ("train", args.train_per_class),
        ("val", args.val_per_class),
        ("test", args.test_per_class),
    )
    for split, count in split_counts:
        if args.split != "all" and args.split != split:
            continue
        images, labels, stroke_counts, loop_counts, open_stroke_counts = _make_split(
            split,
            count,
            classes,
            class_templates,
            negative_templates,
            human_samples,
            args.unknown_train_multiplier if split == "train" else args.unknown_eval_multiplier,
        )
        split_path = DATA_DIR / f"{split}.npz"
        np.savez_compressed(
            split_path,
            images=images,
            labels=labels,
            stroke_counts=stroke_counts,
            loop_counts=loop_counts,
            open_stroke_counts=open_stroke_counts,
            classes=np.array(classes),
            catalog_version=np.array(load_catalog_version()),
            dataset_schema_version=np.array(DATASET_SCHEMA_VERSION),
            generation_spec_sha256=np.array(generation_spec_sha256),
            class_manifest_sha256=np.array(class_manifest_sha256(classes)),
        )
        split_hashes[split] = file_sha256(split_path)
        print(f"{split}: {len(labels)} samples")

    (DATA_DIR / "dataset-manifest.json").write_text(
        json.dumps(
            {
                **generation_spec,
                "generationSpecSha256": generation_spec_sha256,
                "splitSha256": split_hashes,
            },
            indent=2,
        ),
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
