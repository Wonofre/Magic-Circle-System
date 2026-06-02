import { fallbackSpellRecipe, spellRecipes } from "@/data/spellRecipes";
import { getRuneByTemplateId } from "@/data/magicOntology";
import { inferSpellKindFromEffect, synthesizeSpellEffectProfile } from "@/lib/spell/spellEffectSynthesizer";
import type { SpellRecipe, SpellCardKind, SpellCardTarget } from "@/types/spellCard";
import type { SpellEffectProfile, SpellFormula } from "@/types/spellFormula";
import type { SpellGraph } from "@/types/spellGraph";

export interface SynthesizedSpellCardFields {
  readonly kind: SpellCardKind;
  readonly recipe: SpellRecipe;
  readonly inkCost: number;
  readonly stability: number;
  readonly potency: number;
  readonly target: SpellCardTarget;
  readonly effectSummary: string;
  readonly effectProfile: SpellEffectProfile;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const graphRoles = (graph: SpellGraph) =>
  new Set(graph.nodes.map((node) => node.semanticRole));

const findNamedRecipeForGraph = (graph: SpellGraph): SpellRecipe => {
  const roles = graphRoles(graph);
  return (
    spellRecipes.find((recipe) =>
      recipe.requiredRoles.every((role) => roles.has(role)),
    ) ?? fallbackSpellRecipe
  );
};

const getBasePower = (formula: SpellFormula): number => {
  const runePower = formula.elements
    .map((rune) => getRuneByTemplateId(rune.templateId)?.gameplay?.basePower)
    .filter((value): value is number => typeof value === "number");
  if (runePower.length === 0) return 14;
  return runePower.reduce((sum, value) => sum + value, 0) / runePower.length;
};

const stabilityFromFormula = (formula: SpellFormula): number => {
  const drawnAverage = formula.allRunes
    .filter((rune) => rune.isDrawn)
    .reduce((sum, rune, _, runes) => sum + rune.confidence / Math.max(1, runes.length), 0);
  const zoneScore = formula.allRunes.every((rune) => rune.expectedZoneMatched) ? 8 : -8;
  return Math.round(clamp(
    formula.circleQuality.overall * 0.58 +
      drawnAverage * 100 * 0.28 +
      (100 - formula.instability) * 0.14 +
      zoneScore,
    1,
    100,
  ));
};

export const synthesizeSpellCardFields = (
  graph: SpellGraph,
  formula: SpellFormula,
): SynthesizedSpellCardFields => {
  const namedRecipe = findNamedRecipeForGraph(graph);
  const effectProfile = synthesizeSpellEffectProfile(formula);
  const kind = inferSpellKindFromEffect(effectProfile);
  const target = effectProfile.target;
  const stability = stabilityFromFormula(formula);
  const formMultiplier =
    effectProfile.area === "area" ? 1.08 :
    effectProfile.area === "cone" ? 1.03 :
    effectProfile.area === "line" ? 1.05 :
    effectProfile.area === "self" ? 0.96 :
    1;
  const potency = Math.round(clamp(
    getBasePower(formula) *
      formula.amplification *
      formMultiplier *
      (0.72 + stability / 180),
    4,
    80,
  ));
  const riskCost = formula.modifiers.some((rune) => rune.role === "risk") ? 2 : 0;
  const defaultDiscount = Math.min(1, formula.allRunes.filter((rune) => rune.isDefault).length * 0.25);
  const inkCost = Math.max(1, Math.round(
    2 +
      formula.complexity * 0.55 +
      formula.instability / 32 +
      riskCost -
      (formula.circleQuality.overall >= 90 ? 1 : 0) -
      defaultDiscount,
  ));

  return {
    kind,
    recipe: namedRecipe,
    inkCost,
    stability,
    potency,
    target,
    effectSummary: effectProfile.summary,
    effectProfile,
  };
};
