import type {
  RecognitionPoint,
  RecognitionStroke,
  ScribbleDetectionMetrics,
  ScribbleDetectionResult,
  ScribbleDetectorThresholds,
} from "@/types/recognition";
import { dedupeStrokePoints, getStrokeBounds } from "@/lib/recognizer/normalizeStrokes";
import { getStrokePathLength } from "@/lib/recognizer/resampleStrokes";

export const DEFAULT_SCRIBBLE_THRESHOLDS: ScribbleDetectorThresholds = {
  minPointCount: 5,
  minDrawableSize: 4,
  minPathLength: 8,
  maxStrokeCount: 24,
  maxDuplicatePointRatio: 0.45,
  maxEmptyStrokeRatio: 0.5,
  maxTinyStrokeRatio: 0.65,
  maxPathToDiagonalRatio: 18,
  maxIntersectionCount: 32,
  maxIntersectionDensity: 0.18,
  minTinyStrokeLength: 3,
};

interface Segment {
  readonly start: RecognitionPoint;
  readonly end: RecognitionPoint;
  readonly strokeIndex: number;
  readonly segmentIndex: number;
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const getSegments = (strokes: readonly RecognitionStroke[]): Segment[] => {
  const segments: Segment[] = [];

  strokes.forEach((stroke, strokeIndex) => {
    for (let segmentIndex = 1; segmentIndex < stroke.points.length; segmentIndex += 1) {
      segments.push({
        start: stroke.points[segmentIndex - 1],
        end: stroke.points[segmentIndex],
        strokeIndex,
        segmentIndex: segmentIndex - 1,
      });
    }
  });

  return segments;
};

const orientation = (
  a: RecognitionPoint,
  b: RecognitionPoint,
  c: RecognitionPoint,
): number => (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);

const overlapsRange = (a: number, b: number, c: number): boolean =>
  Math.min(a, c) <= b && b <= Math.max(a, c);

const isPointOnSegment = (
  a: RecognitionPoint,
  b: RecognitionPoint,
  c: RecognitionPoint,
): boolean =>
  overlapsRange(a.x, b.x, c.x) &&
  overlapsRange(a.y, b.y, c.y) &&
  Math.abs(orientation(a, b, c)) < 1e-9;

const segmentsIntersect = (first: Segment, second: Segment): boolean => {
  const p1 = first.start;
  const q1 = first.end;
  const p2 = second.start;
  const q2 = second.end;
  const o1 = orientation(p1, q1, p2);
  const o2 = orientation(p1, q1, q2);
  const o3 = orientation(p2, q2, p1);
  const o4 = orientation(p2, q2, q1);

  if (o1 * o2 < 0 && o3 * o4 < 0) {
    return true;
  }

  return (
    (o1 === 0 && isPointOnSegment(p1, p2, q1)) ||
    (o2 === 0 && isPointOnSegment(p1, q2, q1)) ||
    (o3 === 0 && isPointOnSegment(p2, p1, q2)) ||
    (o4 === 0 && isPointOnSegment(p2, q1, q2))
  );
};

const areAdjacentSegments = (first: Segment, second: Segment): boolean =>
  first.strokeIndex === second.strokeIndex &&
  Math.abs(first.segmentIndex - second.segmentIndex) <= 1;

const countApproximateIntersections = (strokes: readonly RecognitionStroke[]): number => {
  const segments = getSegments(strokes);
  let intersections = 0;

  for (let firstIndex = 0; firstIndex < segments.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < segments.length; secondIndex += 1) {
      const first = segments[firstIndex];
      const second = segments[secondIndex];

      if (!areAdjacentSegments(first, second) && segmentsIntersect(first, second)) {
        intersections += 1;
      }
    }
  }

  return intersections;
};

const getMetrics = (
  strokes: readonly RecognitionStroke[],
  thresholds: ScribbleDetectorThresholds,
): ScribbleDetectionMetrics => {
  const cleanedStrokes = strokes.map((stroke) => ({
    ...stroke,
    points: dedupeStrokePoints(stroke.points),
  }));
  const nonEmptyStrokes = cleanedStrokes.filter((stroke) => stroke.points.length > 0);
  const pointCount = strokes.reduce((sum, stroke) => sum + stroke.points.length, 0);
  const dedupedPointCount = nonEmptyStrokes.reduce((sum, stroke) => sum + stroke.points.length, 0);
  const duplicatePointRatio =
    pointCount === 0 ? 0 : clamp01((pointCount - dedupedPointCount) / pointCount);
  const emptyStrokeRatio =
    strokes.length === 0
      ? 0
      : strokes.filter((stroke) => stroke.points.length === 0).length / strokes.length;
  const strokeLengths = nonEmptyStrokes.map((stroke) => getStrokePathLength(stroke.points));
  const totalPathLength = strokeLengths.reduce((sum, length) => sum + length, 0);
  const tinyStrokeRatio =
    nonEmptyStrokes.length === 0
      ? 0
      : strokeLengths.filter((length) => length < thresholds.minTinyStrokeLength).length /
        nonEmptyStrokes.length;
  const bounds = getStrokeBounds(nonEmptyStrokes);
  const boundsDiagonal = bounds ? Math.hypot(bounds.width, bounds.height) : 0;
  const boundsArea = bounds ? Math.max(1, bounds.width * bounds.height) : 1;
  const approximateIntersectionCount = countApproximateIntersections(nonEmptyStrokes);
  const segmentCount = Math.max(1, dedupedPointCount - nonEmptyStrokes.length);

  return {
    strokeCount: strokes.length,
    pointCount,
    dedupedPointCount,
    duplicatePointRatio,
    emptyStrokeRatio,
    tinyStrokeRatio,
    bounds,
    totalPathLength,
    boundsDiagonal,
    pathToDiagonalRatio: boundsDiagonal === 0 ? 0 : totalPathLength / boundsDiagonal,
    pointDensity: dedupedPointCount / boundsArea,
    approximateIntersectionCount,
    intersectionDensity: approximateIntersectionCount / segmentCount,
  };
};

export const detectScribble = (
  strokes: readonly RecognitionStroke[],
  thresholds: Partial<ScribbleDetectorThresholds> = {},
): ScribbleDetectionResult => {
  const activeThresholds = {
    ...DEFAULT_SCRIBBLE_THRESHOLDS,
    ...thresholds,
  };
  const metrics = getMetrics(strokes, activeThresholds);
  const scribbleReasons: string[] = [];
  const unknownReasons: string[] = [];

  if (metrics.pointCount === 0) {
    scribbleReasons.push("empty_drawing");
  }

  if (metrics.dedupedPointCount < activeThresholds.minPointCount) {
    scribbleReasons.push("too_few_points");
  }

  if (
    metrics.bounds &&
    Math.max(metrics.bounds.width, metrics.bounds.height) < activeThresholds.minDrawableSize
  ) {
    scribbleReasons.push("drawing_too_small");
  }

  if (metrics.totalPathLength > 0 && metrics.totalPathLength < activeThresholds.minPathLength) {
    scribbleReasons.push("path_too_short");
  }

  if (metrics.strokeCount > activeThresholds.maxStrokeCount) {
    unknownReasons.push("too_many_strokes");
  }

  if (metrics.duplicatePointRatio > activeThresholds.maxDuplicatePointRatio) {
    unknownReasons.push("too_many_duplicate_points");
  }

  if (metrics.emptyStrokeRatio > activeThresholds.maxEmptyStrokeRatio) {
    unknownReasons.push("too_many_empty_strokes");
  }

  if (metrics.tinyStrokeRatio > activeThresholds.maxTinyStrokeRatio) {
    unknownReasons.push("too_many_tiny_strokes");
  }

  if (metrics.pathToDiagonalRatio > activeThresholds.maxPathToDiagonalRatio) {
    scribbleReasons.push("excessive_overtrace");
  }

  if (
    metrics.approximateIntersectionCount > activeThresholds.maxIntersectionCount ||
    metrics.intersectionDensity > activeThresholds.maxIntersectionDensity
  ) {
    scribbleReasons.push("too_many_self_intersections");
  }

  const outcome =
    scribbleReasons.length > 0 ? "scribble" : unknownReasons.length > 0 ? "unknown" : "candidate";
  const severity =
    scribbleReasons.length * 0.26 +
    unknownReasons.length * 0.14 +
    clamp01(metrics.intersectionDensity / activeThresholds.maxIntersectionDensity) * 0.25 +
    clamp01(metrics.pathToDiagonalRatio / activeThresholds.maxPathToDiagonalRatio) * 0.2 +
    metrics.duplicatePointRatio * 0.15;

  return {
    outcome,
    isRejected: outcome !== "candidate",
    score: clamp01(severity),
    reasons: [...scribbleReasons, ...unknownReasons],
    metrics,
    thresholds: activeThresholds,
  };
};
