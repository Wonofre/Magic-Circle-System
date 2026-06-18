import type { GlyphSemanticRole, GlyphTemplate } from "@/types/glyphTemplates";

export interface RecognitionPoint {
  readonly x: number;
  readonly y: number;
  readonly t?: number;
  readonly pressure?: number;
  readonly tangentialPressure?: number;
  readonly tiltX?: number;
  readonly tiltY?: number;
  readonly twist?: number;
  readonly altitudeAngle?: number;
  readonly azimuthAngle?: number;
  readonly pointerType?: string;
}

export interface RecognitionStroke<TPoint extends RecognitionPoint = RecognitionPoint> {
  readonly id?: string;
  readonly points: readonly TPoint[];
  readonly timestamp?: number;
  readonly semanticGroupId?: string;
  readonly semanticTemplateId?: string;
}

export interface RecognitionBounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
  readonly width: number;
  readonly height: number;
}

export interface NormalizedRecognitionPoint extends RecognitionPoint {
  readonly sourceX: number;
  readonly sourceY: number;
}

export interface NormalizedRecognitionStroke
  extends RecognitionStroke<NormalizedRecognitionPoint> {
  readonly sourcePointCount: number;
}

export interface StrokeNormalizationOptions {
  readonly size?: number;
  readonly padding?: number;
  readonly preserveAspectRatio?: boolean;
}

export interface StrokeNormalizationResult {
  readonly strokes: readonly NormalizedRecognitionStroke[];
  readonly sourceBounds: RecognitionBounds | null;
  readonly normalizedBounds: RecognitionBounds | null;
  readonly sourcePointCount: number;
  readonly normalizedPointCount: number;
  readonly scaleX: number;
  readonly scaleY: number;
}

export type ScribbleDetectionOutcome = "candidate" | "unknown" | "scribble";

export interface ScribbleDetectionMetrics {
  readonly strokeCount: number;
  readonly pointCount: number;
  readonly dedupedPointCount: number;
  readonly duplicatePointRatio: number;
  readonly emptyStrokeRatio: number;
  readonly tinyStrokeRatio: number;
  readonly bounds: RecognitionBounds | null;
  readonly totalPathLength: number;
  readonly boundsDiagonal: number;
  readonly pathToDiagonalRatio: number;
  readonly pointDensity: number;
  readonly approximateIntersectionCount: number;
  readonly intersectionDensity: number;
}

export interface ScribbleDetectorThresholds {
  readonly minPointCount: number;
  readonly minDrawableSize: number;
  readonly minPathLength: number;
  readonly maxStrokeCount: number;
  readonly maxDuplicatePointRatio: number;
  readonly maxEmptyStrokeRatio: number;
  readonly maxTinyStrokeRatio: number;
  readonly maxPathToDiagonalRatio: number;
  readonly maxIntersectionCount: number;
  readonly maxIntersectionDensity: number;
  readonly minTinyStrokeLength: number;
}

export interface ScribbleDetectionResult {
  readonly outcome: ScribbleDetectionOutcome;
  readonly isRejected: boolean;
  readonly score: number;
  readonly reasons: readonly string[];
  readonly metrics: ScribbleDetectionMetrics;
  readonly thresholds: ScribbleDetectorThresholds;
}

export type TemplateMatchVariant =
  | "direct"
  | "reverse_points"
  | "reverse_strokes"
  | "reverse_points_and_strokes"
  | "rotate_-15"
  | "rotate_-10"
  | "rotate_10"
  | "rotate_15";

export type TemplateNormalizationMode = "bbox_0_100";

export interface TemplateMatchScoreBreakdown {
  readonly sequentialConfidence: number;
  readonly pointCloudConfidence: number;
  readonly chamferDistance: number;
  readonly meanDistance: number;
  readonly strokeCountPenalty: number;
  readonly variantConfidence: number;
}

export interface TemplateMatcherContext {
  readonly sourceBounds?: RecognitionBounds | null;
  readonly frameBounds?: RecognitionBounds | null;
  readonly zone?: "frame" | "core" | "inner" | "middle" | "outer" | "orbital";
}

export interface TemplateMatcherOptions {
  readonly topK?: number;
  readonly totalSamplePoints?: number;
  readonly maxMeanDistance?: number;
  readonly strokeCountPenalty?: number;
  readonly scribbleThresholds?: Partial<ScribbleDetectorThresholds>;
  readonly allowedVariants?: readonly TemplateMatchVariant[];
  readonly context?: TemplateMatcherContext;
  readonly roleFilter?: readonly GlyphSemanticRole[];
  readonly templateIdFilter?: readonly string[];
  readonly strictTopology?: boolean;
}

export interface TemplateMatchCandidate {
  readonly template: GlyphTemplate;
  readonly rank: number;
  readonly confidence: number;
  readonly shapeConfidence: number;
  readonly meanDistance: number;
  readonly strokeCountDelta: number;
  readonly sampledPointCount: number;
  readonly scoreBreakdown?: TemplateMatchScoreBreakdown;
  readonly matchedVariant?: TemplateMatchVariant;
  readonly contextScore?: number;
  readonly normalizationMode?: TemplateNormalizationMode;
}

export interface TemplateMatchResult {
  readonly stage: "ranking_only";
  readonly candidates: readonly TemplateMatchCandidate[];
  readonly topCandidate: TemplateMatchCandidate | null;
  readonly semanticMargin: number;
  readonly inputRejected: boolean;
  readonly rejectionReason: "scribble" | "unknown" | null;
  readonly scribble: ScribbleDetectionResult;
  readonly normalized: StrokeNormalizationResult;
}

export type TopologyCheckStatus = "pass" | "fail" | "warn";

export interface TopologyValidationOptions {
  readonly closureThreshold?: number;
  readonly minStrokeLength?: number;
  readonly noiseStrokeLength?: number;
  readonly intersectionTolerance?: number;
  readonly maxNoiseStrokeRatio?: number;
}

export interface TopologyStrokeMetric {
  readonly strokeIndex: number;
  readonly pointCount: number;
  readonly pathLength: number;
  readonly closureDistance: number;
  readonly closureScore: number;
  readonly isClosed: boolean;
  readonly isNoise: boolean;
}

export interface TopologyValidationMetrics {
  readonly strokeCount: number;
  readonly nonNoiseStrokeCount: number;
  readonly loopCount: number;
  readonly openStrokeCount: number;
  readonly noiseStrokeCount: number;
  readonly noiseStrokeRatio: number;
  readonly approximateIntersectionCount: number;
  readonly cornerCount: number;
  readonly turnCount: number;
  readonly exitMarkerCount: number;
  readonly averageClosureScore: number;
  readonly strokeMetrics: readonly TopologyStrokeMetric[];
}

export interface TopologyValidationCheck {
  readonly id: string;
  readonly status: TopologyCheckStatus;
  readonly message: string;
  readonly expected?: number | string | boolean;
  readonly actual?: number | string | boolean;
}

export interface TopologyValidationResult {
  readonly isValid: boolean;
  readonly template: GlyphTemplate;
  readonly checks: readonly TopologyValidationCheck[];
  readonly metrics: TopologyValidationMetrics;
}

export type RecognitionOutcome =
  | "cast_clean"
  | "cast_weak"
  | "partial"
  | "miscast"
  | "fizzle"
  | "backfire";

export type SemanticRiskLevel = "low" | "medium" | "high";

export interface SemanticDecisionReason {
  readonly code: string;
  readonly message: string;
  readonly severity: "info" | "warning" | "failure";
}

export interface SemanticMarginOptions {
  readonly severeConfidenceGap?: number;
  readonly weakTopologyOutcome?: RecognitionOutcome;
  readonly confidenceThreshold?: number;
  readonly semanticMarginThreshold?: number;
}

export interface SemanticMarginResult {
  readonly outcome: RecognitionOutcome;
  readonly candidate: TemplateMatchCandidate | null;
  readonly riskLevel: SemanticRiskLevel;
  readonly confidence: number;
  readonly minConfidence: number;
  readonly semanticMargin: number;
  readonly minSemanticMargin: number;
  readonly topologyValid: boolean | null;
  readonly reasons: readonly SemanticDecisionReason[];
}

export type RecognitionCandidateSource =
  | "onnx_webgpu"
  | "onnx_wasm"
  | "template_matcher"
  | "canonical_hint";

export type VisionModelStatus =
  | "idle"
  | "loading"
  | "ready"
  | "unavailable"
  | "error";

export interface VisionGlyphCandidate {
  readonly templateId: string;
  readonly rank: number;
  readonly confidence: number;
  readonly semanticMargin: number;
  readonly confidenceThreshold: number;
  readonly semanticMarginThreshold: number;
  readonly passesConfidenceThreshold: boolean;
  readonly passesSemanticMarginThreshold: boolean;
  readonly source: RecognitionCandidateSource;
  readonly acceptedByClassThreshold: boolean;
}

export interface VisionMandalaRegion {
  readonly id: string;
  readonly strokes: readonly RecognitionStroke[];
  readonly sourceIndexes: readonly number[];
  readonly bounds: RecognitionBounds | null;
  readonly zone?: "frame" | "core" | "inner" | "middle" | "outer" | "orbital";
  readonly candidates: readonly VisionGlyphCandidate[];
  readonly rejected: boolean;
  readonly rejectionReason?: "unknown" | "low_confidence" | "low_margin" | "scribble";
}

export interface ProbabilisticRecognitionResult {
  readonly regions: readonly VisionMandalaRegion[];
  readonly source: RecognitionCandidateSource;
  readonly modelStatus: VisionModelStatus;
  readonly modelVersion?: string;
  readonly provider?: "webgpu" | "wasm" | "template_matcher" | "canonical_hint";
  readonly latencyMs: number;
  readonly fallbackUsed: boolean;
  readonly error?: string;
}
