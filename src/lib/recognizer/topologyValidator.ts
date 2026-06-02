import type { GlyphTemplate } from "@/types/glyphTemplates";
import type {
  RecognitionPoint,
  RecognitionStroke,
  TemplateMatchCandidate,
  TopologyStrokeMetric,
  TopologyValidationCheck,
  TopologyValidationMetrics,
  TopologyValidationOptions,
  TopologyValidationResult,
} from "@/types/recognition";
import { dedupeStrokePoints } from "@/lib/recognizer/normalizeStrokes";
import { getStrokePathLength } from "@/lib/recognizer/resampleStrokes";

const DEFAULT_CLOSURE_THRESHOLD = 0.9;
const DEFAULT_MIN_STROKE_LENGTH = 2;
const DEFAULT_NOISE_STROKE_LENGTH = 3;
const DEFAULT_INTERSECTION_TOLERANCE = 1;
const DEFAULT_MAX_NOISE_STROKE_RATIO = 0.35;
const CORNER_ANGLE_THRESHOLD = 0.72;
const TURN_ANGLE_THRESHOLD = 0.34;

interface Segment {
  readonly start: RecognitionPoint;
  readonly end: RecognitionPoint;
  readonly strokeIndex: number;
  readonly segmentIndex: number;
}

const distance = (a: RecognitionPoint, b: RecognitionPoint): number =>
  Math.hypot(b.x - a.x, b.y - a.y);

const getClosureScore = (points: readonly RecognitionPoint[], pathLength: number): number => {
  if (points.length < 2 || pathLength === 0) {
    return 0;
  }

  const closureDistance = distance(points[0], points[points.length - 1]);
  return Math.max(0, Math.min(1, 1 - closureDistance / pathLength));
};

const getClosureDistance = (points: readonly RecognitionPoint[]): number => {
  if (points.length < 2) {
    return Infinity;
  }

  return distance(points[0], points[points.length - 1]);
};

const getStrokeMetrics = (
  strokes: readonly RecognitionStroke[],
  closureThreshold: number,
  minStrokeLength: number,
  noiseStrokeLength: number,
): readonly TopologyStrokeMetric[] =>
  strokes.map((stroke, strokeIndex) => {
    const points = dedupeStrokePoints(stroke.points);
    const pathLength = getStrokePathLength(points);
    const closureDistance = getClosureDistance(points);
    const closureScore = getClosureScore(points, pathLength);
    const isNoise = points.length < 2 || pathLength < noiseStrokeLength;

    return {
      strokeIndex,
      pointCount: points.length,
      pathLength,
      closureDistance,
      closureScore,
      isClosed: !isNoise && pathLength >= minStrokeLength && closureScore >= closureThreshold,
      isNoise,
    };
  });

const getCleanedStrokes = (
  strokes: readonly RecognitionStroke[],
  metrics: readonly TopologyStrokeMetric[],
): readonly RecognitionStroke[] =>
  strokes
    .map((stroke, strokeIndex) => ({
      ...stroke,
      points: dedupeStrokePoints(stroke.points),
      metric: metrics[strokeIndex],
    }))
    .filter((stroke) => !stroke.metric.isNoise);

const getSegments = (strokes: readonly RecognitionStroke[]): Segment[] => {
  const segments: Segment[] = [];

  strokes.forEach((stroke, strokeIndex) => {
    for (let index = 1; index < stroke.points.length; index += 1) {
      segments.push({
        start: stroke.points[index - 1],
        end: stroke.points[index],
        strokeIndex,
        segmentIndex: index - 1,
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

const isOnRange = (a: number, b: number, c: number): boolean =>
  Math.min(a, c) <= b && b <= Math.max(a, c);

const isPointOnSegment = (
  a: RecognitionPoint,
  b: RecognitionPoint,
  c: RecognitionPoint,
): boolean =>
  isOnRange(a.x, b.x, c.x) &&
  isOnRange(a.y, b.y, c.y) &&
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

const pointsShareLocation = (first: RecognitionPoint, second: RecognitionPoint): boolean =>
  Math.hypot(first.x - second.x, first.y - second.y) < 0.001;

const segmentsShareEndpoint = (first: Segment, second: Segment): boolean =>
  pointsShareLocation(first.start, second.start) ||
  pointsShareLocation(first.start, second.end) ||
  pointsShareLocation(first.end, second.start) ||
  pointsShareLocation(first.end, second.end);

const countApproximateIntersections = (strokes: readonly RecognitionStroke[]): number => {
  const segments = getSegments(strokes);
  let count = 0;

  for (let firstIndex = 0; firstIndex < segments.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < segments.length; secondIndex += 1) {
      const first = segments[firstIndex];
      const second = segments[secondIndex];

      if (
        !areAdjacentSegments(first, second) &&
        !segmentsShareEndpoint(first, second) &&
        segmentsIntersect(first, second)
      ) {
        count += 1;
      }
    }
  }

  return count;
};

const angleBetweenSegments = (
  first: RecognitionPoint,
  middle: RecognitionPoint,
  last: RecognitionPoint,
): number => {
  const ax = middle.x - first.x;
  const ay = middle.y - first.y;
  const bx = last.x - middle.x;
  const by = last.y - middle.y;
  const aLength = Math.hypot(ax, ay);
  const bLength = Math.hypot(bx, by);

  if (aLength < 0.001 || bLength < 0.001) {
    return 0;
  }

  const dot = (ax * bx + ay * by) / (aLength * bLength);
  return Math.acos(Math.max(-1, Math.min(1, dot)));
};

const countAngles = (
  strokes: readonly RecognitionStroke[],
  angleThreshold: number,
): number => {
  let count = 0;

  for (const stroke of strokes) {
    for (let index = 1; index < stroke.points.length - 1; index += 1) {
      if (
        angleBetweenSegments(
          stroke.points[index - 1],
          stroke.points[index],
          stroke.points[index + 1],
        ) >= angleThreshold
      ) {
        count += 1;
      }
    }

    if (
      stroke.points.length > 3 &&
      pointsShareLocation(stroke.points[0], stroke.points[stroke.points.length - 1]) &&
      angleBetweenSegments(
        stroke.points[stroke.points.length - 2],
        stroke.points[0],
        stroke.points[1],
      ) >= angleThreshold
    ) {
      count += 1;
    }
  }

  return count;
};

const countExitMarkers = (strokes: readonly RecognitionStroke[]): number => {
  const segments = getSegments(strokes);

  return segments.filter((segment) => {
    const length = distance(segment.start, segment.end);
    if (length < 6) return false;

    const horizontal = Math.abs(segment.end.x - segment.start.x) >=
      Math.abs(segment.end.y - segment.start.y) * 1.6;
    const vertical = Math.abs(segment.end.y - segment.start.y) >=
      Math.abs(segment.end.x - segment.start.x) * 1.6;
    const nearOuterBand =
      segment.start.x < 18 ||
      segment.start.x > 82 ||
      segment.start.y < 18 ||
      segment.start.y > 82 ||
      segment.end.x < 18 ||
      segment.end.x > 82 ||
      segment.end.y < 18 ||
      segment.end.y > 82;

    return nearOuterBand && (horizontal || vertical);
  }).length;
};

const getMetrics = (
  strokes: readonly RecognitionStroke[],
  options: Required<TopologyValidationOptions>,
): TopologyValidationMetrics => {
  const strokeMetrics = getStrokeMetrics(
    strokes,
    options.closureThreshold,
    options.minStrokeLength,
    options.noiseStrokeLength,
  );
  const cleanStrokes = getCleanedStrokes(strokes, strokeMetrics);
  const nonNoiseStrokeCount = strokeMetrics.filter((metric) => !metric.isNoise).length;
  const loopCount = strokeMetrics.filter((metric) => metric.isClosed).length;
  const openStrokeCount = strokeMetrics.filter(
    (metric) => !metric.isNoise && !metric.isClosed,
  ).length;
  const noiseStrokeCount = strokeMetrics.filter((metric) => metric.isNoise).length;
  const averageClosureScore =
    nonNoiseStrokeCount === 0
      ? 0
      : strokeMetrics
          .filter((metric) => !metric.isNoise)
          .reduce((sum, metric) => sum + metric.closureScore, 0) / nonNoiseStrokeCount;

  return {
    strokeCount: strokes.length,
    nonNoiseStrokeCount,
    loopCount,
    openStrokeCount,
    noiseStrokeCount,
    noiseStrokeRatio: strokes.length === 0 ? 0 : noiseStrokeCount / strokes.length,
    approximateIntersectionCount: countApproximateIntersections(cleanStrokes),
    cornerCount: countAngles(cleanStrokes, CORNER_ANGLE_THRESHOLD),
    turnCount: countAngles(cleanStrokes, TURN_ANGLE_THRESHOLD),
    exitMarkerCount: countExitMarkers(cleanStrokes),
    averageClosureScore,
    strokeMetrics,
  };
};

const buildCheck = (
  id: string,
  passed: boolean,
  message: string,
  expected?: number | string | boolean,
  actual?: number | string | boolean,
): TopologyValidationCheck => ({
  id,
  status: passed ? "pass" : "fail",
  message,
  expected,
  actual,
});

const normalizeOptions = (
  template: GlyphTemplate,
  options: TopologyValidationOptions = {},
): Required<TopologyValidationOptions> => ({
  closureThreshold:
    options.closureThreshold ??
    template.topology_signature.closure_required ??
    DEFAULT_CLOSURE_THRESHOLD,
  minStrokeLength: options.minStrokeLength ?? DEFAULT_MIN_STROKE_LENGTH,
  noiseStrokeLength: options.noiseStrokeLength ?? DEFAULT_NOISE_STROKE_LENGTH,
  intersectionTolerance: options.intersectionTolerance ?? DEFAULT_INTERSECTION_TOLERANCE,
  maxNoiseStrokeRatio: options.maxNoiseStrokeRatio ?? DEFAULT_MAX_NOISE_STROKE_RATIO,
});

export const validateGlyphTopology = (
  strokes: readonly RecognitionStroke[],
  template: GlyphTemplate,
  options: TopologyValidationOptions = {},
): TopologyValidationResult => {
  const activeOptions = normalizeOptions(template, options);
  const expected = template.topology_signature;
  const metrics = getMetrics(strokes, activeOptions);
  const checks: TopologyValidationCheck[] = [];

  checks.push(
    buildCheck(
      "loops",
      metrics.loopCount === expected.loops,
      `Expected ${expected.loops} closed loop(s), found ${metrics.loopCount}.`,
      expected.loops,
      metrics.loopCount,
    ),
  );

  checks.push(
    buildCheck(
      "open_strokes",
      metrics.openStrokeCount === expected.open_strokes,
      `Expected ${expected.open_strokes} open stroke(s), found ${metrics.openStrokeCount}.`,
      expected.open_strokes,
      metrics.openStrokeCount,
    ),
  );

  if (expected.closure_required !== undefined && expected.loops > 0) {
    checks.push(
      buildCheck(
        "closure_required",
        metrics.averageClosureScore >= expected.closure_required,
        `Expected closure score >= ${expected.closure_required.toFixed(2)}, found ${metrics.averageClosureScore.toFixed(2)}.`,
        expected.closure_required,
        Number(metrics.averageClosureScore.toFixed(3)),
      ),
    );
  }

  if (expected.expected_intersections !== undefined) {
    const intersectionDelta = Math.abs(
      metrics.approximateIntersectionCount - expected.expected_intersections,
    );
    checks.push(
      buildCheck(
        "expected_intersections",
        intersectionDelta <= activeOptions.intersectionTolerance,
        `Expected about ${expected.expected_intersections} intersection(s), found ${metrics.approximateIntersectionCount}.`,
        expected.expected_intersections,
        metrics.approximateIntersectionCount,
      ),
    );
  }

  if (expected.corners_min !== undefined) {
    checks.push(
      buildCheck(
        "corners_min",
        metrics.cornerCount >= expected.corners_min,
        `Expected at least ${expected.corners_min} corner(s), found ${metrics.cornerCount}.`,
        expected.corners_min,
        metrics.cornerCount,
      ),
    );
  }

  if (expected.corners_max !== undefined) {
    checks.push(
      buildCheck(
        "corners_max",
        metrics.cornerCount <= expected.corners_max,
        `Expected at most ${expected.corners_max} corner(s), found ${metrics.cornerCount}.`,
        expected.corners_max,
        metrics.cornerCount,
      ),
    );
  }

  if (expected.turns_min !== undefined) {
    checks.push(
      buildCheck(
        "turns_min",
        metrics.turnCount >= expected.turns_min,
        `Expected at least ${expected.turns_min} turn(s), found ${metrics.turnCount}.`,
        expected.turns_min,
        metrics.turnCount,
      ),
    );
  }

  if (expected.requires_exit_marker) {
    checks.push(
      buildCheck(
        "exit_marker",
        metrics.exitMarkerCount > 0,
        `Expected an exit marker, found ${metrics.exitMarkerCount}.`,
        true,
        metrics.exitMarkerCount > 0,
      ),
    );
  }

  checks.push(
    buildCheck(
      "noise",
      metrics.noiseStrokeRatio <= activeOptions.maxNoiseStrokeRatio,
      `Expected noise stroke ratio <= ${activeOptions.maxNoiseStrokeRatio}, found ${metrics.noiseStrokeRatio.toFixed(2)}.`,
      activeOptions.maxNoiseStrokeRatio,
      Number(metrics.noiseStrokeRatio.toFixed(3)),
    ),
  );

  checks.push(
    buildCheck(
      "ports",
      template.ports.length === 0 || metrics.nonNoiseStrokeCount > 0,
      "Template ports require at least one drawable non-noise stroke.",
      template.ports.length > 0,
      metrics.nonNoiseStrokeCount > 0,
    ),
  );

  return {
    isValid: checks.every((check) => check.status === "pass"),
    template,
    checks,
    metrics,
  };
};

export const validateTemplateMatchTopology = (
  strokes: readonly RecognitionStroke[],
  candidate: TemplateMatchCandidate,
  options: TopologyValidationOptions = {},
): TopologyValidationResult => validateGlyphTopology(strokes, candidate.template, options);
