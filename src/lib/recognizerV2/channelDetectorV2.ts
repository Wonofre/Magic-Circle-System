import { fitArcToStroke } from "@/lib/geometry/arcFit";
import { distance, getPathLength } from "@/lib/geometry/circleFit";
import { magicCatalogV2 } from "@/data/magicCatalogV2";
import type { RecognitionStroke } from "@/types/recognition";
import type {
  ChannelInstanceV2,
  CircleInstanceV2,
  KeyInstanceV2,
  MagicPointV2,
  SigilInstanceV2,
} from "@/types/magicFormulaV2";

type SnapEntity =
  | {
      readonly kind: "key";
      readonly id: string;
      readonly center: MagicPointV2;
    }
  | {
      readonly kind: "sigil";
      readonly id: string;
      readonly center: MagicPointV2;
    }
  | {
      readonly kind: "containment";
      readonly id: string;
      readonly center: MagicPointV2;
      readonly radius: number;
    };

interface SnapResult {
  readonly entity: SnapEntity;
  readonly distance: number;
}

const clamp = (value: number, min = 0, max = 1): number =>
  Math.max(min, Math.min(max, value));

const strokeId = (stroke: RecognitionStroke, index: number): string =>
  stroke.id ?? `stroke:${index}`;

const endpoint = (stroke: RecognitionStroke, side: "start" | "end"): MagicPointV2 | null => {
  const point = side === "start" ? stroke.points[0] : stroke.points[stroke.points.length - 1];
  return point ? { x: point.x, y: point.y, t: point.t } : null;
};

const makeEntities = (
  sigils: readonly SigilInstanceV2[],
  keys: readonly KeyInstanceV2[],
  containment?: CircleInstanceV2,
): readonly SnapEntity[] => [
  ...keys.map((key): SnapEntity => ({ kind: "key", id: key.id, center: key.center })),
  ...(containment
    ? [{
        kind: "containment" as const,
        id: containment.id,
        center: containment.center,
        radius: containment.radius,
      }]
    : sigils.map((sigil): SnapEntity => ({ kind: "sigil", id: sigil.id, center: sigil.center }))),
];

const distanceToEntity = (point: MagicPointV2, entity: SnapEntity): number =>
  entity.kind === "containment"
    ? Math.abs(distance(point, entity.center) - entity.radius)
    : distance(point, entity.center);

const snapEndpoint = (
  point: MagicPointV2,
  entities: readonly SnapEntity[],
  snapRadius: number,
): SnapResult | null => {
  const ranked = entities
    .map((entity) => ({ entity, distance: distanceToEntity(point, entity) }))
    .sort((a, b) => a.distance - b.distance);
  const best = ranked[0];
  return best && best.distance <= snapRadius ? best : null;
};

const crossesCastingCircle = (stroke: RecognitionStroke, castingCircle: CircleInstanceV2): boolean =>
  stroke.points.some((point) => distance(point, castingCircle.center) > castingCircle.radius + 2);

const channelKind = (
  from: SnapEntity,
  to: SnapEntity,
): ChannelInstanceV2["kind"] | null => {
  if (from.kind === "key" && to.kind === "key") return "key_to_key";
  if (
    (from.kind === "key" && to.kind === "sigil") ||
    (from.kind === "sigil" && to.kind === "key")
  ) {
    return "key_to_sigil";
  }
  if (
    (from.kind === "key" && to.kind === "containment") ||
    (from.kind === "containment" && to.kind === "key")
  ) {
    return "key_to_containment";
  }
  return null;
};

const channelQuality = ({
  kind,
  curvatureScore,
  regularityScore,
  endpointSnapScore,
  crossed,
}: {
  readonly kind: ChannelInstanceV2["kind"];
  readonly curvatureScore: number;
  readonly regularityScore: number;
  readonly endpointSnapScore: number;
  readonly crossed: boolean;
}): number => {
  const keyRule = magicCatalogV2.channelRules.keyToKey;
  const straightPenalty =
    kind === "key_to_key" && curvatureScore < keyRule.minCurvature
      ? keyRule.straightLinePenalty
      : 0;
  const crossingPenalty = crossed ? 0.55 : 0;

  return clamp(
    endpointSnapScore * 0.34 +
      curvatureScore * 0.32 +
      regularityScore * 0.34 -
      straightPenalty -
      crossingPenalty,
  );
};

export const detectChannelsV2 = ({
  strokes,
  sigils,
  keys,
  containment,
  castingCircle,
  excludedStrokeIds,
  hardExcludedStrokeIds = new Set<string>(),
}: {
  readonly strokes: readonly RecognitionStroke[];
  readonly sigils: readonly SigilInstanceV2[];
  readonly keys: readonly KeyInstanceV2[];
  readonly containment?: CircleInstanceV2;
  readonly castingCircle: CircleInstanceV2;
  readonly excludedStrokeIds: ReadonlySet<string>;
  readonly hardExcludedStrokeIds?: ReadonlySet<string>;
}): readonly ChannelInstanceV2[] => {
  const entities = makeEntities(sigils, keys, containment);
  const snapRadius = Math.max(12, castingCircle.radius * magicCatalogV2.channelRules.endpointSnapRadiusRatio);
  const channels: ChannelInstanceV2[] = [];
  const bestByEndpoints = new Map<string, ChannelInstanceV2>();

  strokes.forEach((stroke, strokeIndex) => {
    const id = strokeId(stroke, strokeIndex);
    if (hardExcludedStrokeIds.has(id) || stroke.points.length < 2) return;
    const softExcluded = excludedStrokeIds.has(id);
    const start = endpoint(stroke, "start");
    const end = endpoint(stroke, "end");
    if (!start || !end) return;

    const fromSnap = snapEndpoint(start, entities, snapRadius);
    const toSnap = snapEndpoint(end, entities, snapRadius);
    if (!fromSnap || !toSnap || fromSnap.entity.id === toSnap.entity.id) return;

    const kind = channelKind(fromSnap.entity, toSnap.entity);
    if (!kind) return;

    const arc = fitArcToStroke(stroke);
    const crossed = crossesCastingCircle(stroke, castingCircle);
    const endpointSnapScore = clamp(1 - ((fromSnap.distance + toSnap.distance) / 2) / snapRadius);
    const pathLength = getPathLength(stroke.points);
    const isStraightKeyLink =
      kind === "key_to_key" &&
      arc.curvatureScore < magicCatalogV2.channelRules.keyToKey.minCurvature;
    const isStraightRadialLink =
      kind !== "key_to_key" &&
      arc.curvatureScore < magicCatalogV2.channelRules.keyToKey.minCurvature;
    const geometry = isStraightKeyLink
      ? "invalid_straight"
      : isStraightRadialLink
        ? "straight_radial"
        : arc.geometry;
    const quality = channelQuality({
      kind,
      curvatureScore: arc.curvatureScore,
      regularityScore: arc.regularityScore,
      endpointSnapScore,
      crossed,
    });
    const acceptsSoftExcluded =
      !softExcluded ||
      (
        endpointSnapScore >= 0.42 &&
        quality >= 0.38 &&
        pathLength >= snapRadius * 1.1 &&
        (arc.curvatureScore >= 0.08 || kind !== "key_to_key")
      );

    if (!acceptsSoftExcluded) return;

    const channel: ChannelInstanceV2 = {
      id: `channel:${channels.length}`,
      kind,
      fromId: fromSnap.entity.id,
      toId: toSnap.entity.id,
      geometry,
      arcCenter: arc.center,
      arcRadius: arc.radius,
      curvatureScore: arc.curvatureScore,
      endpointSnapScore: Number(endpointSnapScore.toFixed(3)),
      symmetryScore: arc.regularityScore,
      crossesCastingCircle: crossed,
      quality: Number(quality.toFixed(3)),
      strokeIds: [id],
    };
    const endpointKey = `${channel.kind}|${[channel.fromId, channel.toId].sort().join("|")}`;
    const existing = bestByEndpoints.get(endpointKey);
    if (!existing || channel.quality > existing.quality) {
      bestByEndpoints.set(endpointKey, channel);
    }
  });

  channels.push(...bestByEndpoints.values());
  return channels.map((channel, index) => ({ ...channel, id: `channel:${index}` }));
};
