import { getRuneByTemplateId } from "@/data/magicOntology";
import { activeRuneTemplateIds } from "@/data/activeRuneCatalog";
import { evaluateSemanticMargin } from "@/lib/recognizer/semanticMargin";
import { matchGlyphTemplates } from "@/lib/recognizer/templateMatcher";
import { validateGlyphTopology } from "@/lib/recognizer/topologyValidator";
import type { GlyphSemanticRole } from "@/types/glyphTemplates";
import type {
  RecognitionBounds,
  RecognitionStroke,
  SemanticMarginResult,
  TemplateMatchResult,
  TopologyValidationResult,
} from "@/types/recognition";
import type { CircleQuality, MandalaSymbolPosition, MandalaSymbolZone } from "@/types/mandala";
import type { MandalaDocumentBuildContext, MandalaSymbolContext } from "@/lib/spell/mandalaDocument";

const CASTABLE_OUTCOMES = new Set(["cast_clean", "cast_weak", "partial"]);
const MAX_COMPONENT_GROUP_SIZE = 9;
const MAX_LOCAL_COMBINATION_SIZE = 3;
const COMPONENT_NEIGHBOR_DISTANCE = 72;
const DEFAULT_COMPONENT_MATCH_OPTIONS = {
  topK: 12,
  totalSamplePoints: 64,
  maxMeanDistance: 56,
  strokeCountPenalty: 0.025,
  templateIdFilter: activeRuneTemplateIds,
  allowedVariants: [
    "direct",
    "reverse_points",
    "reverse_strokes",
    "reverse_points_and_strokes",
    "rotate_-10",
    "rotate_10",
  ],
  scribbleThresholds: {
    maxIntersectionCount: 80,
    maxIntersectionDensity: 0.75,
    maxPathToDiagonalRatio: 28,
  },
} as const;

interface IndexedStroke {
  readonly stroke: RecognitionStroke;
  readonly sourceIndex: number;
}

interface StrokeGroup {
  readonly strokes: readonly RecognitionStroke[];
  readonly sourceIndexes: readonly number[];
}

interface ComponentRecognition {
  readonly semantic: SemanticMarginResult;
  readonly match: TemplateMatchResult;
  readonly topology: TopologyValidationResult;
  readonly strokes: readonly RecognitionStroke[];
  readonly sourceIndexes: readonly number[];
  readonly score: number;
  readonly position?: MandalaSymbolPosition;
}

export interface MandalaParseResult {
  readonly semanticResults: readonly SemanticMarginResult[];
  readonly recognitions: readonly ComponentRecognition[];
  readonly primaryRecognition?: ComponentRecognition;
  readonly context: MandalaDocumentBuildContext;
  readonly circleQuality: CircleQuality;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const getBounds = (strokes: readonly RecognitionStroke[]): RecognitionBounds | null => {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let hasPoint = false;

  for (const stroke of strokes) {
    for (const point of stroke.points) {
      hasPoint = true;
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
  }

  if (!hasPoint) return null;

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
};

const boundsCenter = (bounds: RecognitionBounds) => ({
  x: bounds.minX + bounds.width / 2,
  y: bounds.minY + bounds.height / 2,
});

const getStrokeGroupDistance = (
  first: readonly RecognitionStroke[],
  second: readonly RecognitionStroke[],
): number => {
  const firstBounds = getBounds(first);
  const secondBounds = getBounds(second);
  if (!firstBounds || !secondBounds) return Infinity;
  const a = boundsCenter(firstBounds);
  const b = boundsCenter(secondBounds);
  return Math.hypot(a.x - b.x, a.y - b.y);
};

const canGroup = (strokes: readonly RecognitionStroke[]): boolean => {
  if (strokes.length <= 1) return true;

  const bounds = getBounds(strokes);
  if (!bounds) return false;
  const diagonal = Math.hypot(bounds.width, bounds.height);
  if (diagonal > 145) return false;

  for (let index = 1; index < strokes.length; index += 1) {
    const current = [strokes[index]];
    const hasNeighbor = strokes
      .slice(0, index)
      .some((stroke) => getStrokeGroupDistance(current, [stroke]) <= 72);

    if (!hasNeighbor) return false;
  }

  return true;
};

const buildStrokeGroups = (strokes: readonly RecognitionStroke[]): readonly StrokeGroup[] => {
  const indexed = strokes
    .map((stroke, sourceIndex): IndexedStroke => ({ stroke, sourceIndex }))
    .filter(({ stroke }) => stroke.points.length >= 2);
  const groups: StrokeGroup[] = [];
  const seenGroups = new Set<string>();

  const pushGroup = (entries: readonly IndexedStroke[]) => {
    if (entries.length === 0 || entries.length > MAX_COMPONENT_GROUP_SIZE) return;

    const sourceIndexes = entries.map(({ sourceIndex }) => sourceIndex).sort((a, b) => a - b);
    const key = sourceIndexes.join(":");
    if (seenGroups.has(key)) return;

    const groupStrokes = sourceIndexes.map((sourceIndex) => strokes[sourceIndex]);
    if (!canGroup(groupStrokes)) return;

    seenGroups.add(key);
    groups.push({
      strokes: groupStrokes,
      sourceIndexes,
    });
  };
  const shouldBuildLocalCombinations = indexed.length <= 6;

  for (let first = 0; first < indexed.length; first += 1) {
    pushGroup([indexed[first]]);

    if (!shouldBuildLocalCombinations) {
      continue;
    }

    for (let second = first + 1; second < indexed.length; second += 1) {
      const pair = [indexed[first], indexed[second]];
      pushGroup(pair);

      for (let third = second + 1; third < indexed.length; third += 1) {
        const triple = [indexed[first], indexed[second], indexed[third]];
        if (triple.length <= MAX_LOCAL_COMBINATION_SIZE) {
          pushGroup(triple);
        }
      }
    }
  }

  const visited = new Set<number>();
  indexed.forEach((_, entryIndex) => {
    if (visited.has(entryIndex)) return;

    const clusterIndexes = new Set<number>([entryIndex]);
    const queue = [entryIndex];
    visited.add(entryIndex);

    while (queue.length > 0) {
      const currentIndex = queue.shift()!;
      const current = indexed[currentIndex];

      indexed.forEach((candidate, candidateIndex) => {
        if (visited.has(candidateIndex)) return;
        if (
          getStrokeGroupDistance([current.stroke], [candidate.stroke]) >
          COMPONENT_NEIGHBOR_DISTANCE
        ) {
          return;
        }

        visited.add(candidateIndex);
        clusterIndexes.add(candidateIndex);
        queue.push(candidateIndex);
      });
    }

    const cluster = [...clusterIndexes]
      .sort((a, b) => indexed[a].sourceIndex - indexed[b].sourceIndex)
      .map((index) => indexed[index]);

    if (cluster.length > MAX_LOCAL_COMBINATION_SIZE) {
      pushGroup(cluster);
    }
  });

  return groups;
};

const coerceSemanticToCastable = (
  semantic: SemanticMarginResult,
  match: TemplateMatchResult,
): SemanticMarginResult => {
  const candidate = semantic.candidate;
  if (!candidate || CASTABLE_OUTCOMES.has(semantic.outcome)) return semantic;

  const confidenceFloor = Math.max(0.48, candidate.template.recognition.min_confidence - 0.22);
  const isUsefulButAmbiguous =
    candidate.confidence >= confidenceFloor &&
    match.semanticMargin >= Math.max(0.02, candidate.template.recognition.min_semantic_margin * 0.35);

  if (!isUsefulButAmbiguous) return semantic;

  return {
    ...semantic,
    outcome: "partial",
    reasons: [
      ...semantic.reasons,
      {
        code: "component_accepted_as_partial",
        message: "Component was useful enough for mandala assembly despite ambiguity.",
        severity: "warning",
      },
    ],
  };
};

const recognizeComponentGroup = (
  group: StrokeGroup,
  frameBounds?: RecognitionBounds,
): ComponentRecognition | null => {
  const sourceBounds = getBounds(group.strokes);
  const match = matchGlyphTemplates(group.strokes, {
    ...DEFAULT_COMPONENT_MATCH_OPTIONS,
    context: {
      sourceBounds,
      frameBounds,
    },
  });
  if (!match.topCandidate || match.inputRejected) return null;

  const maxExpectedStrokes = Math.max(3, match.topCandidate.template.strokes.length + 2);
  if (group.strokes.length > maxExpectedStrokes) return null;

  const topology = validateGlyphTopology(match.normalized.strokes, match.topCandidate.template, {
    maxNoiseStrokeRatio: 0.6,
    intersectionTolerance: 2,
  });
  const semantic = coerceSemanticToCastable(
    evaluateSemanticMargin(match, topology, {
      severeConfidenceGap: 0.32,
      weakTopologyOutcome: "partial",
    }),
    match,
  );

  if (!CASTABLE_OUTCOMES.has(semantic.outcome)) return null;

  const strokeCoverageBonus =
    Math.abs(group.strokes.length - match.topCandidate.template.strokes.length) <= 1
      ? 0.24
      : 0;

  return {
    semantic,
    match,
    topology,
    strokes: group.strokes,
    sourceIndexes: group.sourceIndexes,
    score:
      semantic.confidence +
      match.semanticMargin * 0.45 +
      group.sourceIndexes.length * 0.035 +
      strokeCoverageBonus,
  };
};

const isRepeatableRole = (role: GlyphSemanticRole | undefined): boolean =>
  role === "element" || role === "derived" || role === "risk" || role === "ink";

const selectComponentRecognitions = (
  recognitions: readonly ComponentRecognition[],
): readonly ComponentRecognition[] => {
  const usedIndexes = new Set<number>();
  const usedTemplateIds = new Set<string>();
  const selected: ComponentRecognition[] = [];

  for (const recognition of [...recognitions].sort((a, b) => b.score - a.score)) {
    if (recognition.sourceIndexes.some((index) => usedIndexes.has(index))) continue;

    const templateId = recognition.semantic.candidate?.template.id;
    const role = recognition.semantic.candidate?.template.semantic_role;
    if (templateId && usedTemplateIds.has(templateId) && !isRepeatableRole(role)) continue;

    selected.push(recognition);
    recognition.sourceIndexes.forEach((index) => usedIndexes.add(index));
    if (templateId) usedTemplateIds.add(templateId);
  }

  return selected;
};

const getRole = (recognition: ComponentRecognition): GlyphSemanticRole | undefined =>
  recognition.semantic.candidate?.template.semantic_role;

const getFrameRecognition = (
  recognitions: readonly ComponentRecognition[],
): ComponentRecognition | undefined =>
  recognitions
    .filter((recognition) => getRole(recognition) === "container")
    .sort((a, b) => b.score - a.score)[0];

const getFrameGeometry = (recognition: ComponentRecognition | undefined) => {
  const bounds = recognition ? getBounds(recognition.strokes) : null;
  if (!bounds) return null;
  const center = boundsCenter(bounds);
  const radius = Math.max(1, (bounds.width + bounds.height) / 4);
  return { bounds, center, radius };
};

const getPathLength = (strokes: readonly RecognitionStroke[]): number =>
  strokes.reduce((sum, stroke) => {
    let strokeLength = 0;
    for (let index = 1; index < stroke.points.length; index += 1) {
      const previous = stroke.points[index - 1];
      const current = stroke.points[index];
      strokeLength += Math.hypot(current.x - previous.x, current.y - previous.y);
    }
    return sum + strokeLength;
  }, 0);

const getEndpointDistance = (strokes: readonly RecognitionStroke[]): number => {
  const firstStroke = strokes[0];
  const lastStroke = strokes[strokes.length - 1];
  const first = firstStroke?.points[0];
  const last = lastStroke?.points[lastStroke.points.length - 1];
  if (!first || !last) return Infinity;
  return Math.hypot(first.x - last.x, first.y - last.y);
};

const calculateCircleQuality = (recognition: ComponentRecognition | undefined): CircleQuality => {
  const geometry = getFrameGeometry(recognition);
  if (!recognition || !geometry) {
    return {
      closure: 0,
      roundness: 0,
      centeredness: 0,
      smoothness: 0,
      overall: 0,
    };
  }

  const { center, radius, bounds } = geometry;
  const points = recognition.strokes.flatMap((stroke) => stroke.points);
  const distances = points.map((point) => Math.hypot(point.x - center.x, point.y - center.y));
  const averageDistance = distances.reduce((sum, distance) => sum + distance, 0) / Math.max(1, distances.length);
  const variance = distances.reduce((sum, distance) => sum + (distance - averageDistance) ** 2, 0) / Math.max(1, distances.length);
  const stdev = Math.sqrt(variance);
  const aspectPenalty = Math.abs(bounds.width - bounds.height) / Math.max(1, Math.max(bounds.width, bounds.height));
  const closure = clamp(100 - (getEndpointDistance(recognition.strokes) / radius) * 80, 0, 100);
  const roundness = clamp(100 - (stdev / radius) * 160 - aspectPenalty * 55, 0, 100);
  const pathRatio = getPathLength(recognition.strokes) / Math.max(1, Math.PI * 2 * radius);
  const smoothness = clamp(100 - Math.abs(1 - pathRatio) * 45, 0, 100);
  const centeredness = 100;
  const overall = clamp((closure * 0.35) + (roundness * 0.35) + (smoothness * 0.2) + (centeredness * 0.1), 0, 100);

  return {
    closure: Math.round(closure),
    roundness: Math.round(roundness),
    centeredness: Math.round(centeredness),
    smoothness: Math.round(smoothness),
    overall: Math.round(overall),
  };
};

const zoneFromRadius = (role: GlyphSemanticRole, radius: number): MandalaSymbolZone => {
  if (role === "container") return "frame";
  if (radius <= 18) return "core";
  if (radius <= 42) return "inner";
  if (radius <= 68) return "middle";
  if (radius <= 100) return "outer";
  return "orbital";
};

const getPosition = (
  recognition: ComponentRecognition,
  frameGeometry: NonNullable<ReturnType<typeof getFrameGeometry>> | null,
): MandalaSymbolPosition | undefined => {
  const role = getRole(recognition);
  if (!role || !frameGeometry) return undefined;
  if (role === "container") return { angle: 0, radius: 100, zone: "frame" };

  const bounds = getBounds(recognition.strokes);
  if (!bounds) return undefined;

  const center = boundsCenter(bounds);
  const dx = center.x - frameGeometry.center.x;
  const dy = center.y - frameGeometry.center.y;
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const normalizedAngle = angle < 0 ? angle + 360 : angle;
  const radius = clamp((Math.hypot(dx, dy) / frameGeometry.radius) * 100, 0, 140);

  return {
    angle: Math.round(normalizedAngle),
    radius: Math.round(radius),
    zone: zoneFromRadius(role, radius),
  };
};

const getExpectedZoneScore = (recognition: ComponentRecognition): number => {
  const templateId = recognition.semantic.candidate?.template.id;
  const position = recognition.position;
  if (!templateId || !position) return 0;

  const rune = getRuneByTemplateId(templateId);
  if (!rune) return 0;
  if (rune.expectedZones.includes(position.zone)) return position.zone === "orbital" ? 0.18 : 0.14;
  if (rune.role === "container") return -0.45;
  if (position.zone === "orbital" || position.zone === "frame") return -0.22;
  return -0.14;
};

const applyContextualScore = (recognition: ComponentRecognition): ComponentRecognition => ({
  ...recognition,
  score: recognition.score + getExpectedZoneScore(recognition),
});

const compareMandalaOrder = (a: ComponentRecognition, b: ComponentRecognition): number => {
  const aRole = getRole(a);
  const bRole = getRole(b);
  if (aRole === "container" && bRole !== "container") return -1;
  if (aRole !== "container" && bRole === "container") return 1;

  const aPosition = a.position;
  const bPosition = b.position;
  if (aPosition && bPosition) {
    const radiusDelta = aPosition.radius - bPosition.radius;
    if (Math.abs(radiusDelta) > 8) return radiusDelta;
    return aPosition.angle - bPosition.angle;
  }

  return a.sourceIndexes[0] - b.sourceIndexes[0];
};

const makeSymbolsByTemplateId = (
  recognitions: readonly ComponentRecognition[],
): ReadonlyMap<string, readonly MandalaSymbolContext[]> => {
  const map = new Map<string, MandalaSymbolContext[]>();

  for (const recognition of recognitions) {
    const templateId = recognition.semantic.candidate?.template.id;
    if (!templateId) continue;

    const contexts = map.get(templateId) ?? [];
    contexts.push({
      sourceStrokeIds: recognition.sourceIndexes.map((index) => `stroke:${index}`),
      position: recognition.position,
    });
    map.set(templateId, contexts);
  }

  return map;
};

export const parseMandalaFromStrokes = (
  strokes: readonly RecognitionStroke[],
): MandalaParseResult => {
  const strokeGroups = buildStrokeGroups(strokes);
  const initialRecognitions = strokeGroups
    .map((group) => recognizeComponentGroup(group))
    .filter((recognition): recognition is ComponentRecognition => Boolean(recognition));
  const initialFrameRecognition = getFrameRecognition(initialRecognitions);
  const initialFrameGeometry = getFrameGeometry(initialFrameRecognition);
  const candidateRecognitions = (initialFrameGeometry
    ? strokeGroups.map((group) => recognizeComponentGroup(group, initialFrameGeometry.bounds))
    : initialRecognitions
  ).filter((recognition): recognition is ComponentRecognition => Boolean(recognition));
  const frameRecognition = getFrameRecognition(candidateRecognitions);
  const frameGeometry = getFrameGeometry(frameRecognition);
  const circleQuality = calculateCircleQuality(frameRecognition);
  const positionedRecognitions = selectComponentRecognitions(
    candidateRecognitions.map((recognition): ComponentRecognition => applyContextualScore({
      ...recognition,
      position: getPosition(recognition, frameGeometry),
    })),
  );
  const mandalaOrderedRecognitions = [...positionedRecognitions].sort(compareMandalaOrder);

  return {
    semanticResults: mandalaOrderedRecognitions.map((recognition) => recognition.semantic),
    recognitions: mandalaOrderedRecognitions,
    primaryRecognition: mandalaOrderedRecognitions[0],
    circleQuality,
    context: {
      circleQuality,
      symbolsByTemplateId: makeSymbolsByTemplateId(mandalaOrderedRecognitions),
    },
  };
};
