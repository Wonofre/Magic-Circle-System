import type { Entity, SigilType, SignType } from "@/types/magic";
import type {
  InkCostBreakdown,
  InkInfusionState,
  InkReservoir,
  InkSimulationResult,
  LegacyInkCostInput,
  SpellCardInkCostInput,
} from "@/types/ink";

const HIGH_RISK_SIGILS: readonly SigilType[] = ["fire", "thunder", "shadow", "void"];
const HIGH_RISK_SIGNS: readonly SignType[] = ["crush", "explosion", "convergence", "chain"];

export const DEFAULT_PLAYER_INK: InkReservoir = {
  ink: 24,
  maxInk: 24,
  inkRegenPerTurn: 6,
  inkPurity: 1,
  inkViscosity: 0.5,
  inkVolatility: 0.12,
  inkAffinity: null,
  activeInfusionIds: [],
};

export const DEFAULT_ENEMY_INK: InkReservoir = {
  ink: 9,
  maxInk: 9,
  inkRegenPerTurn: 2,
  inkPurity: 0.9,
  inkViscosity: 0.55,
  inkVolatility: 0.18,
  inkAffinity: null,
  activeInfusionIds: [],
};

export function clampInk(value: number, maxInk: number): number {
  return Math.max(0, Math.min(maxInk, Math.round(value)));
}

export function getInkReservoir(entity: Entity): InkReservoir {
  return {
    ink: entity.ink,
    maxInk: entity.maxInk,
    inkRegenPerTurn: entity.inkRegenPerTurn,
    inkPurity: entity.inkPurity,
    inkViscosity: entity.inkViscosity,
    inkVolatility: entity.inkVolatility,
    inkAffinity: entity.inkAffinity,
    activeInfusionIds: entity.activeInfusionIds,
  };
}

export function regenerateInk<T extends Entity>(entity: T): T {
  return {
    ...entity,
    ink: clampInk(entity.ink + entity.inkRegenPerTurn, entity.maxInk),
  };
}

export function spendInk<T extends Entity>(entity: T, cost: number): T {
  return {
    ...entity,
    ink: clampInk(entity.ink - Math.max(0, cost), entity.maxInk),
  };
}

function getInfusionModifier(infusions: readonly InkInfusionState[] = []): number {
  return infusions.reduce((total, infusion) => total + (infusion.costModifier ?? 0), 0);
}

function countHighRiskParts(sigils: readonly SigilType[], signs: readonly SignType[]): number {
  return (
    sigils.filter(sigil => HIGH_RISK_SIGILS.includes(sigil)).length +
    signs.filter(sign => HIGH_RISK_SIGNS.includes(sign)).length
  );
}

export function calculateLegacySpellInkCost(input: LegacyInkCostInput): InkCostBreakdown {
  const uniqueSigils = new Set(input.sigils).size;
  const uniqueSigns = new Set(input.signs).size;
  const complexity = Math.max(0, uniqueSigils - 1) * 2 + uniqueSigns;
  const precisionPenalty = input.precision >= 85 ? -1 : input.precision < 55 ? 2 : input.precision < 70 ? 1 : 0;
  const risk = countHighRiskParts(input.sigils, input.signs);
  const infusion = getInfusionModifier(input.infusions);
  const base = 2;
  const total = Math.max(1, Math.round(base + complexity + precisionPenalty + risk + infusion));

  return {
    base,
    complexity,
    stability: precisionPenalty,
    risk,
    infusion,
    total,
  };
}

export function calculateSpellCardInkCost(input: SpellCardInkCostInput): InkCostBreakdown {
  const stabilityPenalty = Math.max(0, Math.round((1 - input.card.stability) * 4));
  const risk = input.card.recognitionOutcome === "backfire" ? 4 : input.card.recognitionOutcome === "cast_weak" ? 1 : 0;
  const infusion = getInfusionModifier(input.infusions);
  const base = Math.max(1, input.card.inkCost);
  const total = Math.max(1, Math.round(base + stabilityPenalty + risk + infusion));

  return {
    base,
    complexity: Math.max(0, input.card.componentTemplateIds.length - 3),
    stability: stabilityPenalty,
    risk,
    infusion,
    total,
  };
}

export function simulateInkSpend(reservoir: InkReservoir, breakdown: InkCostBreakdown): InkSimulationResult {
  const remainingInk = clampInk(reservoir.ink - breakdown.total, reservoir.maxInk);
  const overloadChance = Math.max(
    0,
    Math.min(1, reservoir.inkVolatility + breakdown.risk * 0.04 + Math.max(0, breakdown.infusion) * 0.03 - reservoir.inkPurity * 0.08),
  );

  if (reservoir.ink < breakdown.total) {
    return {
      ok: false,
      cost: breakdown.total,
      remainingInk: reservoir.ink,
      overloadChance,
      breakdown,
      failureCode: "insufficient_ink",
      message: `Tinta insuficiente: requer ${breakdown.total}, disponivel ${reservoir.ink}.`,
    };
  }

  return {
    ok: true,
    cost: breakdown.total,
    remainingInk,
    overloadChance,
    breakdown,
  };
}
