import type {
  RecognitionStroke,
  SemanticMarginResult,
  TemplateMatchCandidate,
  TemplateMatchResult,
  TopologyValidationResult,
} from "@/types/recognition";
import type { SpellCompileFailure } from "@/types/spellCard";

export type RecognitionDecision =
  | "accepted"
  | "rejected"
  | "graph_invalid"
  | "legacy_bridge_fallback"
  | "fixture_expected_reject";

export interface RecognitionTelemetryContext {
  readonly source: "player" | "enemy" | "fixture" | "debug";
  readonly turn?: number;
  readonly expectedGlyphId?: string;
  readonly fixtureId?: string;
}

export interface RecognitionTelemetryCandidate {
  readonly templateId: string;
  readonly family: string;
  readonly semanticRole: string;
  readonly rank: number;
  readonly confidence: number;
  readonly meanDistance: number;
  readonly matchedVariant?: string;
  readonly contextScore?: number;
  readonly scoreBreakdown?: {
    readonly sequentialConfidence: number;
    readonly pointCloudConfidence: number;
    readonly chamferDistance: number;
    readonly meanDistance: number;
    readonly strokeCountPenalty: number;
    readonly variantConfidence: number;
  };
}

export interface RecognitionTelemetryEvent {
  readonly id: string;
  readonly createdAt: string;
  readonly context: RecognitionTelemetryContext;
  readonly rawStrokes: readonly RecognitionStroke[];
  readonly normalizedStrokes: readonly RecognitionStroke[];
  readonly candidates: readonly RecognitionTelemetryCandidate[];
  readonly semanticMargin: number;
  readonly topologyValid: boolean | null;
  readonly failureCodes: readonly string[];
  readonly decision: RecognitionDecision;
  readonly acceptedTemplateId: string | null;
  readonly expectedGlyphId?: string;
  readonly fallbackUsed?: "legacy_bridge";
}

export interface HardNegativeFixtureCase {
  readonly id: string;
  readonly label: string;
  readonly strokes: readonly RecognitionStroke[];
  readonly expectedDecision: "rejected";
  readonly reason: string;
}

export interface RecognitionMetricSummary {
  readonly sampleCount: number;
  readonly falsePositiveCount: number;
  readonly falseNegativeCount: number;
  readonly precision: number;
  readonly recall: number;
  readonly f1: number;
}

export interface GlyphConfusionMatrixRow {
  readonly expectedGlyphId: string;
  readonly predictedGlyphId: string;
  readonly count: number;
}

export interface RecognitionTelemetryInput {
  readonly rawStrokes: readonly RecognitionStroke[];
  readonly match?: TemplateMatchResult;
  readonly topology?: TopologyValidationResult;
  readonly semanticResults?: readonly SemanticMarginResult[];
  readonly failure?: SpellCompileFailure;
  readonly decision: RecognitionDecision;
  readonly context: RecognitionTelemetryContext;
  readonly fallbackUsed?: "legacy_bridge";
}

export type CandidateLike = Pick<
  TemplateMatchCandidate,
  | "rank"
  | "confidence"
  | "meanDistance"
  | "template"
  | "matchedVariant"
  | "contextScore"
  | "scoreBreakdown"
>;
