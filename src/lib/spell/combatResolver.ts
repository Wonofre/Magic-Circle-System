import { calculateSpellCardInkCost } from "@/lib/spell/inkSimulator";
import { getWeaknessMultiplier, type CastResult } from "@/lib/spellEngine";
import type { Entity, SpellEffect, StatusEffect } from "@/types/magic";
import type { InkCostBreakdown } from "@/types/ink";
import type { SpellCard } from "@/types/spellCard";

export interface ResolvedSpellCardCast extends CastResult {
  readonly spellCard: SpellCard;
  readonly spellHash: string;
  readonly componentTemplateIds: readonly string[];
  readonly inkCostBreakdown: InkCostBreakdown;
}

export interface ResolveSpellCardCastInput {
  readonly card: SpellCard;
  readonly precision: number;
  readonly opponent: Entity;
  readonly inkCost: number;
  readonly inkRemaining?: number;
  readonly inkOverloadChance?: number;
  readonly inkCostBreakdown?: InkCostBreakdown;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

export const calculateFinalCastPrecision = (
  card: SpellCard,
  drawingPrecision?: number,
): number => {
  const circleQuality = Math.round((card.formula.castingCircle?.quality ?? 0) * 100);
  const basePrecision = drawingPrecision ?? card.stability;

  return Math.round(clamp(
    basePrecision * 0.25 + card.stability * 0.45 + circleQuality * 0.30,
    1,
    100,
  ));
};

export const summarizeSpellCardEffect = (card: SpellCard): string =>
  `${card.effectSummary} Potencia ${card.potency}.`;

const scaleStatuses = (
  statuses: readonly StatusEffect[],
  precisionFactor: number,
): StatusEffect[] =>
  statuses.map((status) => ({
    ...status,
    potency: Math.max(1, Math.round(status.potency * precisionFactor)),
  }));

export const resolveSpellCardCast = ({
  card,
  precision,
  opponent,
  inkCost,
  inkRemaining,
  inkOverloadChance,
  inkCostBreakdown = calculateSpellCardInkCost({ card }),
}: ResolveSpellCardCastInput): ResolvedSpellCardCast => {
  const primarySigil = card.effectProfile.element ?? card.formula.sigils[0]?.sigilId;
  const precisionFactor = Math.max(0.35, precision / 100);
  const elementalMultiplier = primarySigil && card.effectProfile.area !== "self"
    ? getWeaknessMultiplier(primarySigil, opponent.weakness)
    : 1;
  const adjustedPotency = Math.round(card.potency * precisionFactor);
  const affectsCaster = card.effectProfile.area === "self";
  const damage = affectsCaster || card.effectProfile.damageScale <= 0
    ? 0
    : Math.round(adjustedPotency * elementalMultiplier * card.effectProfile.damageScale);
  const healing = card.effectProfile.healingScale > 0
    ? Math.max(4, Math.round(adjustedPotency * card.effectProfile.healingScale))
    : 0;
  const shield = card.effectProfile.shieldScale > 0
    ? Math.max(5, Math.round(adjustedPotency * card.effectProfile.shieldScale))
    : 0;
  const statusEffects = scaleStatuses(card.effectProfile.statusEffects, precisionFactor);
  const fieldEffect = card.effectProfile.fieldEffect
    ? {
        ...card.effectProfile.fieldEffect,
        potency: Math.max(1, Math.round(card.effectProfile.fieldEffect.potency * precisionFactor)),
      }
    : undefined;
  const effects: SpellEffect[] = primarySigil
    ? [{
        element: primarySigil,
        form: card.effectProfile.form,
        power: card.potency,
        potency: Math.max(damage, healing, shield, adjustedPotency),
        accuracy: precision,
        area: card.effectProfile.area,
        statusEffects,
        fieldEffect,
        shieldBypassRatio: card.effectProfile.shieldBypassRatio,
        dispelPower: card.effectProfile.dispelPower,
        special: summarizeSpellCardEffect(card),
      }]
    : [];

  return {
    spellName: card.name,
    description: summarizeSpellCardEffect(card),
    damage,
    healing,
    shield,
    effects,
    statusEffects,
    fieldEffect,
    shieldBypassRatio: card.effectProfile.shieldBypassRatio,
    dispelPower: card.effectProfile.dispelPower,
    accuracy: precision,
    precision,
    isSuccess: damage > 0 || healing > 0 || shield > 0 || statusEffects.length > 0 || Boolean(fieldEffect) || card.effectProfile.dispelPower > 0,
    feedback: card.recognitionOutcome === "cast_weak"
      ? "A formula compilou, mas o circulo perdeu estabilidade."
      : `Formula ${card.formula.formulaHash} estabilizada: simetria ${Math.round(card.formula.symmetry.overall * 100)}%, rank ${card.formula.visual.rank}.`,
    elementalMultiplier,
    inkCost,
    inkRemaining,
    inkOverloadChance,
    formula: card.formula,
    spellCard: card,
    spellHash: card.id,
    componentTemplateIds: card.componentTemplateIds,
    inkCostBreakdown,
  };
};
