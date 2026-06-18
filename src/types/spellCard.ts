import type { GlyphSemanticRole } from "@/types/glyphTemplates";
import type {
  RecognitionOutcome,
  SemanticMarginResult,
  TemplateMatchResult,
  TopologyValidationResult,
} from "@/types/recognition";
import type { SpellEffectProfile, SpellFormula } from "@/types/spellFormula";
import type { FormulaGraphV2, FormulaIssueV2, MagicFormulaV2 } from "@/types/magicFormulaV2";
import type { DiegeticFailureResolution } from "@/lib/recognizer/failureResolver";
import type { RecognitionTelemetryEvent } from "@/types/telemetry";

export type SpellCardKind = "attack" | "defense" | "support" | "control" | "utility";

export interface SpellRecipe {
  readonly id: string;
  readonly name: string;
  readonly kind: SpellCardKind;
  readonly requiredRoles: readonly GlyphSemanticRole[];
  readonly optionalRoles?: readonly GlyphSemanticRole[];
  readonly basePower: number;
  readonly baseInkCost: number;
}

export interface SpellCard {
  readonly id: string;
  readonly name: string;
  readonly kind: SpellCardKind;
  readonly graph: FormulaGraphV2;
  readonly recipeId: string;
  readonly inkCost: number;
  readonly stability: number;
  readonly potency: number;
  readonly formula: SpellFormula;
  readonly effectSummary: string;
  readonly effectProfile: SpellEffectProfile;
  readonly recognitionOutcome: RecognitionOutcome;
  readonly drawnTemplateIds: readonly string[];
  readonly defaultedTemplateIds: readonly string[];
  readonly codexTemplateIds: readonly string[];
  readonly componentTemplateIds: readonly string[];
  readonly formulaV2: MagicFormulaV2;
}

export interface SpellCompileFailure {
  readonly code: string;
  readonly message: string;
  readonly outcome: RecognitionOutcome | "formula_invalid";
  readonly diegeticFailure?: DiegeticFailureResolution;
  readonly match?: TemplateMatchResult;
  readonly topology?: TopologyValidationResult;
  readonly semantic?: SemanticMarginResult;
  readonly formulaIssues?: readonly FormulaIssueV2[];
}

export type SpellCompileResult =
  | {
      readonly ok: true;
      readonly card: SpellCard;
      readonly match?: TemplateMatchResult;
      readonly topology?: TopologyValidationResult;
      readonly semanticResults: readonly SemanticMarginResult[];
      readonly telemetry?: RecognitionTelemetryEvent;
    }
  | {
      readonly ok: false;
      readonly failure: SpellCompileFailure;
      readonly semanticResults: readonly SemanticMarginResult[];
      readonly telemetry?: RecognitionTelemetryEvent;
    };
