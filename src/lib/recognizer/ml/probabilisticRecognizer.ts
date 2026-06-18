import { getGlyphById } from "@/data/glyphTemplates";
import { detectScribble } from "@/lib/recognizer/scribbleDetector";
import { matchGlyphTemplates } from "@/lib/recognizer/templateMatcher";
import { glyphModelClassIds } from "@/lib/recognizer/ml/glyphClasses";
import {
  getGlyphModelRuntimeState,
  runGlyphModel,
} from "@/lib/recognizer/ml/modelRuntime";
import {
  getRecognitionBounds,
  rasterizeGlyphStrokes,
} from "@/lib/recognizer/ml/rasterizeGlyph";
import type {
  ProbabilisticRecognitionResult,
  RecognitionBounds,
  RecognitionCandidateSource,
  RecognitionStroke,
  VisionGlyphCandidate,
  VisionMandalaRegion,
} from "@/types/recognition";

export interface ProbabilisticRegionInput {
  readonly id: string;
  readonly strokes: readonly RecognitionStroke[];
  readonly sourceIndexes: readonly number[];
  readonly templateIdHint?: string;
  readonly bounds?: RecognitionBounds | null;
  readonly zone?: VisionMandalaRegion["zone"];
}

export interface ProbabilisticRecognizerOptions {
  readonly topK?: number;
  readonly maxRegions?: number;
}

const DEFAULT_TOP_K = 5;
const DEFAULT_MAX_REGIONS = 64;

const templateMatcherCandidates = (
  region: ProbabilisticRegionInput,
  source: Extract<RecognitionCandidateSource, "template_matcher" | "canonical_hint">,
  topK: number,
): readonly VisionGlyphCandidate[] => {
  const match = matchGlyphTemplates(region.strokes, {
    topK,
    templateIdFilter: region.templateIdHint
      ? [region.templateIdHint]
      : glyphModelClassIds,
    context: {
      sourceBounds: region.bounds ?? getRecognitionBounds(region.strokes),
      zone: region.zone,
    },
  });

  return match.candidates.map((candidate, index) => {
    const nextConfidence = match.candidates[index + 1]?.confidence ?? 0;
    const semanticMargin = candidate.confidence - nextConfidence;
    const confidenceThreshold = candidate.template.recognition.min_confidence;
    const semanticMarginThreshold =
      candidate.template.recognition.min_semantic_margin;
    const passesConfidenceThreshold =
      candidate.confidence >= confidenceThreshold;
    const passesSemanticMarginThreshold =
      semanticMargin >= semanticMarginThreshold;
    return {
      templateId: candidate.template.id,
      rank: index + 1,
      confidence: candidate.confidence,
      semanticMargin,
      confidenceThreshold,
      semanticMarginThreshold,
      passesConfidenceThreshold,
      passesSemanticMarginThreshold,
      source,
      acceptedByClassThreshold:
        passesConfidenceThreshold &&
        passesSemanticMarginThreshold,
    };
  });
};

const makeRejectedRegion = (
  region: ProbabilisticRegionInput,
  candidates: readonly VisionGlyphCandidate[],
  rejectionReason: NonNullable<VisionMandalaRegion["rejectionReason"]>,
): VisionMandalaRegion => ({
  id: region.id,
  strokes: region.strokes,
  sourceIndexes: region.sourceIndexes,
  bounds: region.bounds ?? getRecognitionBounds(region.strokes),
  zone: region.zone,
  candidates,
  rejected: true,
  rejectionReason,
});

const classifyWithModel = async (
  region: ProbabilisticRegionInput,
  topK: number,
): Promise<{
  readonly region: VisionMandalaRegion;
  readonly provider: "webgpu" | "wasm";
  readonly modelVersion: string;
}> => {
  const scribble = detectScribble(region.strokes);
  if (scribble.isRejected) {
    return {
      region: makeRejectedRegion(region, [], "scribble"),
      provider: getGlyphModelRuntimeState().provider ?? "wasm",
      modelVersion: getGlyphModelRuntimeState().metadata?.modelVersion ?? "unknown",
    };
  }

  const raster = rasterizeGlyphStrokes(region.strokes);
  const inference = await runGlyphModel(raster.data, topK);
  const candidates = inference.candidates.filter((candidate) =>
    candidate.templateId === "UNKNOWN" || Boolean(getGlyphById(candidate.templateId)),
  );
  const first = candidates[0];
  const rejectionReason = first?.templateId === "UNKNOWN"
    ? "unknown"
    : !first?.acceptedByClassThreshold
      ? first?.passesConfidenceThreshold
        ? "low_margin"
        : "low_confidence"
      : undefined;

  return {
    region: rejectionReason
      ? makeRejectedRegion(region, candidates, rejectionReason)
      : {
          id: region.id,
          strokes: region.strokes,
          sourceIndexes: region.sourceIndexes,
          bounds: region.bounds ?? raster.bounds,
          zone: region.zone,
          candidates,
          rejected: false,
        },
    provider: inference.provider,
    modelVersion: inference.modelVersion,
  };
};

const classifyCanonicalRegion = (
  region: ProbabilisticRegionInput,
  topK: number,
): VisionMandalaRegion => {
  const candidates = templateMatcherCandidates(region, "canonical_hint", topK);
  const exact = candidates.find((candidate) => candidate.templateId === region.templateIdHint);
  const canonicalCandidates = exact
    ? [{
        ...exact,
        rank: 1,
        passesConfidenceThreshold: true,
        passesSemanticMarginThreshold: true,
        acceptedByClassThreshold: true,
      }, ...candidates.filter((candidate) => candidate !== exact)]
    : candidates;

  return {
    id: region.id,
    strokes: region.strokes,
    sourceIndexes: region.sourceIndexes,
    bounds: region.bounds ?? getRecognitionBounds(region.strokes),
    zone: region.zone,
    candidates: canonicalCandidates.slice(0, topK),
    rejected: !exact,
    rejectionReason: exact ? undefined : "unknown",
  };
};

const fallbackRegions = (
  regions: readonly ProbabilisticRegionInput[],
  topK: number,
): readonly VisionMandalaRegion[] =>
  regions.map((region) => {
    const candidates = templateMatcherCandidates(region, "template_matcher", topK);
    const accepted = candidates.some((candidate) => candidate.acceptedByClassThreshold);
    return accepted
      ? {
          id: region.id,
          strokes: region.strokes,
          sourceIndexes: region.sourceIndexes,
          bounds: region.bounds ?? getRecognitionBounds(region.strokes),
          zone: region.zone,
          candidates,
          rejected: false,
        }
      : makeRejectedRegion(region, candidates, candidates.length === 0 ? "unknown" : "low_confidence");
  });

export const recognizeGlyphRegionsProbabilistically = async (
  regionInputs: readonly ProbabilisticRegionInput[],
  options: ProbabilisticRecognizerOptions = {},
): Promise<ProbabilisticRecognitionResult> => {
  const startedAt = performance.now();
  const topK = options.topK ?? DEFAULT_TOP_K;
  const regions = regionInputs.slice(0, options.maxRegions ?? DEFAULT_MAX_REGIONS);
  const canonicalRegions = regions.filter((region) => Boolean(region.templateIdHint));
  const modelRegions = regions.filter((region) => !region.templateIdHint);

  if (modelRegions.length === 0) {
    return {
      regions: canonicalRegions.map((region) => classifyCanonicalRegion(region, topK)),
      source: "canonical_hint",
      modelStatus: getGlyphModelRuntimeState().status,
      modelVersion: getGlyphModelRuntimeState().metadata?.modelVersion,
      provider: "canonical_hint",
      latencyMs: performance.now() - startedAt,
      fallbackUsed: false,
    };
  }

  try {
    const classified = await Promise.all(
      modelRegions.map((region) => classifyWithModel(region, topK)),
    );
    const provider = classified[0]?.provider ?? "wasm";
    const modelVersion = classified[0]?.modelVersion;
    const byId = new Map(classified.map((entry) => [entry.region.id, entry.region]));
    canonicalRegions.forEach((region) => {
      byId.set(region.id, classifyCanonicalRegion(region, topK));
    });

    return {
      regions: regions.flatMap((region) => {
        const result = byId.get(region.id);
        return result ? [result] : [];
      }),
      source: provider === "webgpu" ? "onnx_webgpu" : "onnx_wasm",
      modelStatus: "ready",
      modelVersion,
      provider,
      latencyMs: performance.now() - startedAt,
      fallbackUsed: false,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      regions: fallbackRegions(regions, topK),
      source: "template_matcher",
      modelStatus: "unavailable",
      provider: "template_matcher",
      latencyMs: performance.now() - startedAt,
      fallbackUsed: true,
      error: message,
    };
  }
};
