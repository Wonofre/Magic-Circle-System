import type { MagicFormulaV2 } from "@/types/magicFormulaV2";
import type { SpellCardKind } from "@/types/spellCard";

export type CodexMasteryState = "discovered" | "practiced" | "mastered";

export interface CodexSpellEntry {
  readonly spellHash: string;
  readonly name: string;
  readonly kind: SpellCardKind;
  readonly codexTemplateIds?: readonly string[];
  readonly drawnTemplateIds?: readonly string[];
  readonly defaultedTemplateIds?: readonly string[];
  readonly componentTemplateIds: readonly string[];
  readonly formulaHash?: string;
  readonly visualHash?: string;
  readonly formulaV2?: MagicFormulaV2;
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
  readonly allowedRecipeIds: readonly string[];
  readonly allowedInkInfusionIds: readonly string[];
  readonly maxRiskLevel: "low" | "medium" | "high";
}
