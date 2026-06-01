import type {
  NormalizedRecognitionPoint,
  NormalizedRecognitionStroke,
  RecognitionBounds,
  RecognitionPoint,
  RecognitionStroke,
  StrokeNormalizationOptions,
  StrokeNormalizationResult,
} from "@/types/recognition";

const DEFAULT_SIZE = 100;
const DEFAULT_PADDING = 0;

const isFinitePoint = (point: RecognitionPoint): boolean =>
  Number.isFinite(point.x) && Number.isFinite(point.y);

const pointsEqual = (a: RecognitionPoint, b: RecognitionPoint): boolean =>
  a.x === b.x && a.y === b.y && a.t === b.t;

export const dedupeStrokePoints = <TPoint extends RecognitionPoint>(
  points: readonly TPoint[],
): TPoint[] => {
  const deduped: TPoint[] = [];

  for (const point of points) {
    if (!isFinitePoint(point)) {
      continue;
    }

    const previous = deduped[deduped.length - 1];
    if (!previous || !pointsEqual(previous, point)) {
      deduped.push(point);
    }
  }

  return deduped;
};

export const getStrokeBounds = (
  strokes: readonly RecognitionStroke[],
): RecognitionBounds | null => {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let foundPoint = false;

  for (const stroke of strokes) {
    for (const point of stroke.points) {
      if (!isFinitePoint(point)) {
        continue;
      }

      foundPoint = true;
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
  }

  if (!foundPoint) {
    return null;
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
};

const getNormalizedPointBounds = (
  strokes: readonly NormalizedRecognitionStroke[],
): RecognitionBounds | null => getStrokeBounds(strokes);

const normalizePoint = (
  point: RecognitionPoint,
  sourceBounds: RecognitionBounds,
  scaleX: number,
  scaleY: number,
  offsetX: number,
  offsetY: number,
): NormalizedRecognitionPoint => ({
  ...point,
  x: offsetX + (point.x - sourceBounds.minX) * scaleX,
  y: offsetY + (point.y - sourceBounds.minY) * scaleY,
  sourceX: point.x,
  sourceY: point.y,
  pressure: point.pressure,
  t: point.t,
});

export const normalizeStrokes = <TStroke extends RecognitionStroke>(
  strokes: readonly TStroke[],
  options: StrokeNormalizationOptions = {},
): StrokeNormalizationResult => {
  const targetSize = options.size ?? DEFAULT_SIZE;
  const padding = options.padding ?? DEFAULT_PADDING;
  const preserveAspectRatio = options.preserveAspectRatio ?? true;
  const drawableSize = Math.max(0, targetSize - padding * 2);

  const cleanedStrokes = strokes
    .map((stroke) => ({
      ...stroke,
      points: dedupeStrokePoints(stroke.points),
      sourcePointCount: stroke.points.length,
    }))
    .filter((stroke) => stroke.points.length > 0);

  const sourceBounds = getStrokeBounds(cleanedStrokes);

  if (!sourceBounds || drawableSize === 0) {
    return {
      strokes: [],
      sourceBounds,
      normalizedBounds: null,
      sourcePointCount: strokes.reduce((count, stroke) => count + stroke.points.length, 0),
      normalizedPointCount: 0,
      scaleX: 0,
      scaleY: 0,
    };
  }

  const safeWidth = sourceBounds.width === 0 ? 1 : sourceBounds.width;
  const safeHeight = sourceBounds.height === 0 ? 1 : sourceBounds.height;
  const rawScaleX = drawableSize / safeWidth;
  const rawScaleY = drawableSize / safeHeight;
  const uniformScale = Math.min(rawScaleX, rawScaleY);
  const scaleX = preserveAspectRatio ? uniformScale : rawScaleX;
  const scaleY = preserveAspectRatio ? uniformScale : rawScaleY;
  const normalizedWidth = sourceBounds.width * scaleX;
  const normalizedHeight = sourceBounds.height * scaleY;
  const offsetX = padding + (drawableSize - normalizedWidth) / 2;
  const offsetY = padding + (drawableSize - normalizedHeight) / 2;

  const normalizedStrokes: NormalizedRecognitionStroke[] = cleanedStrokes.map((stroke) => ({
    id: stroke.id,
    timestamp: stroke.timestamp,
    sourcePointCount: stroke.sourcePointCount,
    points: stroke.points.map((point) =>
      normalizePoint(point, sourceBounds, scaleX, scaleY, offsetX, offsetY),
    ),
  }));

  return {
    strokes: normalizedStrokes,
    sourceBounds,
    normalizedBounds: getNormalizedPointBounds(normalizedStrokes),
    sourcePointCount: strokes.reduce((count, stroke) => count + stroke.points.length, 0),
    normalizedPointCount: normalizedStrokes.reduce(
      (count, stroke) => count + stroke.points.length,
      0,
    ),
    scaleX,
    scaleY,
  };
};
