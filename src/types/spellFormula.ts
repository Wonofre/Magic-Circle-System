import type {
  ElementSigilId,
  FutureEffectHintsV2,
  MagicFormulaV2,
  MagicKeyId,
} from "@/types/magicFormulaV2";
import type { BattlefieldEffect, StatusEffect } from "@/types/magic";

export type SpellEffectArea = "single" | "line" | "cone" | "area" | "self";

export type SpellFormula = MagicFormulaV2;

export interface SpellEffectProfile {
  readonly element?: ElementSigilId;
  readonly form: MagicKeyId;
  readonly area: SpellEffectArea;
  readonly futureEffectHints: FutureEffectHintsV2;
  readonly damageScale: number;
  readonly healingScale: number;
  readonly shieldScale: number;
  readonly controlScale: number;
  readonly statusEffects: readonly StatusEffect[];
  readonly fieldEffect?: BattlefieldEffect;
  readonly shieldBypassRatio: number;
  readonly dispelPower: number;
  readonly summary: string;
}
