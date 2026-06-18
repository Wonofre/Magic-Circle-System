import { parseMandalaV2FromStrokes } from "@/lib/recognizerV2/mandalaParserV2";
import { parseMandalaV2CandidatesFused } from "@/lib/recognizerV2/mandalaParserV2";
import { chooseParsedCandidate } from "@/lib/recognizerV2/candidateRanker";
import type { RecognitionContext } from "@/lib/recognizerV2/recognitionContext";
import { compileMagicFormulaV2 } from "@/lib/spellV2/formulaCompilerV2";
import { buildFormulaGraphV2 } from "@/lib/spellV2/formulaGraphV2";
import {
  inferSpellKindFromFormulaV2,
  synthesizeSpellEffectProfileV2,
} from "@/lib/spellV2/spellEffectSynthesizerV2";
import { createRecognitionTelemetryEvent, cloneTelemetryStrokes } from "@/lib/telemetry/recognitionTelemetry";
import { resolveDiegeticFailure } from "@/lib/recognizer/failureResolver";
import type {
  ProbabilisticRecognitionResult,
  RecognitionOutcome,
  RecognitionStroke,
  SemanticMarginResult,
} from "@/types/recognition";
import type { SpellCard, SpellCompileResult, SpellRecipe } from "@/types/spellCard";
import type { MagicFormulaV2 } from "@/types/magicFormulaV2";

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const recipeForFormula = (formula: MagicFormulaV2): SpellRecipe => {
  const keyIds = new Set(formula.keys.map((key) => key.keyId));

  if (keyIds.has("SHIELD") || keyIds.has("BUBBLE")) {
    return {
      id: "shield_visual_formula",
      name: "Defesa Circular",
      kind: "defense",
      requiredRoles: ["container", "element", "defense"],
      optionalRoles: ["form", "action"],
      basePower: 16,
      baseInkCost: 3,
    };
  }

  if (keyIds.has("FIELD") || keyIds.has("TRAP")) {
    return {
      id: "field_visual_formula",
      name: "Campo Mandalico",
      kind: "control",
      requiredRoles: ["container", "element", "form"],
      optionalRoles: ["action"],
      basePower: 14,
      baseInkCost: 4,
    };
  }

  if (keyIds.has("PROJECTILE") || keyIds.has("PIERCE")) {
    return {
      id: "projectile_visual_formula",
      name: "Projetil Mandalico",
      kind: "attack",
      requiredRoles: ["container", "element", "form"],
      optionalRoles: ["action"],
      basePower: 18,
      baseInkCost: 3,
    };
  }

  return {
    id: "improvised_formula_v2",
    name: "Mandala Improvisada",
    kind: "utility",
    requiredRoles: ["container", "element"],
    optionalRoles: ["action", "form", "defense"],
    basePower: 10,
    baseInkCost: 2,
  };
};

const stabilityFromFormula = (formula: MagicFormulaV2): number => {
  const circle = formula.castingCircle?.quality ?? 0;
  const identifiedComponents = [...formula.sigils, ...formula.keys];
  const identificationConfidence = identifiedComponents.length > 0
    ? identifiedComponents.reduce((sum, component) => sum + component.confidence, 0) /
      identifiedComponents.length
    : 0;
  const validityBonus = formula.validity === "valid_visual_formula" ? 8 : formula.validity === "partial" ? -6 : -24;
  return Math.round(clamp(
    identificationConfidence * 48 +
      circle * 28 +
      formula.symmetry.overall * 18 +
      (1 - formula.visual.instability) * 8 +
      validityBonus,
    1,
    100,
  ));
};

const potencyFromFormula = (formula: MagicFormulaV2, recipe: SpellRecipe, stability: number): number =>
  Math.round(clamp(
    recipe.basePower *
      (0.65 + stability / 180) *
      (1 + formula.channels.filter((channel) => channel.geometry === "orbital_arc").length * 0.06),
    4,
    72,
  ));

const recognitionOutcomeFromResults = (
  formula: MagicFormulaV2,
  semanticResults: readonly SemanticMarginResult[],
): RecognitionOutcome => {
  if (formula.validity !== "valid_visual_formula") return "partial";
  if (semanticResults.some((semantic) => semantic.outcome === "partial")) return "partial";
  if (semanticResults.some((semantic) => semantic.outcome === "cast_weak")) return "cast_weak";
  return "cast_clean";
};

const buildSpellCard = (
  formula: MagicFormulaV2,
  semanticResults: readonly SemanticMarginResult[] = [],
): SpellCard => {
  const recipe = recipeForFormula(formula);
  const effectProfile = synthesizeSpellEffectProfileV2(formula);
  const kind = inferSpellKindFromFormulaV2(formula);
  const stability = stabilityFromFormula(formula);
  const potency = potencyFromFormula(formula, recipe, stability);
  const inkCost = Math.max(1, Math.round(recipe.baseInkCost + formula.keys.length * 0.35 + formula.channels.length * 0.45 + formula.visual.instability * 2));

  return {
    id: formula.formulaHash,
    name: formula.name,
    kind,
    graph: buildFormulaGraphV2(formula),
    recipeId: recipe.id,
    inkCost,
    stability,
    potency,
    formula,
    formulaV2: formula,
    effectSummary: effectProfile.summary,
    effectProfile,
    recognitionOutcome: recognitionOutcomeFromResults(formula, semanticResults),
    drawnTemplateIds: formula.sourceTemplateIds,
    defaultedTemplateIds: [],
    codexTemplateIds: formula.sourceTemplateIds,
    componentTemplateIds: formula.sourceTemplateIds,
  };
};

export interface SpellCompileOptions {
  readonly recognitionContext?: RecognitionContext;
}

const failureResult = ({
  strokes,
  formula,
  semanticResults,
  probabilistic,
}: {
  readonly strokes: readonly RecognitionStroke[];
  readonly formula: MagicFormulaV2;
  readonly semanticResults: readonly SemanticMarginResult[];
  readonly probabilistic?: ProbabilisticRecognitionResult;
}): SpellCompileResult => {
  const message =
    formula.issues.find((entry) => entry.severity === "error")?.message ??
    "Formula v2 invalida.";
  const failure = {
    code: "formula_v2_invalid",
    message,
    outcome: "formula_invalid" as const,
    diegeticFailure: resolveDiegeticFailure({
      outcome: "formula_invalid",
      semantic: semanticResults[0],
      formulaIssues: formula.issues,
      strokes,
    }),
    formulaIssues: formula.issues,
  };

  return {
    ok: false,
    failure,
    semanticResults,
    telemetry: createRecognitionTelemetryEvent({
      rawStrokes: cloneTelemetryStrokes(strokes),
      semanticResults,
      failure,
      decision: "formula_invalid",
      context: { source: "player" },
      probabilistic,
    }),
  };
};

const successResult = ({
  strokes,
  formula,
  semanticResults,
  probabilistic,
}: {
  readonly strokes: readonly RecognitionStroke[];
  readonly formula: MagicFormulaV2;
  readonly semanticResults: readonly SemanticMarginResult[];
  readonly probabilistic?: ProbabilisticRecognitionResult;
}): SpellCompileResult => {
  const card = buildSpellCard(formula, semanticResults);
  return {
    ok: true,
    card,
    semanticResults,
    telemetry: createRecognitionTelemetryEvent({
      rawStrokes: cloneTelemetryStrokes(strokes),
      semanticResults,
      decision: "accepted",
      context: { source: "player" },
      probabilistic,
    }),
  };
};

export const compileSpellFromStrokesSync = (
  strokes: readonly RecognitionStroke[],
): SpellCompileResult => {
  const parsed = parseMandalaV2FromStrokes(strokes);
  const formula = compileMagicFormulaV2(parsed);

  if (formula.validity === "invalid") {
    return failureResult({ strokes, formula, semanticResults: [] });
  }

  return successResult({ strokes, formula, semanticResults: [] });
};

export const compileSpellFromStrokes = async (
  strokes: readonly RecognitionStroke[],
  options?: SpellCompileOptions,
): Promise<SpellCompileResult> => {
  const parsedCandidates = await parseMandalaV2CandidatesFused(strokes);
  const selected = chooseParsedCandidate(
    parsedCandidates.candidates,
    options?.recognitionContext,
  );

  if (selected.formula.validity === "invalid") {
    return failureResult({
      strokes,
      formula: selected.formula,
      semanticResults: selected.candidate.semanticResults,
      probabilistic: parsedCandidates.probabilistic,
    });
  }

  return successResult({
    strokes,
    formula: selected.formula,
    semanticResults: selected.candidate.semanticResults,
    probabilistic: parsedCandidates.probabilistic,
  });
};
