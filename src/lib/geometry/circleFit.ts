import type { RecognitionStroke } from "@/types/recognition";
import type { CircleInstanceV2, CircleRole, MagicPointV2 } from "@/types/magicFormulaV2";

export interface CircleFitResult {
  readonly center: MagicPointV2;
  readonly radius: number;
  readonly closure: number;
  readonly roundness: number;
  readonly smoothness: number;
  readonly quality: number;
  readonly pathLength: number;
  readonly pointCount: number;
}

const clamp = (value: number, min = 0, max = 1): number =>
  Math.max(min, Math.min(max, value));

export const strokePoints = (stroke: RecognitionStroke): readonly MagicPointV2[] =>
  stroke.points.map((point) => ({ x: point.x, y: point.y, t: point.t }));

export const getPathLength = (points: readonly MagicPointV2[]): number => {
  let length = 0;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    length += Math.hypot(current.x - previous.x, current.y - previous.y);
  }
  return length;
};

export const distance = (a: MagicPointV2, b: MagicPointV2): number =>
  Math.hypot(a.x - b.x, a.y - b.y);

const averagePoint = (points: readonly MagicPointV2[]): MagicPointV2 => {
  const sum = points.reduce(
    (total, point) => ({ x: total.x + point.x, y: total.y + point.y }),
    { x: 0, y: 0 },
  );

  return {
    x: sum.x / Math.max(1, points.length),
    y: sum.y / Math.max(1, points.length),
  };
};

const getBoundsCenter = (points: readonly MagicPointV2[]): MagicPointV2 => {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);

  return {
    x: (Math.min(...xs) + Math.max(...xs)) / 2,
    y: (Math.min(...ys) + Math.max(...ys)) / 2,
  };
};

const solve3x3 = (
  matrix: readonly [readonly [number, number, number], readonly [number, number, number], readonly [number, number, number]],
  vector: readonly [number, number, number],
): readonly [number, number, number] | null => {
  const [a, b, c] = matrix;
  const det =
    a[0] * (b[1] * c[2] - b[2] * c[1]) -
    a[1] * (b[0] * c[2] - b[2] * c[0]) +
    a[2] * (b[0] * c[1] - b[1] * c[0]);

  if (Math.abs(det) < 0.000001) return null;

  const detX =
    vector[0] * (b[1] * c[2] - b[2] * c[1]) -
    a[1] * (vector[1] * c[2] - b[2] * vector[2]) +
    a[2] * (vector[1] * c[1] - b[1] * vector[2]);
  const detY =
    a[0] * (vector[1] * c[2] - b[2] * vector[2]) -
    vector[0] * (b[0] * c[2] - b[2] * c[0]) +
    a[2] * (b[0] * vector[2] - vector[1] * c[0]);
  const detZ =
    a[0] * (b[1] * vector[2] - vector[1] * c[1]) -
    a[1] * (b[0] * vector[2] - vector[1] * c[0]) +
    vector[0] * (b[0] * c[1] - b[1] * c[0]);

  return [detX / det, detY / det, detZ / det];
};

export const fitCircleAlgebraic = (
  points: readonly MagicPointV2[],
): { readonly center: MagicPointV2; readonly radius: number } | null => {
  if (points.length < 3) return null;

  const sums = points.reduce<{
    x: number;
    y: number;
    x2: number;
    y2: number;
    xy: number;
    x3: number;
    y3: number;
    x2y: number;
    xy2: number;
  }>(
    (total, point) => {
      const x2 = point.x ** 2;
      const y2 = point.y ** 2;
      return {
        x: total.x + point.x,
        y: total.y + point.y,
        x2: total.x2 + x2,
        y2: total.y2 + y2,
        xy: total.xy + point.x * point.y,
        x3: total.x3 + x2 * point.x,
        y3: total.y3 + y2 * point.y,
        x2y: total.x2y + x2 * point.y,
        xy2: total.xy2 + point.x * y2,
      };
    },
    { x: 0, y: 0, x2: 0, y2: 0, xy: 0, x3: 0, y3: 0, x2y: 0, xy2: 0 },
  );
  const solution = solve3x3(
    [
      [sums.x2, sums.xy, sums.x],
      [sums.xy, sums.y2, sums.y],
      [sums.x, sums.y, points.length],
    ],
    [
      -(sums.x3 + sums.xy2),
      -(sums.x2y + sums.y3),
      -(sums.x2 + sums.y2),
    ],
  );

  if (!solution) return null;
  const [d, e, f] = solution;
  const center = { x: -d / 2, y: -e / 2 };
  const radiusSquared = (d ** 2 + e ** 2) / 4 - f;
  if (!Number.isFinite(radiusSquared) || radiusSquared <= 0) return null;

  return { center, radius: Math.sqrt(radiusSquared) };
};

export const fitCircleToPoints = (points: readonly MagicPointV2[]): CircleFitResult | null => {
  if (points.length < 8) return null;

  const average = averagePoint(points);
  const boundsCenter = getBoundsCenter(points);
  const algebraic = fitCircleAlgebraic(points);
  const center = {
    x: algebraic ? algebraic.center.x : (average.x + boundsCenter.x) / 2,
    y: algebraic ? algebraic.center.y : (average.y + boundsCenter.y) / 2,
  };
  const distances = points.map((point) => distance(point, center));
  const radius = distances.reduce((sum, value) => sum + value, 0) / Math.max(1, distances.length);
  if (!Number.isFinite(radius) || radius < 3) return null;

  const variance =
    distances.reduce((sum, value) => sum + (value - radius) ** 2, 0) / Math.max(1, distances.length);
  const stdev = Math.sqrt(variance);
  const pathLength = getPathLength(points);
  const first = points[0];
  const last = points[points.length - 1];
  const endpointDistance = first && last ? distance(first, last) : Infinity;
  const closure = clamp(1 - endpointDistance / Math.max(1, radius * 0.82));
  const roundness = clamp(1 - stdev / Math.max(1, radius * 0.36));
  const circumference = Math.PI * 2 * radius;
  const pathRatio = pathLength / Math.max(1, circumference);
  const smoothness = clamp(1 - Math.abs(1 - pathRatio) * 0.72);
  const quality = clamp(closure * 0.36 + roundness * 0.42 + smoothness * 0.22);

  return {
    center,
    radius,
    closure,
    roundness,
    smoothness,
    quality,
    pathLength,
    pointCount: points.length,
  };
};

export const fitCircleToStroke = (stroke: RecognitionStroke): CircleFitResult | null =>
  fitCircleToPoints(strokePoints(stroke));

export const isCircleLike = (
  fit: CircleFitResult | null,
  options: { readonly minClosure?: number; readonly minRoundness?: number; readonly minQuality?: number } = {},
): fit is CircleFitResult => {
  if (!fit) return false;
  return (
    fit.closure >= (options.minClosure ?? 0.58) &&
    fit.roundness >= (options.minRoundness ?? 0.46) &&
    fit.quality >= (options.minQuality ?? 0.54)
  );
};

export const makeCircleInstance = ({
  id,
  role,
  fit,
  concentricity,
  strokeIds,
}: {
  readonly id: string;
  readonly role: CircleRole;
  readonly fit: CircleFitResult;
  readonly concentricity: number;
  readonly strokeIds: readonly string[];
}): CircleInstanceV2 => ({
  id,
  role,
  center: {
    x: Number(fit.center.x.toFixed(2)),
    y: Number(fit.center.y.toFixed(2)),
  },
  radius: Number(fit.radius.toFixed(2)),
  closure: Number(fit.closure.toFixed(3)),
  roundness: Number(fit.roundness.toFixed(3)),
  smoothness: Number(fit.smoothness.toFixed(3)),
  concentricity: Number(concentricity.toFixed(3)),
  quality: Number(fit.quality.toFixed(3)),
  strokeIds,
});

export const pointDistanceFromCircle = (point: MagicPointV2, circle: CircleInstanceV2): number =>
  Math.abs(distance(point, circle.center) - circle.radius);

export const pointInsideCircle = (point: MagicPointV2, circle: CircleInstanceV2, padding = 0): boolean =>
  distance(point, circle.center) <= circle.radius + padding;
