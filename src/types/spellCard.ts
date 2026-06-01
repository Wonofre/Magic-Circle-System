import type { GlyphSemanticRole } from "@/types/glyphTemplates";
import type {
  RecognitionOutcome,
  SemanticMarginResult,
  TemplateMatchResult,
  TopologyValidationResult,
} from "@/types/recognition";
import type { SpellGraph, SpellGraphCompileIssue } from "@/types/spellGraph";
import type { DiegeticFailureResolution } from "@/lib/recognizer/failureResolver";
import type { RecognitionTelemetryEvent } from "@/types/telemetry";

export type SpellCardKind = "attack" | "defense" | "support" | "control" | "utility";

export type SpellCardTarget = "enemy" | "self" | "ally" | "area" | "default_enemy";

export interface SpellRecipe {
  readonly id: string;
  readonly name: string;
  readonly kind: SpellCardKind;
  readonly requiredRoles: readonly GlyphSemanticRole[];
  readonly optionalRoles?: readonly GlyphSemanticRole[];
  readonly basePower: number;
  readonly baseInkCost: number;
  readonly target: SpellCardTarget;
}

export interface SpellCard {
  readonly id: string;
  readonly name: string;
  readonly kind: SpellCardKind;
  readonly graph: SpellGraph;
  readonly recipeId: string;
  readonly inkCost: number;
  readonly stability: number;
  readonly potency: number;
  readonly target: SpellCardTarget;
  readonly recognitionOutcome: RecognitionOutcome;
  readonly componentTemplateIds: readonly string[];
}

export interface SpellCompileFailure {
  readonly code: string;
  readonly message: string;
  readonly outcome: RecognitionOutcome | "graph_invalid";
  readonly diegeticFailure?: DiegeticFailureResolution;
  readonly match?: TemplateMatchResult;
  readonly topology?: TopologyValidationResult;
  readonly semantic?: SemanticMarginResult;
  readonly graphIssues?: readonly SpellGraphCompileIssue[];
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
