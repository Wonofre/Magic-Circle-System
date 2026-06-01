import type { SigilType, SignType } from "@/types/magic";
import type { SpellCardKind, SpellCardTarget } from "@/types/spellCard";

export type CodexMasteryState = "discovered" | "practiced" | "mastered";

export interface CodexSpellEntry {
  readonly spellHash: string;
  readonly name: string;
  readonly kind: SpellCardKind;
  readonly target: SpellCardTarget;
  readonly componentTemplateIds: readonly string[];
  readonly legacySigils?: readonly SigilType[];
  readonly legacySigns?: readonly SignType[];
  readonly effectSummary: string;
  readonly bestPrecision: number;
  readonly bestStability: number;
  readonly bestPotency: number;
  readonly inkCost: number;
  readonly discoveredAt: string;
  readonly lastCastAt: string;
  readonly castCount: number;
  readonly mastery: CodexMasteryState;
}

export interface GrimoireLoadout {
  readonly knownGlyphIds: readonly string[];
  readonly discoveredGlyphIds: readonly string[];
  readonly masteredGlyphIds: readonly string[];
  /** @deprecated Legacy bridge only. New gameplay validates glyph template ids. */
  readonly knownLegacySigils: readonly SigilType[];
  /** @deprecated Legacy bridge only. New gameplay validates glyph template ids. */
  readonly knownLegacySigns: readonly SignType[];
  readonly allowedRecipeIds: readonly string[];
  readonly allowedInkInfusionIds: readonly string[];
  readonly maxRiskLevel: "low" | "medium" | "high";
}
