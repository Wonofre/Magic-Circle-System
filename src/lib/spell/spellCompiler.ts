import { getGlyphById } from "@/data/glyphTemplates";
import { fallbackSpellRecipe, spellRecipes } from "@/data/spellRecipes";
import { resolveDiegeticFailure } from "@/lib/recognizer/failureResolver";
import { compileSpellGraph, semanticResultsToGraphInputs } from "@/lib/recognizer/graphCompiler";
import { evaluateSemanticMargin } from "@/lib/recognizer/semanticMargin";
import { matchGlyphTemplates } from "@/lib/recognizer/templateMatcher";
import { validateGlyphTopology } from "@/lib/recognizer/topologyValidator";
import { createRecognitionTelemetryEvent, cloneTelemetryStrokes } from "@/lib/telemetry/recognitionTelemetry";
import type { GlyphTemplate } from "@/types/glyphTemplates";
import type {
  RecognitionBounds,
  RecognitionStroke,
  SemanticMarginResult,
  TemplateMatchCandidate,
  TemplateMatchResult,
  TopologyValidationResult,
} from "@/types/recognition";
import type { SpellCard, SpellCompileResult, SpellRecipe } from "@/types/spellCard";
import type { SpellGraph, SpellGraphNode } from "@/types/spellGraph";

const CASTABLE_OUTCOMES = new Set(["cast_clean", "cast_weak", "partial"]);
const DEFAULT_COMPONENT_MATCH_OPTIONS = {
  topK: 8,
  totalSamplePoints: 80,
  maxMeanDistance: 56,
  strokeCountPenalty: 0.025,
  scribbleThresholds: {
    maxIntersectionCount: 80,
    maxIntersectionDensity: 0.75,
    maxPathToDiagonalRatio: 28,
  },
} as const;
const DEFAULT_TEMPLATE_CONFIDENCE = 0.84;
const MAX_COMPONENT_GROUP_SIZE = 3;

type StrokeGroup = {
  readonly strokes: readonly RecognitionStroke[];
  readonly indexes: readonly number[];
};

type ComponentRecognition = {
  readonly semantic: SemanticMarginResult;
  readonly match: TemplateMatchResult;
  readonly topology: TopologyValidationResult;
  readonly indexes: readonly number[];
  readonly score: number;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const graphRoles = (graph: SpellGraph) =>
  new Set(graph.nodes.map((node) => node.semanticRole));

const semanticRoles = (semanticResults: readonly SemanticMarginResult[]) =>
  new Set(
    semanticResults
      .map((result) => result.candidate?.template.semantic_role)
      .filter((role): role is GlyphTemplate["semantic_role"] => Boolean(role)),
  );

const findRecipeForGraph = (graph: SpellGraph): SpellRecipe => {
  const roles = graphRoles(graph);
  return (
    spellRecipes.find((recipe) =>
      recipe.requiredRoles.every((role) => roles.has(role)),
    ) ?? fallbackSpellRecipe
  );
};

const getPrimaryOutcome = (
  semanticResults: readonly SemanticMarginResult[],
): SpellCard["recognitionOutcome"] =>
  semanticResults.find((result) => CASTABLE_OUTCOMES.has(result.outcome))?.outcome ??
  "partial";

const getAverageConfidence = (semanticResults: readonly SemanticMarginResult[]): number => {
  if (semanticResults.length === 0) {
    return 0;
  }

  return (
    semanticResults.reduce((sum, result) => sum + result.confidence, 0) /
    semanticResults.length
  );
};

const hasNodeKind = (graph: SpellGraph, kind: SpellGraphNode["kind"]): boolean =>
  graph.nodes.some((node) => node.kind === kind);

const getCardKind = (graph: SpellGraph, recipe: SpellRecipe): SpellCard["kind"] => {
  if (recipe.kind !== "utility") return recipe.kind;
  if (hasNodeKind(graph, "defense")) return "defense";
  if (hasNodeKind(graph, "action") || hasNodeKind(graph, "element")) return "attack";
  return "utility";
};

const getCardName = (graph: SpellGraph, recipe: SpellRecipe): string => {
  const element = graph.nodes.find((node) => node.kind === "element");
  const form = graph.nodes.find((node) => node.kind === "form" || node.kind === "defense");

  if (!element && !form) {
    return recipe.name;
  }

  return [element?.displayName, form?.displayName, recipe.name]
    .filter(Boolean)
    .join(" / ");
};

const buildSpellCard = (
  graph: SpellGraph,
  semanticResults: readonly SemanticMarginResult[],
): SpellCard => {
  const recipe = findRecipeForGraph(graph);
  const averageConfidence = getAverageConfidence(semanticResults);
  const componentCount = graph.nodes.filter((node) => node.family !== "default").length;
  const stability = clamp(Math.round(averageConfidence * 100), 1, 100);
  const potency = Math.round(recipe.basePower * (0.7 + averageConfidence * 0.6));
  const inkCost = Math.max(1, recipe.baseInkCost + Math.max(0, componentCount - 4));

  return {
    id: graph.spellHash,
    name: getCardName(graph, recipe),
    kind: getCardKind(graph, recipe),
    graph,
    recipeId: recipe.id,
    inkCost,
    stability,
    potency,
    target: recipe.target,
    recognitionOutcome: getPrimaryOutcome(semanticResults),
    componentTemplateIds: graph.nodes
      .filter((node) => node.family !== "default")
      .map((node) => node.templateId),
  };
};

const makeCandidate = (
  template: GlyphTemplate,
  rank: number,
  confidence: number,
): TemplateMatchCandidate => ({
  template,
  rank,
  confidence,
  shapeConfidence: confidence,
  meanDistance: Math.max(0, (1 - confidence) * 24),
  strokeCountDelta: 0,
  sampledPointCount: template.strokes.reduce((sum, stroke) => sum + stroke.length, 0),
});

const makeDefaultSemanticResult = (
  templateId: string,
  rank: number,
  confidence = DEFAULT_TEMPLATE_CONFIDENCE,
): SemanticMarginResult | null => {
  const template = getGlyphById(templateId);
  if (!template) return null;

  return {
    outcome: confidence >= 0.78 ? "cast_clean" : "partial",
    candidate: makeCandidate(template, rank, confidence),
    riskLevel: template.semantic_role === "risk" || template.semantic_role === "ink"
      ? "high"
      : template.semantic_role === "action" || template.semantic_role === "defense" || template.semantic_role === "form"
        ? "medium"
        : "low",
    confidence,
    minConfidence: template.recognition.min_confidence,
    semanticMargin: Math.max(template.recognition.min_semantic_margin, 0.2),
    minSemanticMargin: template.recognition.min_semantic_margin,
    topologyValid: true,
    reasons: [
      {
        code: "spellgraph_safe_default",
        message: `Defaulted missing SpellGraph role with ${template.id}.`,
        severity: "info",
      },
    ],
  };
};

const withSafeGraphDefaults = (
  semanticResults: readonly SemanticMarginResult[],
): readonly SemanticMarginResult[] => {
  const roles = semanticRoles(semanticResults);
  const defaults: SemanticMarginResult[] = [];
  const pushDefault = (templateId: string) => {
    const semantic = makeDefaultSemanticResult(templateId, semanticResults.length + defaults.length + 1);
    if (semantic) defaults.push(semantic);
  };

  if (!roles.has("container")) pushDefault("FRAME_CIRCLE_CONTAINMENT");
  if (!roles.has("source")) pushDefault("SOURCE_DOT");

  if (!roles.has("action") && !roles.has("form") && !roles.has("defense")) {
    pushDefault("ACTION_EMIT");
    pushDefault("FORM_PROJECTILE");
  } else if (roles.has("action") && !roles.has("form") && !roles.has("defense")) {
    pushDefault("FORM_PROJECTILE");
  }

  if (!roles.has("target")) pushDefault("TARGET_ENEMY");

  return [...semanticResults, ...defaults];
};

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
  const groups: StrokeGroup[] = [];

  for (let first = 0; first < strokes.length; first += 1) {
    groups.push({ strokes: [strokes[first]], indexes: [first] });

    for (let second = first + 1; second < strokes.length; second += 1) {
      const pair = [strokes[first], strokes[second]];
      if (canGroup(pair)) groups.push({ strokes: pair, indexes: [first, second] });

      for (let third = second + 1; third < strokes.length; third += 1) {
        const triple = [strokes[first], strokes[second], strokes[third]];
        if (triple.length <= MAX_COMPONENT_GROUP_SIZE && canGroup(triple)) {
          groups.push({ strokes: triple, indexes: [first, second, third] });
        }
      }
    }
  }

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
        message: "Component was useful enough for SpellGraph assembly despite ambiguity.",
        severity: "warning",
      },
    ],
  };
};

const recognizeComponentGroup = (group: StrokeGroup): ComponentRecognition | null => {
  const match = matchGlyphTemplates(group.strokes, DEFAULT_COMPONENT_MATCH_OPTIONS);
  if (!match.topCandidate || match.inputRejected) return null;

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

  return {
    semantic,
    match,
    topology,
    indexes: group.indexes,
    score: semantic.confidence + match.semanticMargin * 0.45 + group.indexes.length * 0.015,
  };
};

const selectComponentRecognitions = (
  recognitions: readonly ComponentRecognition[],
): readonly ComponentRecognition[] => {
  const usedIndexes = new Set<number>();
  const usedTemplateIds = new Set<string>();
  const selected: ComponentRecognition[] = [];

  for (const recognition of [...recognitions].sort((a, b) => b.score - a.score)) {
    if (recognition.indexes.some((index) => usedIndexes.has(index))) continue;

    const templateId = recognition.semantic.candidate?.template.id;
    const role = recognition.semantic.candidate?.template.semantic_role;
    const isRepeatable = role === "element" || role === "derived" || role === "risk" || role === "ink";
    if (templateId && usedTemplateIds.has(templateId) && !isRepeatable) continue;

    selected.push(recognition);
    recognition.indexes.forEach((index) => usedIndexes.add(index));
    if (templateId) usedTemplateIds.add(templateId);
  }

  return selected.sort((a, b) => a.indexes[0] - b.indexes[0]);
};

const recognizeSpellComponents = (
  strokes: readonly RecognitionStroke[],
): readonly ComponentRecognition[] => {
  const drawableStrokes = strokes.filter((stroke) => stroke.points.length >= 5);
  const groups = buildStrokeGroups(drawableStrokes);
  return selectComponentRecognitions(
    groups
      .map(recognizeComponentGroup)
      .filter((recognition): recognition is ComponentRecognition => Boolean(recognition)),
  );
};

export const compileSpellCardFromSemanticResults = (
  semanticResults: readonly SemanticMarginResult[],
): SpellCompileResult => {
  const completeSemanticResults = withSafeGraphDefaults(semanticResults);
  const graphInputs = semanticResultsToGraphInputs(completeSemanticResults);
  const graphResult = compileSpellGraph(graphInputs);

  if (!graphResult.ok) {
    const fallbackSemantic = semanticResults[0];

    return {
      ok: false,
      failure: {
        code: "graph_invalid",
        message: "Recognized glyphs did not satisfy the minimum SpellGraph grammar.",
        outcome: "graph_invalid",
        diegeticFailure: resolveDiegeticFailure({
          outcome: "graph_invalid",
          semantic: fallbackSemantic,
          graphIssues: graphResult.issues,
        }),
        graphIssues: graphResult.issues,
      },
      semanticResults: completeSemanticResults,
    };
  }

  return {
    ok: true,
    card: buildSpellCard(graphResult.graph, semanticResults),
    semanticResults: completeSemanticResults,
  };
};

export const compileSpellFromStrokes = (
  strokes: readonly RecognitionStroke[],
): SpellCompileResult => {
  const componentRecognitions = recognizeSpellComponents(strokes);
  const componentSemanticResults = componentRecognitions.map((recognition) => recognition.semantic);

  if (componentSemanticResults.length > 0) {
    const compiled = compileSpellCardFromSemanticResults(componentSemanticResults);
    const primaryRecognition = componentRecognitions[0];

    if (!compiled.ok) {
      const failure = {
        ...compiled.failure,
        diegeticFailure: resolveDiegeticFailure({
          outcome: compiled.failure.outcome,
          match: primaryRecognition.match,
          topology: primaryRecognition.topology,
          semantic: primaryRecognition.semantic,
          graphIssues: compiled.failure.graphIssues,
          strokes,
        }),
        match: primaryRecognition.match,
        topology: primaryRecognition.topology,
        semantic: primaryRecognition.semantic,
      };

      return {
        ok: false,
        failure,
        semanticResults: compiled.semanticResults,
        telemetry: createRecognitionTelemetryEvent({
          rawStrokes: cloneTelemetryStrokes(strokes),
          match: primaryRecognition.match,
          topology: primaryRecognition.topology,
          semanticResults: compiled.semanticResults,
          failure,
          decision: "graph_invalid",
          context: { source: "player" },
        }),
      };
    }

    return {
      ok: true,
      card: compiled.card,
      match: primaryRecognition.match,
      topology: primaryRecognition.topology,
      semanticResults: compiled.semanticResults,
      telemetry: createRecognitionTelemetryEvent({
        rawStrokes: cloneTelemetryStrokes(strokes),
        match: primaryRecognition.match,
        topology: primaryRecognition.topology,
        semanticResults: compiled.semanticResults,
        decision: "accepted",
        context: { source: "player" },
      }),
    };
  }

  const match = matchGlyphTemplates(strokes);

  if (!match.topCandidate || match.inputRejected) {
    const semantic = evaluateSemanticMargin(match);
    const failure = {
      code: "recognition_rejected",
      message: "Drawing was rejected before SpellGraph compilation.",
      outcome: semantic.outcome,
      diegeticFailure: resolveDiegeticFailure({
        outcome: semantic.outcome,
        match,
        semantic,
        strokes,
      }),
      match,
      semantic,
    };

    return {
      ok: false,
      failure,
      semanticResults: [semantic],
      telemetry: createRecognitionTelemetryEvent({
        rawStrokes: cloneTelemetryStrokes(strokes),
        match,
        semanticResults: [semantic],
        failure,
        decision: "rejected",
        context: { source: "player" },
      }),
    };
  }

  const topology = validateGlyphTopology(match.normalized.strokes, match.topCandidate.template);
  const semantic = evaluateSemanticMargin(match, topology);

  if (!CASTABLE_OUTCOMES.has(semantic.outcome)) {
    const failure = {
      code: "semantic_rejected",
      message: "Top candidate was not stable enough to compile into a SpellGraph.",
      outcome: semantic.outcome,
      diegeticFailure: resolveDiegeticFailure({
        outcome: semantic.outcome,
        match,
        topology,
        semantic,
        strokes,
      }),
      match,
      topology,
      semantic,
    };

    return {
      ok: false,
      failure,
      semanticResults: [semantic],
      telemetry: createRecognitionTelemetryEvent({
        rawStrokes: cloneTelemetryStrokes(strokes),
        match,
        topology,
        semanticResults: [semantic],
        failure,
        decision: "rejected",
        context: { source: "player" },
      }),
    };
  }

  const compiled = compileSpellCardFromSemanticResults([semantic]);

  if (!compiled.ok) {
    const failure = {
      ...compiled.failure,
      diegeticFailure: resolveDiegeticFailure({
        outcome: compiled.failure.outcome,
        match,
        topology,
        semantic,
        graphIssues: compiled.failure.graphIssues,
        strokes,
      }),
      match,
      topology,
      semantic,
    };

    return {
      ok: false,
      failure,
      semanticResults: compiled.semanticResults,
      telemetry: createRecognitionTelemetryEvent({
        rawStrokes: cloneTelemetryStrokes(strokes),
        match,
        topology,
        semanticResults: compiled.semanticResults,
        failure,
        decision: "graph_invalid",
        context: { source: "player" },
      }),
    };
  }

  return {
    ok: true,
    card: compiled.card,
    match,
    topology,
    semanticResults: compiled.semanticResults,
    telemetry: createRecognitionTelemetryEvent({
      rawStrokes: cloneTelemetryStrokes(strokes),
      match,
      topology,
      semanticResults: compiled.semanticResults,
      decision: "accepted",
      context: { source: "player" },
    }),
  };
};
