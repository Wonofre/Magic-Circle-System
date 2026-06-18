import type {
  RecognitionBounds,
  RecognitionPoint,
  RecognitionStroke,
} from "@/types/recognition";

export interface GlyphRasterOptions {
  readonly size?: number;
  readonly padding?: number;
  readonly lineWidth?: number;
}

export interface GlyphRasterResult {
  readonly data: Float32Array;
  readonly width: number;
  readonly height: number;
  readonly bounds: RecognitionBounds | null;
}

export const DEFAULT_GLYPH_RASTER_SIZE = 128;
export const DEFAULT_GLYPH_RASTER_PADDING = 12;
export const DEFAULT_GLYPH_RASTER_LINE_WIDTH = 5;

export const getRecognitionBounds = (
  strokes: readonly RecognitionStroke[],
): RecognitionBounds | null => {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let found = false;

  for (const stroke of strokes) {
    for (const point of stroke.points) {
      found = true;
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
  }

  if (!found) return null;

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
};

const projectStrokes = (
  strokes: readonly RecognitionStroke[],
  bounds: RecognitionBounds,
  size: number,
  padding: number,
): readonly (readonly RecognitionPoint[])[] => {
  const drawableSize = Math.max(1, size - padding * 2);
  const sourceSize = Math.max(1, bounds.width, bounds.height);
  const scale = drawableSize / sourceSize;
  const drawnWidth = bounds.width * scale;
  const drawnHeight = bounds.height * scale;
  const offsetX = (size - drawnWidth) / 2;
  const offsetY = (size - drawnHeight) / 2;

  return strokes.map((stroke) =>
    stroke.points.map((point) => ({
      x: offsetX + (point.x - bounds.minX) * scale,
      y: offsetY + (point.y - bounds.minY) * scale,
    })),
  );
};

const pointSegmentDistanceSquared = (
  px: number,
  py: number,
  start: RecognitionPoint,
  end: RecognitionPoint,
): number => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared <= Number.EPSILON) {
    return (px - start.x) ** 2 + (py - start.y) ** 2;
  }

  const projection = Math.max(
    0,
    Math.min(1, ((px - start.x) * dx + (py - start.y) * dy) / lengthSquared),
  );
  const closestX = start.x + projection * dx;
  const closestY = start.y + projection * dy;
  return (px - closestX) ** 2 + (py - closestY) ** 2;
};

const paintSegment = (
  raster: Float32Array,
  size: number,
  start: RecognitionPoint,
  end: RecognitionPoint,
  radius: number,
) => {
  const minX = Math.max(0, Math.floor(Math.min(start.x, end.x) - radius));
  const maxX = Math.min(size - 1, Math.ceil(Math.max(start.x, end.x) + radius));
  const minY = Math.max(0, Math.floor(Math.min(start.y, end.y) - radius));
  const maxY = Math.min(size - 1, Math.ceil(Math.max(start.y, end.y) + radius));
  const radiusSquared = radius * radius;

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (
        pointSegmentDistanceSquared(x + 0.5, y + 0.5, start, end) <=
        radiusSquared
      ) {
        raster[y * size + x] = 1;
      }
    }
  }
};

export const rasterizeGlyphStrokes = (
  strokes: readonly RecognitionStroke[],
  options: GlyphRasterOptions = {},
): GlyphRasterResult => {
  const size = options.size ?? DEFAULT_GLYPH_RASTER_SIZE;
  const padding = options.padding ?? DEFAULT_GLYPH_RASTER_PADDING;
  const lineWidth = options.lineWidth ?? DEFAULT_GLYPH_RASTER_LINE_WIDTH;
  const bounds = getRecognitionBounds(strokes);
  const data = new Float32Array(size * size);

  if (!bounds) {
    return { data, width: size, height: size, bounds: null };
  }

  const projected = projectStrokes(strokes, bounds, size, padding);
  const radius = Math.max(0.5, lineWidth / 2);

  for (const stroke of projected) {
    if (stroke.length === 1) {
      paintSegment(data, size, stroke[0], stroke[0], radius);
      continue;
    }

    for (let index = 1; index < stroke.length; index += 1) {
      paintSegment(data, size, stroke[index - 1], stroke[index], radius);
    }
  }

  return { data, width: size, height: size, bounds };
};
