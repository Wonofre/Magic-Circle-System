import { getGlyphById } from "@/data/glyphTemplates";
import { canTemplateBeDefaulted } from "@/data/magicOntology";
import { resolveDiegeticFailure } from "@/lib/recognizer/failureResolver";
import { compileSpellGraph, semanticResultsToGraphInputs } from "@/lib/recognizer/graphCompiler";
import { evaluateSemanticMargin } from "@/lib/recognizer/semanticMargin";
import { matchGlyphTemplates } from "@/lib/recognizer/templateMatcher";
import { validateGlyphTopology } from "@/lib/recognizer/topologyValidator";
import { interpretMandalaFormula } from "@/lib/spell/formulaInterpreter";
import { buildMandalaDocumentFromSemanticResults } from "@/lib/spell/mandalaDocument";
import { parseMandalaFromStrokes } from "@/lib/spell/mandalaParser";
import { resolveSpellCardName } from "@/lib/spell/spellNameResolver";
import { synthesizeSpellCardFields } from "@/lib/spell/spellSynthesizer";
import { createRecognitionTelemetryEvent, cloneTelemetryStrokes } from "@/lib/telemetry/recognitionTelemetry";
import type { GlyphTemplate } from "@/types/glyphTemplates";
import type {
  RecognitionStroke,
  SemanticMarginResult,
  TemplateMatchCandidate,
} from "@/types/recognition";
import type { MandalaDocumentBuildContext } from "@/lib/spell/mandalaDocument";
import type { SpellCard, SpellCompileResult } from "@/types/spellCard";
import type { SpellGraph } from "@/types/spellGraph";

const CASTABLE_OUTCOMES = new Set(["cast_clean", "cast_weak", "partial"]);
const DEFAULT_TEMPLATE_CONFIDENCE = 0.84;

const semanticRoles = (semanticResults: readonly SemanticMarginResult[]) =>
  new Set(
    semanticResults
      .map((result) => result.candidate?.template.semantic_role)
      .filter((role): role is GlyphTemplate["semantic_role"] => Boolean(role)),
  );

const getPrimaryOutcome = (
  semanticResults: readonly SemanticMarginResult[],
): SpellCard["recognitionOutcome"] =>
  semanticResults.find((result) => CASTABLE_OUTCOMES.has(result.outcome))?.outcome ??
  "partial";

const isDefaultedSemanticResult = (result: SemanticMarginResult): boolean =>
  result.reasons.some((reason) => reason.code === "spellgraph_safe_default");

const buildSpellCard = (
  graph: SpellGraph,
  semanticResults: readonly SemanticMarginResult[],
  mandalaContext?: MandalaDocumentBuildContext,
): SpellCard => {
  const drawnSemanticResults = semanticResults.filter((result) => !isDefaultedSemanticResult(result));
  const defaultedSemanticResults = semanticResults.filter(isDefaultedSemanticResult);
  const drawnTemplateIds = drawnSemanticResults
    .map((result) => result.candidate?.template.id)
    .filter((id): id is string => Boolean(id));
  const defaultedTemplateIds = defaultedSemanticResults
    .map((result) => result.candidate?.template.id)
    .filter((id): id is string => Boolean(id));
  const mandala = buildMandalaDocumentFromSemanticResults({
    graph,
    semanticResults,
    source: "freehand",
    context: mandalaContext,
  });
  const formula = interpretMandalaFormula(mandala);
  const synthesized = synthesizeSpellCardFields(graph, formula);

  return {
    id: formula.formulaHash,
    name: resolveSpellCardName(graph, synthesized.recipe),
    kind: synthesized.kind,
    graph,
    recipeId: synthesized.recipe.id,
    inkCost: synthesized.inkCost,
    stability: synthesized.stability,
    potency: synthesized.potency,
    target: synthesized.target,
    formula,
    effectSummary: synthesized.effectSummary,
    effectProfile: synthesized.effectProfile,
    recognitionOutcome: getPrimaryOutcome(semanticResults),
    drawnTemplateIds,
    defaultedTemplateIds,
    codexTemplateIds: drawnTemplateIds,
    componentTemplateIds: graph.nodes
      .filter((node) => node.family !== "default")
      .map((node) => node.templateId),
    mandala,
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
    if (!canTemplateBeDefaulted(templateId)) return;
    const semantic = makeDefaultSemanticResult(templateId, semanticResults.length + defaults.length + 1);
    if (semantic) defaults.push(semantic);
  };

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

export const compileSpellCardFromSemanticResults = (
  semanticResults: readonly SemanticMarginResult[],
  options: {
    readonly mandalaContext?: MandalaDocumentBuildContext;
    readonly preserveMandalaOrder?: boolean;
  } = {},
): SpellCompileResult => {
  const completeSemanticResults = withSafeGraphDefaults(semanticResults);
  const graphInputs = semanticResultsToGraphInputs(completeSemanticResults);
  const graphResult = compileSpellGraph(graphInputs, {
    preserveMandalaOrder: options.preserveMandalaOrder,
  });

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
    card: buildSpellCard(graphResult.graph, completeSemanticResults, options.mandalaContext),
    semanticResults: completeSemanticResults,
  };
};

export const compileSpellFromStrokes = (
  strokes: readonly RecognitionStroke[],
): SpellCompileResult => {
  const mandala = parseMandalaFromStrokes(strokes);
  const componentSemanticResults = mandala.semanticResults;

  if (componentSemanticResults.length > 0) {
    const compiled = compileSpellCardFromSemanticResults(componentSemanticResults, {
      mandalaContext: mandala.context,
      preserveMandalaOrder: true,
    });
    const primaryRecognition = mandala.primaryRecognition;

    if (!compiled.ok) {
      const failure = {
        ...compiled.failure,
        diegeticFailure: resolveDiegeticFailure({
          outcome: compiled.failure.outcome,
          match: primaryRecognition?.match,
          topology: primaryRecognition?.topology,
          semantic: primaryRecognition?.semantic,
          graphIssues: compiled.failure.graphIssues,
          strokes,
        }),
        match: primaryRecognition?.match,
        topology: primaryRecognition?.topology,
        semantic: primaryRecognition?.semantic,
      };

      return {
        ok: false,
        failure,
        semanticResults: compiled.semanticResults,
        telemetry: createRecognitionTelemetryEvent({
          rawStrokes: cloneTelemetryStrokes(strokes),
          match: primaryRecognition?.match,
          topology: primaryRecognition?.topology,
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
      match: primaryRecognition?.match,
      topology: primaryRecognition?.topology,
      semanticResults: compiled.semanticResults,
      telemetry: createRecognitionTelemetryEvent({
        rawStrokes: cloneTelemetryStrokes(strokes),
        match: primaryRecognition?.match,
        topology: primaryRecognition?.topology,
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
