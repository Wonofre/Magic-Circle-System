import { distance } from "@/lib/geometry/circleFit";
import type {
  ChannelInstanceV2,
  CircleInstanceV2,
  KeyInstanceV2,
  MandalaSymmetryScoreV2,
  MagicPointV2,
} from "@/types/magicFormulaV2";

const clamp = (value: number, min = 0, max = 1): number =>
  Math.max(min, Math.min(max, value));

const normalizeAngle = (angle: number): number => {
  const normalized = angle % 360;
  return normalized < 0 ? normalized + 360 : normalized;
};

const angleFromCenter = (center: MagicPointV2, point: MagicPointV2): number =>
  normalizeAngle((Math.atan2(point.y - center.y, point.x - center.x) * 180) / Math.PI);

const scoreKeySpacing = (keys: readonly KeyInstanceV2[], center: MagicPointV2): number => {
  if (keys.length <= 1) return keys.length === 1 ? 0.72 : 0;
  const angles = keys.map((key) => angleFromCenter(center, key.center)).sort((a, b) => a - b);
  const expected = 360 / keys.length;
  const gaps = angles.map((angle, index) => normalizeAngle((angles[(index + 1) % angles.length] ?? angle) - angle));
  const error = gaps.reduce((sum, gap) => sum + Math.abs(gap - expected), 0) / Math.max(1, gaps.length);
  return clamp(1 - error / 120);
};

const scoreRadialBalance = (keys: readonly KeyInstanceV2[], center: MagicPointV2): number => {
  if (keys.length === 0) return 0;
  const vector = keys.reduce(
    (total, key) => {
      const angle = (angleFromCenter(center, key.center) / 180) * Math.PI;
      return { x: total.x + Math.cos(angle), y: total.y + Math.sin(angle) };
    },
    { x: 0, y: 0 },
  );
  return clamp(1 - Math.hypot(vector.x, vector.y) / Math.max(1, keys.length));
};

const scoreCircleConcentricity = (
  circles: readonly CircleInstanceV2[],
  center: MagicPointV2,
): number => {
  if (circles.length === 0) return 0;
  const average = circles.reduce((sum, circle) => {
    const tolerance = Math.max(1, circle.radius * 0.28);
    return sum + clamp(1 - distance(circle.center, center) / tolerance);
  }, 0) / circles.length;
  return clamp(average);
};

const scoreMirrorBalance = (keys: readonly KeyInstanceV2[], center: MagicPointV2): number => {
  if (keys.length <= 1) return keys.length === 1 ? 0.62 : 0;
  const scores = keys.map((key) => {
    const mirrored = { x: center.x - (key.center.x - center.x), y: key.center.y };
    const closest = Math.min(...keys.map((candidate) => distance(candidate.center, mirrored)));
    return clamp(1 - closest / 42);
  });
  return scores.reduce((sum, score) => sum + score, 0) / Math.max(1, scores.length);
};

export const calculateMandalaSymmetryScoreV2 = ({
  keys,
  circles,
  channels,
  center,
  strokeCleanliness,
}: {
  readonly keys: readonly KeyInstanceV2[];
  readonly circles: readonly CircleInstanceV2[];
  readonly channels: readonly ChannelInstanceV2[];
  readonly center: MagicPointV2;
  readonly strokeCleanliness: number;
}): MandalaSymmetryScoreV2 => {
  const radialBalance = scoreRadialBalance(keys, center);
  const keyAngularSpacing = scoreKeySpacing(keys, center);
  const circleConcentricity = scoreCircleConcentricity(circles, center);
  const channelArcRegularity =
    channels.length === 0
      ? keys.length > 1 ? 0.25 : 0.65
      : channels.reduce((sum, channel) => sum + channel.quality, 0) / channels.length;
  const mirrorBalance = scoreMirrorBalance(keys, center);
  const cleanliness = clamp(strokeCleanliness);
  const overall =
    radialBalance * 0.22 +
    keyAngularSpacing * 0.18 +
    circleConcentricity * 0.18 +
    channelArcRegularity * 0.18 +
    mirrorBalance * 0.12 +
    cleanliness * 0.12;

  return {
    radialBalance: Number(radialBalance.toFixed(3)),
    keyAngularSpacing: Number(keyAngularSpacing.toFixed(3)),
    circleConcentricity: Number(circleConcentricity.toFixed(3)),
    channelArcRegularity: Number(channelArcRegularity.toFixed(3)),
    mirrorBalance: Number(mirrorBalance.toFixed(3)),
    strokeCleanliness: Number(cleanliness.toFixed(3)),
    overall: Number(clamp(overall).toFixed(3)),
  };
};
