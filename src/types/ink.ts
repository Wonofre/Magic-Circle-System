import type { SigilType, SignType } from "@/types/magic";
import type { SpellCard } from "@/types/spellCard";

export type InkRiskLevel = "low" | "medium" | "high";

export type InkFailureCode = "insufficient_ink" | "overload_risk";

export interface InkInfusionState {
  readonly id: string;
  readonly name: string;
  readonly costModifier?: number;
  readonly stabilityModifier?: number;
  readonly riskModifier?: number;
  readonly affinity?: SigilType;
}

export interface InkReservoir {
  readonly ink: number;
  readonly maxInk: number;
  readonly inkRegenPerTurn: number;
  readonly inkPurity: number;
  readonly inkViscosity: number;
  readonly inkVolatility: number;
  readonly inkAffinity: SigilType | null;
  readonly activeInfusionIds: readonly string[];
}

export interface LegacyInkCostInput {
  readonly sigils: readonly SigilType[];
  readonly signs: readonly SignType[];
  readonly precision: number;
  readonly infusions?: readonly InkInfusionState[];
}

export interface SpellCardInkCostInput {
  readonly card: SpellCard;
  readonly infusions?: readonly InkInfusionState[];
}

export interface InkCostBreakdown {
  readonly base: number;
  readonly complexity: number;
  readonly stability: number;
  readonly risk: number;
  readonly infusion: number;
  readonly total: number;
}

export interface InkSimulationResult {
  readonly ok: boolean;
  readonly cost: number;
  readonly remainingInk: number;
  readonly overloadChance: number;
  readonly breakdown: InkCostBreakdown;
  readonly failureCode?: InkFailureCode;
  readonly message?: string;
}
