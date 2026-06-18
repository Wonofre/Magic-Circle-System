import { getRuneByTemplateId } from "@/data/magicOntology";
import { activeRuneTemplateIds } from "@/data/magicOntology";
import { evaluateSemanticMargin } from "@/lib/recognizer/semanticMargin";
import { matchGlyphTemplates } from "@/lib/recognizer/templateMatcher";
import { validateGlyphTopology } from "@/lib/recognizer/topologyValidator";
import { detectScribble } from "@/lib/recognizer/scribbleDetector";
import { normalizeStrokes } from "@/lib/recognizer/normalizeStrokes";
import {
  recognizeGlyphRegionsProbabilistically,
} from "@/lib/recognizer/ml/probabilisticRecognizer";
import { getGlyphById } from "@/data/glyphTemplates";
import type { GlyphSemanticRole } from "@/types/glyphTemplates";
import type {
  RecognitionBounds,
  ProbabilisticRecognitionResult,
  RecognitionStroke,
  SemanticMarginResult,
  TemplateMatchResult,
  TopologyValidationResult,
} from "@/types/recognition";
import type { MandalaSymbolPosition, MandalaSymbolZone } from "@/types/mandala";

const CASTABLE_OUTCOMES = new Set(["cast_clean", "cast_weak", "partial"]);
const MAX_COMPONENT_GROUP_SIZE = 9;
const MAX_LOCAL_COMBINATION_SIZE = 3;
const COMPONENT_NEIGHBOR_DISTANCE = 72;
const LOCAL_COMBINATION_DISTANCE = 24;
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

export interface StrokeGroup {
  readonly strokes: readonly RecognitionStroke[];
  readonly sourceIndexes: readonly number[];
  readonly templateIdHint?: string;
}

export interface ComponentRecognition {
  readonly semantic: SemanticMarginResult;
  readonly match: TemplateMatchResult;
  readonly topology: TopologyValidationResult;
  readonly strokes: readonly RecognitionStroke[];
  readonly sourceIndexes: readonly number[];
  readonly score: number;
  readonly position?: MandalaSymbolPosition;
}

export interface MandalaComponentParseV2 {
  readonly semanticResults: readonly SemanticMarginResult[];
  readonly recognitions: readonly ComponentRecognition[];
  readonly primaryRecognition?: ComponentRecognition;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

export const getBounds = (strokes: readonly RecognitionStroke[]): RecognitionBounds | null => {
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

const isLargeGroupingStroke = (stroke: RecognitionStroke): boolean => {
  const bounds = getBounds([stroke]);
  if (!bounds) return false;
  return Math.hypot(bounds.width, bounds.height) > 145;
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

const pointDistance = (
  first: RecognitionStroke["points"][number] | undefined,
  second: RecognitionStroke["points"][number] | undefined,
): number =>
  first && second ? Math.hypot(first.x - second.x, first.y - second.y) : Infinity;

const stitchStrokeFragments = (
  strokes: readonly RecognitionStroke[],
): readonly RecognitionStroke[] => {
  const bounds = getBounds(strokes);
  const joinDistance = bounds
    ? clamp(Math.hypot(bounds.width, bounds.height) * 0.09, 3, 10)
    : 5;
  const stitched: RecognitionStroke[] = [];

  strokes.forEach((stroke) => {
    const previous = stitched[stitched.length - 1];
    if (!previous) {
      stitched.push(stroke);
      return;
    }

    const previousEnd = previous.points[previous.points.length - 1];
    const currentStart = stroke.points[0];
    const currentEnd = stroke.points[stroke.points.length - 1];
    const joinsForward = pointDistance(previousEnd, currentStart) <= joinDistance;
    const joinsReverse = pointDistance(previousEnd, currentEnd) <= joinDistance;

    if (!joinsForward && !joinsReverse) {
      stitched.push(stroke);
      return;
    }

    const continuation = joinsForward ? stroke.points : [...stroke.points].reverse();
    stitched[stitched.length - 1] = {
      ...previous,
      points: [...previous.points, ...continuation.slice(1)],
    };
  });

  return stitched;
};

export const buildStrokeGroups = (
  strokes: readonly RecognitionStroke[],
  excludedStrokeIds: ReadonlySet<string>,
): readonly StrokeGroup[] => {
  const indexed = strokes
    .map((stroke, sourceIndex): IndexedStroke => ({ stroke, sourceIndex }))
    .filter(({ stroke, sourceIndex }) =>
      stroke.points.length >= 2 &&
      !excludedStrokeIds.has(stroke.id ?? `stroke:${sourceIndex}`),
    );
  const groups: StrokeGroup[] = [];
  const seenGroups = new Set<string>();

  const pushGroup = (entries: readonly IndexedStroke[]) => {
    if (entries.length === 0 || entries.length > MAX_COMPONENT_GROUP_SIZE) return;

    const sourceIndexes = entries.map(({ sourceIndex }) => sourceIndex).sort((a, b) => a - b);
    const key = sourceIndexes.join(":");
    if (seenGroups.has(key)) return;

    const groupStrokes = sourceIndexes.map((sourceIndex) => strokes[sourceIndex]);
    if (!canGroup(groupStrokes)) return;
    const templateHints = [...new Set(groupStrokes.map((stroke) => stroke.semanticTemplateId).filter((id): id is string => Boolean(id)))];

    seenGroups.add(key);
    groups.push({
      strokes: groupStrokes,
      sourceIndexes,
      templateIdHint: templateHints.length === 1 ? templateHints[0] : undefined,
    });
  };
  const shouldBuildLocalCombinations = indexed.length <= 12;

  const semanticGroups = new Map<string, IndexedStroke[]>();
  indexed.forEach((entry) => {
    const groupId = entry.stroke.semanticGroupId;
    if (!groupId) return;
    semanticGroups.set(groupId, [...(semanticGroups.get(groupId) ?? []), entry]);
  });
  semanticGroups.forEach((entries) => pushGroup(entries));
  if (indexed.length > 0 && indexed.every((entry) => Boolean(entry.stroke.semanticGroupId))) {
    return groups;
  }

  for (let first = 0; first < indexed.length; first += 1) {
    pushGroup([indexed[first]]);

    if (!shouldBuildLocalCombinations) {
      continue;
    }

    for (let second = first + 1; second < indexed.length; second += 1) {
      if (getStrokeGroupDistance([indexed[first].stroke], [indexed[second].stroke]) > LOCAL_COMBINATION_DISTANCE) {
        continue;
      }
      const pair = [indexed[first], indexed[second]];
      pushGroup(pair);

      for (let third = second + 1; third < indexed.length; third += 1) {
        if (
          getStrokeGroupDistance([indexed[first].stroke], [indexed[third].stroke]) > LOCAL_COMBINATION_DISTANCE ||
          getStrokeGroupDistance([indexed[second].stroke], [indexed[third].stroke]) > LOCAL_COMBINATION_DISTANCE
        ) {
          continue;
        }
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
    const seedStroke = indexed[entryIndex].stroke;
    visited.add(entryIndex);

    while (queue.length > 0) {
      const currentIndex = queue.shift()!;
      const current = indexed[currentIndex];

      indexed.forEach((candidate, candidateIndex) => {
        if (visited.has(candidateIndex)) return;
        if (isLargeGroupingStroke(current.stroke) || isLargeGroupingStroke(candidate.stroke)) return;
        if (
          getStrokeGroupDistance([seedStroke], [candidate.stroke]) >
          COMPONENT_NEIGHBOR_DISTANCE
        ) {
          return;
        }
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

    if (cluster.length > 1) {
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

const coerceCanonicalReplayToCastable = (
  semantic: SemanticMarginResult,
  templateIdHint?: string,
): SemanticMarginResult => {
  if (!templateIdHint || CASTABLE_OUTCOMES.has(semantic.outcome) || !semantic.candidate) {
    return semantic;
  }

  if (semantic.candidate.template.id !== templateIdHint || semantic.candidate.confidence < 0.34) {
    return semantic;
  }

  return {
    ...semantic,
    outcome: "partial",
    reasons: [
      ...semantic.reasons,
      {
        code: "canonical_replay_hint",
        message: "Canonical replay stroke accepted as partial after matching its source template.",
        severity: "warning",
      },
    ],
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

interface RecognitionBeamState {
  readonly selected: readonly ComponentRecognition[];
  readonly usedIndexes: ReadonlySet<number>;
  readonly usedTemplateIds: ReadonlySet<string>;
  readonly score: number;
  readonly signature: string;
}

const recognitionSignature = (
  recognitions: readonly ComponentRecognition[],
): string =>
  recognitions
    .map((recognition) => {
      const templateId = recognition.semantic.candidate?.template.id ?? "UNKNOWN";
      return `${recognition.sourceIndexes.join(".")}:${templateId}`;
    })
    .sort()
    .join("|");

const selectComponentRecognitionInterpretations = (
  recognitions: readonly ComponentRecognition[],
  beamWidth = 24,
  maxInterpretations = 12,
): readonly (readonly ComponentRecognition[])[] => {
  const grouped = new Map<string, ComponentRecognition[]>();
  recognitions.forEach((recognition) => {
    const key = recognition.sourceIndexes.join(":");
    grouped.set(key, [...(grouped.get(key) ?? []), recognition]);
  });
  const groups = [...grouped.values()]
    .map((group) => [...group].sort((first, second) =>
      second.score - first.score ||
      (first.semantic.candidate?.template.id ?? "").localeCompare(
        second.semantic.candidate?.template.id ?? "",
      ),
    ).slice(0, 3))
    .sort((first, second) =>
      (first[0]?.sourceIndexes[0] ?? 0) - (second[0]?.sourceIndexes[0] ?? 0) ||
      (first[0]?.sourceIndexes.length ?? 0) - (second[0]?.sourceIndexes.length ?? 0),
    );
  let beam: RecognitionBeamState[] = [{
    selected: [],
    usedIndexes: new Set<number>(),
    usedTemplateIds: new Set<string>(),
    score: 0,
    signature: "",
  }];

  for (const group of groups) {
    const expanded: RecognitionBeamState[] = [...beam];

    for (const state of beam) {
      for (const recognition of group) {
        if (recognition.sourceIndexes.some((index) => state.usedIndexes.has(index))) continue;
        const templateId = recognition.semantic.candidate?.template.id;
        const role = recognition.semantic.candidate?.template.semantic_role;
        if (
          templateId &&
          state.usedTemplateIds.has(templateId) &&
          !isRepeatableRole(role)
        ) {
          continue;
        }

        const selected = [...state.selected, recognition];
        expanded.push({
          selected,
          usedIndexes: new Set([...state.usedIndexes, ...recognition.sourceIndexes]),
          usedTemplateIds: templateId
            ? new Set([...state.usedTemplateIds, templateId])
            : state.usedTemplateIds,
          score: state.score + recognition.score,
          signature: recognitionSignature(selected),
        });
      }
    }

    beam = expanded
      .sort((first, second) =>
        second.score - first.score ||
        second.selected.length - first.selected.length ||
        first.signature.localeCompare(second.signature),
      )
      .slice(0, beamWidth);
  }

  return beam
    .filter((state) => state.selected.length > 0)
    .slice(0, maxInterpretations)
    .map((state) => state.selected);
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

const buildRecognitionFromMatch = (
  group: StrokeGroup,
  match: TemplateMatchResult,
  strokesForTopology: readonly RecognitionStroke[],
): ComponentRecognition | null => {
  if (!match.topCandidate || match.inputRejected) return null;

  const topology = validateGlyphTopology(match.normalized.strokes, match.topCandidate.template, {
    maxNoiseStrokeRatio: 0.72,
    intersectionTolerance: 2,
  });
  const semantic = coerceCanonicalReplayToCastable(
    coerceSemanticToCastable(
      evaluateSemanticMargin(match, topology, {
        severeConfidenceGap: 0.32,
        weakTopologyOutcome: "partial",
      }),
      match,
    ),
    group.templateIdHint,
  );

  if (!CASTABLE_OUTCOMES.has(semantic.outcome)) return null;

  const expectedStrokeCount = match.topCandidate.template.strokes.length;
  const strokeCoverageBonus =
    Math.abs(group.strokes.length - expectedStrokeCount) <= 1 ? 0.08 : 0;
  const missingStrokePenalty = Math.max(
    0,
    expectedStrokeCount - group.strokes.length,
  ) * 0.12;
  const fragmentationPenalty = Math.max(
    0,
    group.strokes.length - expectedStrokeCount,
  ) * 0.015;

  return {
    semantic,
    match,
    topology,
    strokes: strokesForTopology,
    sourceIndexes: group.sourceIndexes,
    score:
      semantic.confidence * 1.35 +
      match.topCandidate.shapeConfidence * 0.55 +
      match.semanticMargin * 0.65 +
      (topology.isValid ? 0.14 : 0) +
      strokeCoverageBonus -
      missingStrokePenalty -
      fragmentationPenalty,
  };
};

const recognizeComponentGroupAlternatives = (
  group: StrokeGroup,
  frameBounds?: RecognitionBounds,
): readonly ComponentRecognition[] => {
  const sourceBounds = getBounds(group.strokes);
  const stitchedStrokes = stitchStrokeFragments(group.strokes);
  const matchStrokes = (strokes: readonly RecognitionStroke[]) =>
    matchGlyphTemplates(strokes, {
      ...DEFAULT_COMPONENT_MATCH_OPTIONS,
      templateIdFilter: group.templateIdHint ? [group.templateIdHint] : DEFAULT_COMPONENT_MATCH_OPTIONS.templateIdFilter,
      context: {
        sourceBounds,
        frameBounds,
      },
    });
  const rawMatch = matchStrokes(group.strokes);
  const shouldTryStitched =
    group.strokes.length > 3 &&
    stitchedStrokes.length <= group.strokes.length - 2 &&
    (
      !rawMatch.topCandidate ||
      rawMatch.topCandidate.strokeCountDelta >= 2 ||
      rawMatch.topCandidate.confidence < 0.72
    );
  const match = shouldTryStitched
    ? [rawMatch, matchStrokes(stitchedStrokes)].sort((first, second) => {
      const firstScore =
        (first.topCandidate?.confidence ?? 0) +
        (first.topCandidate?.shapeConfidence ?? 0) * 0.45 +
        first.semanticMargin * 0.35;
      const secondScore =
        (second.topCandidate?.confidence ?? 0) +
        (second.topCandidate?.shapeConfidence ?? 0) * 0.45 +
        second.semanticMargin * 0.35;
      return secondScore - firstScore;
    })[0]
    : rawMatch;

  const strokeSets = shouldTryStitched && stitchedStrokes.length > 0
    ? [group.strokes, stitchedStrokes]
    : [group.strokes];

  const seen = new Set<string>();
  const alternatives: ComponentRecognition[] = [];

  for (const candidate of match.candidates.slice(0, 3)) {
    const candidateMatch: TemplateMatchResult = {
      ...match,
      topCandidate: candidate,
      candidates: match.candidates,
    };
    for (const strokesForTopology of strokeSets) {
      const recognition = buildRecognitionFromMatch(group, candidateMatch, strokesForTopology);
      if (!recognition) continue;
      const templateId = recognition.semantic.candidate?.template.id ?? "UNKNOWN";
      const signature = `${recognition.sourceIndexes.join(":")}:${templateId}`;
      if (seen.has(signature)) continue;
      seen.add(signature);
      alternatives.push(recognition);
      break;
    }
  }

  return alternatives.sort((first, second) => second.score - first.score);
};

export const recognizeMandalaComponentsV2WithInterpretations = (
  strokes: readonly RecognitionStroke[],
  options: {
    readonly excludedStrokeIds?: ReadonlySet<string>;
  } = {},
) => {
  const strokeGroups = buildStrokeGroups(strokes, options.excludedStrokeIds ?? new Set<string>());
  const initialAlternatives = strokeGroups.flatMap((group) => recognizeComponentGroupAlternatives(group));
  const initialFrameRecognition = getFrameRecognition(initialAlternatives);
  const initialFrameGeometry = getFrameGeometry(initialFrameRecognition);
  const candidateRecognitions = initialFrameGeometry
    ? strokeGroups.flatMap((group) =>
        recognizeComponentGroupAlternatives(group, initialFrameGeometry.bounds),
      )
    : initialAlternatives;
  const frameRecognition = getFrameRecognition(candidateRecognitions);
  const frameGeometry = getFrameGeometry(frameRecognition);
  const interpretations = selectComponentRecognitionInterpretations(candidateRecognitions)
    .map((interpretation) =>
      [...interpretation]
        .map((recognition): ComponentRecognition => applyContextualScore({
          ...recognition,
          position: getPosition(recognition, frameGeometry),
        }))
        .sort(compareMandalaOrder),
    );
  const best = interpretations[0] ?? [];

  return {
    semanticResults: best.map((recognition) => recognition.semantic),
    recognitions: best,
    primaryRecognition: best[0],
    interpretations,
  };
};

export const recognizeMandalaComponentsV2 = (
  strokes: readonly RecognitionStroke[],
  options: {
    readonly excludedStrokeIds?: ReadonlySet<string>;
  } = {},
) => {
  const strokeGroups = buildStrokeGroups(strokes, options.excludedStrokeIds ?? new Set<string>());
  const initialRecognitions = strokeGroups
    .flatMap((group) => recognizeComponentGroupAlternatives(group).slice(0, 1))
    .filter((recognition): recognition is ComponentRecognition => Boolean(recognition));
  const initialFrameRecognition = getFrameRecognition(initialRecognitions);
  const initialFrameGeometry = getFrameGeometry(initialFrameRecognition);
  const candidateRecognitions = (initialFrameGeometry
    ? strokeGroups.flatMap((group) =>
        recognizeComponentGroupAlternatives(group, initialFrameGeometry.bounds).slice(0, 1),
      )
    : initialRecognitions
  ).filter((recognition): recognition is ComponentRecognition => Boolean(recognition));
  const frameRecognition = getFrameRecognition(candidateRecognitions);
  const frameGeometry = getFrameGeometry(frameRecognition);
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
  };
};

const makeVisionMatch = (
  region: ProbabilisticRecognitionResult["regions"][number],
  selectedTemplateId: string,
): TemplateMatchResult | null => {
  const normalized = normalizeStrokes(region.strokes);
  const scribble = detectScribble(region.strokes);
  const mappedCandidates = region.candidates.flatMap((candidate) => {
    const template = getGlyphById(candidate.templateId);
    if (!template) return [];
    return [{
      template,
      rank: candidate.rank,
      confidence: candidate.confidence,
      shapeConfidence: candidate.confidence,
      meanDistance: (1 - candidate.confidence) * 56,
      strokeCountDelta: Math.abs(region.strokes.length - template.strokes.length),
      sampledPointCount: normalized.normalizedPointCount,
      contextScore: 0,
      normalizationMode: "bbox_0_100" as const,
    }];
  });
  const selected = mappedCandidates.find(
    (candidate) => candidate.template.id === selectedTemplateId,
  );
  if (!selected) return null;
  const visionCandidate = region.candidates.find(
    (candidate) => candidate.templateId === selectedTemplateId,
  );

  return {
    stage: "ranking_only",
    candidates: [selected, ...mappedCandidates.filter((candidate) => candidate !== selected)],
    topCandidate: selected,
    semanticMargin: visionCandidate?.semanticMargin ?? 0,
    inputRejected: false,
    rejectionReason: null,
    scribble,
    normalized,
  };
};

const visionRegionRecognitions = (
  region: ProbabilisticRecognitionResult["regions"][number],
): readonly ComponentRecognition[] => {
  if (region.rejected) return [];

  return region.candidates
    .filter((candidate) =>
      candidate.templateId !== "UNKNOWN" &&
      candidate.acceptedByClassThreshold,
    )
    .slice(0, 3)
    .flatMap((visionCandidate) => {
      const match = makeVisionMatch(region, visionCandidate.templateId);
      if (!match?.topCandidate) return [];
      const topology = validateGlyphTopology(
        match.normalized.strokes,
        match.topCandidate.template,
        {
          maxNoiseStrokeRatio: 0.72,
          intersectionTolerance: 2,
        },
      );
      const evaluated = evaluateSemanticMargin(match, topology, {
        severeConfidenceGap: 0.32,
        weakTopologyOutcome: "partial",
        confidenceThreshold: visionCandidate.confidenceThreshold,
        semanticMarginThreshold: visionCandidate.semanticMarginThreshold,
      });
      const semantic = region.candidates[0]?.source === "canonical_hint"
        ? coerceCanonicalReplayToCastable(
            coerceSemanticToCastable(evaluated, match),
            visionCandidate.templateId,
          )
        : evaluated;
      if (!CASTABLE_OUTCOMES.has(semantic.outcome)) return [];

      const expectedStrokeCount = match.topCandidate.template.strokes.length;
      const coveragePenalty =
        Math.abs(region.strokes.length - expectedStrokeCount) * 0.035;

      return [{
        semantic,
        match,
        topology,
        strokes: region.strokes,
        sourceIndexes: region.sourceIndexes,
        score:
          semantic.confidence * 1.5 +
          visionCandidate.semanticMargin * 0.7 +
          (topology.isValid ? 0.22 : -0.18) -
          coveragePenalty,
      }];
    });
};

export const recognizeMandalaComponentsV2Probabilistically = async (
  strokes: readonly RecognitionStroke[],
  options: {
    readonly excludedStrokeIds?: ReadonlySet<string>;
    readonly frameBounds?: RecognitionBounds;
  } = {},
) => {
  const strokeGroups = buildStrokeGroups(
    strokes,
    options.excludedStrokeIds ?? new Set<string>(),
  );
  const frameBounds = options.frameBounds;
  const frameGeometry = frameBounds
    ? {
        bounds: frameBounds,
        center: boundsCenter(frameBounds),
        radius: Math.max(1, (frameBounds.width + frameBounds.height) / 4),
      }
    : null;
  const probabilistic = await recognizeGlyphRegionsProbabilistically(
    strokeGroups.map((group) => {
      const bounds = getBounds(group.strokes);
      const center = bounds ? boundsCenter(bounds) : undefined;
      const radius = center && frameGeometry
        ? clamp(
            (Math.hypot(
              center.x - frameGeometry.center.x,
              center.y - frameGeometry.center.y,
            ) / frameGeometry.radius) * 100,
            0,
            140,
          )
        : undefined;
      return {
        id: `region:${group.sourceIndexes.join(":")}`,
        strokes: group.strokes,
        sourceIndexes: group.sourceIndexes,
        templateIdHint: group.templateIdHint,
        bounds,
        zone: radius === undefined
          ? undefined
          : radius <= 18
            ? "core" as const
            : radius <= 42
              ? "inner" as const
              : radius <= 68
                ? "middle" as const
                : radius <= 100
                  ? "outer" as const
                  : "orbital" as const,
      };
    }),
  );
  const candidates = probabilistic.regions.flatMap(visionRegionRecognitions);
  const interpretations = selectComponentRecognitionInterpretations(candidates)
    .map((interpretation) =>
      [...interpretation]
        .map((recognition): ComponentRecognition => applyContextualScore({
          ...recognition,
          position: getPosition(recognition, frameGeometry),
        }))
        .sort(compareMandalaOrder),
    );
  const best = interpretations[0] ?? [];

  return {
    semanticResults: best.map((recognition) => recognition.semantic),
    recognitions: best,
    primaryRecognition: best[0],
    interpretations,
    probabilistic,
  };
};
