import { distance, fitCircleAlgebraic, getPathLength } from "@/lib/geometry/circleFit";
import type { RecognitionStroke } from "@/types/recognition";
import type { ChannelGeometry, MagicPointV2 } from "@/types/magicFormulaV2";

export interface ArcFitResult {
  readonly center?: MagicPointV2;
  readonly radius?: number;
  readonly curvatureScore: number;
  readonly regularityScore: number;
  readonly geometry: ChannelGeometry;
  readonly meanError: number;
}

const clamp = (value: number, min = 0, max = 1): number =>
  Math.max(min, Math.min(max, value));

const pointFromStroke = (stroke: RecognitionStroke, index: number): MagicPointV2 | undefined => {
  const point = stroke.points[index];
  return point ? { x: point.x, y: point.y, t: point.t } : undefined;
};

const getThreePoints = (stroke: RecognitionStroke): readonly [MagicPointV2, MagicPointV2, MagicPointV2] | null => {
  const first = pointFromStroke(stroke, 0);
  const middle = pointFromStroke(stroke, Math.floor(stroke.points.length / 2));
  const last = pointFromStroke(stroke, stroke.points.length - 1);
  if (!first || !middle || !last) return null;
  return [first, middle, last];
};

const circleFromThreePoints = (
  a: MagicPointV2,
  b: MagicPointV2,
  c: MagicPointV2,
): { readonly center: MagicPointV2; readonly radius: number } | null => {
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (Math.abs(d) < 0.001) return null;

  const a2 = a.x ** 2 + a.y ** 2;
  const b2 = b.x ** 2 + b.y ** 2;
  const c2 = c.x ** 2 + c.y ** 2;
  const center = {
    x: (a2 * (b.y - c.y) + b2 * (c.y - a.y) + c2 * (a.y - b.y)) / d,
    y: (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / d,
  };
  const radius = distance(center, a);
  if (!Number.isFinite(radius) || radius <= 0) return null;
  return { center, radius };
};

const normalizeDeltaRadians = (value: number): number => {
  let delta = value;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
};

const angularTravel = (points: readonly MagicPointV2[], center: MagicPointV2): number => {
  let travel = 0;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const previousAngle = Math.atan2(previous.y - center.y, previous.x - center.x);
    const currentAngle = Math.atan2(current.y - center.y, current.x - center.x);
    travel += Math.abs(normalizeDeltaRadians(currentAngle - previousAngle));
  }
  return travel;
};

export const fitArcToStroke = (stroke: RecognitionStroke): ArcFitResult => {
  const points = stroke.points.map((point) => ({ x: point.x, y: point.y, t: point.t }));
  const three = getThreePoints(stroke);
  if (!three || points.length < 3) {
    return {
      curvatureScore: 0,
      regularityScore: 0,
      geometry: "invalid_straight",
      meanError: 1,
    };
  }

  const [first, middle, last] = three;
  const chord = Math.max(1, distance(first, last));
  const pathLength = getPathLength(points);
  const bend = Math.abs(
    (last.x - first.x) * (first.y - middle.y) -
      (first.x - middle.x) * (last.y - first.y),
  ) / chord;
  const curvatureScore = clamp((pathLength / chord - 1) * 1.45 + bend / Math.max(1, chord * 0.22));
  const circle = fitCircleAlgebraic(points) ?? circleFromThreePoints(first, middle, last);

  if (!circle) {
    return {
      curvatureScore,
      regularityScore: curvatureScore * 0.45,
      geometry: curvatureScore >= 0.18 ? "curved_radial" : "invalid_straight",
      meanError: 1 - curvatureScore,
    };
  }

  const errors = points.map((point) => Math.abs(distance(point, circle.center) - circle.radius));
  const meanError = errors.reduce((sum, value) => sum + value, 0) / Math.max(1, errors.length);
  const regularityScore = clamp(1 - meanError / Math.max(1, circle.radius * 0.24));
  const travel = angularTravel(points, circle.center);
  const geometry =
    curvatureScore < 0.12
      ? "invalid_straight"
      : regularityScore >= 0.58 && curvatureScore >= 0.28 && travel >= 0.48
        ? "orbital_arc"
      : regularityScore >= 0.42
        ? "circular_arc"
          : "curved_radial";

  return {
    center: {
      x: Number(circle.center.x.toFixed(2)),
      y: Number(circle.center.y.toFixed(2)),
    },
    radius: Number(circle.radius.toFixed(2)),
    curvatureScore: Number(curvatureScore.toFixed(3)),
    regularityScore: Number(regularityScore.toFixed(3)),
    geometry,
    meanError: Number(meanError.toFixed(3)),
  };
};
