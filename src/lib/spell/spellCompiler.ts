import { fallbackSpellRecipe, spellRecipes } from "@/data/spellRecipes";
import { resolveDiegeticFailure } from "@/lib/recognizer/failureResolver";
import { compileSpellGraph, semanticResultsToGraphInputs } from "@/lib/recognizer/graphCompiler";
import { evaluateSemanticMargin } from "@/lib/recognizer/semanticMargin";
import { matchGlyphTemplates } from "@/lib/recognizer/templateMatcher";
import { validateGlyphTopology } from "@/lib/recognizer/topologyValidator";
import { createRecognitionTelemetryEvent, cloneTelemetryStrokes } from "@/lib/telemetry/recognitionTelemetry";
import type { RecognitionStroke, SemanticMarginResult } from "@/types/recognition";
import type { SpellCard, SpellCompileResult, SpellRecipe } from "@/types/spellCard";
import type { SpellGraph, SpellGraphNode } from "@/types/spellGraph";

const CASTABLE_OUTCOMES = new Set(["cast_clean", "cast_weak", "partial"]);

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const graphRoles = (graph: SpellGraph) =>
  new Set(graph.nodes.map((node) => node.semanticRole));

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

export const compileSpellCardFromSemanticResults = (
  semanticResults: readonly SemanticMarginResult[],
): SpellCompileResult => {
  const graphInputs = semanticResultsToGraphInputs(semanticResults);
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
      semanticResults,
    };
  }

  return {
    ok: true,
    card: buildSpellCard(graphResult.graph, semanticResults),
    semanticResults,
  };
};

export const compileSpellFromStrokes = (
  strokes: readonly RecognitionStroke[],
): SpellCompileResult => {
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
