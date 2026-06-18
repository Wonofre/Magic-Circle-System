from __future__ import annotations

from collections.abc import Sequence
from math import ceil, floor

import numpy as np

from .config import RASTER_LINE_WIDTH, RASTER_PADDING, RASTER_SIZE

Point = tuple[float, float]
Stroke = list[Point]


def _bounds(strokes: Sequence[Sequence[Point]]) -> tuple[float, float, float, float] | None:
    points = [point for stroke in strokes for point in stroke]
    if not points:
        return None
    xs = [point[0] for point in points]
    ys = [point[1] for point in points]
    return min(xs), min(ys), max(xs), max(ys)


def _project(
    strokes: Sequence[Sequence[Point]],
    bounds: tuple[float, float, float, float],
    size: int,
    padding: int,
) -> list[Stroke]:
    min_x, min_y, max_x, max_y = bounds
    width = max_x - min_x
    height = max_y - min_y
    drawable_size = max(1.0, size - padding * 2)
    source_size = max(1.0, width, height)
    scale = drawable_size / source_size
    drawn_width = width * scale
    drawn_height = height * scale
    offset_x = (size - drawn_width) / 2
    offset_y = (size - drawn_height) / 2
    return [
        [
            (
                offset_x + (point[0] - min_x) * scale,
                offset_y + (point[1] - min_y) * scale,
            )
            for point in stroke
        ]
        for stroke in strokes
    ]


def _distance_squared(px: float, py: float, start: Point, end: Point) -> float:
    dx = end[0] - start[0]
    dy = end[1] - start[1]
    length_squared = dx * dx + dy * dy
    if length_squared <= np.finfo(np.float64).eps:
        return (px - start[0]) ** 2 + (py - start[1]) ** 2
    projection = max(
        0.0,
        min(1.0, ((px - start[0]) * dx + (py - start[1]) * dy) / length_squared),
    )
    closest_x = start[0] + projection * dx
    closest_y = start[1] + projection * dy
    return (px - closest_x) ** 2 + (py - closest_y) ** 2


def _paint_segment(
    raster: np.ndarray,
    start: Point,
    end: Point,
    radius: float,
) -> None:
    size = raster.shape[0]
    min_x = max(0, floor(min(start[0], end[0]) - radius))
    max_x = min(size - 1, ceil(max(start[0], end[0]) + radius))
    min_y = max(0, floor(min(start[1], end[1]) - radius))
    max_y = min(size - 1, ceil(max(start[1], end[1]) + radius))
    radius_squared = radius * radius
    for y in range(min_y, max_y + 1):
        for x in range(min_x, max_x + 1):
            if _distance_squared(x + 0.5, y + 0.5, start, end) <= radius_squared:
                raster[y, x] = 1.0


def rasterize_strokes(
    strokes: Sequence[Sequence[Point]],
    *,
    size: int = RASTER_SIZE,
    padding: int = RASTER_PADDING,
    line_width: float = RASTER_LINE_WIDTH,
) -> np.ndarray:
    raster = np.zeros((size, size), dtype=np.float32)
    bounds = _bounds(strokes)
    if bounds is None:
        return raster
    projected = _project(strokes, bounds, size, padding)
    radius = max(0.5, line_width / 2)
    for stroke in projected:
        if len(stroke) == 1:
            _paint_segment(raster, stroke[0], stroke[0], radius)
            continue
        for index in range(1, len(stroke)):
            _paint_segment(raster, stroke[index - 1], stroke[index], radius)
    return raster
