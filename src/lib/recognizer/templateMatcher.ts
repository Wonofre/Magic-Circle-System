import { glyphTemplates } from "@/data/glyphTemplates";
import type { GlyphTemplate } from "@/types/glyphTemplates";
import type {
  RecognitionPoint,
  RecognitionStroke,
  TemplateMatchScoreBreakdown,
  TemplateMatchCandidate,
  TemplateMatcherContext,
  TemplateMatcherOptions,
  TemplateMatchResult,
  TemplateMatchVariant,
} from "@/types/recognition";
import { normalizeStrokes } from "@/lib/recognizer/normalizeStrokes";
import { resampleGlyph } from "@/lib/recognizer/resampleStrokes";
import { detectScribble } from "@/lib/recognizer/scribbleDetector";

const DEFAULT_TOP_K = 5;
const DEFAULT_TOTAL_SAMPLE_POINTS = 96;
const DEFAULT_MAX_MEAN_DISTANCE = 42;
const DEFAULT_STROKE_COUNT_PENALTY = 0.04;
const DEFAULT_TOPOLOGY_MISMATCH_PENALTY = 0.035;
const MAX_CHAMFER_SAMPLE_POINTS = 36;
const DEFAULT_ALLOWED_VARIANTS: readonly TemplateMatchVariant[] = [
  "direct",
  "reverse_points",
  "reverse_strokes",
  "reverse_points_and_strokes",
  "rotate_-15",
  "rotate_-10",
  "rotate_10",
  "rotate_15",
];
const ROTATION_BY_VARIANT: Partial<Record<TemplateMatchVariant, number>> = {
  "rotate_-15": -15,
  "rotate_-10": -10,
  rotate_10: 10,
  rotate_15: 15,
};

interface CachedTemplateSample {
  readonly strokes: readonly RecognitionStroke[];
  readonly points: readonly RecognitionPoint[];
}

interface VariantSample {
  readonly variant: TemplateMatchVariant;
  readonly strokes: readonly RecognitionStroke[];
  readonly points: readonly RecognitionPoint[];
}

interface TemplateIntrinsicMetrics {
  readonly maxDimension: number;
}

const templateSampleCache = new Map<string, CachedTemplateSample>();
const templateIntrinsicCache = new Map<string, TemplateIntrinsicMetrics>();

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const glyphTemplateToRecognitionStrokes = (
  template: GlyphTemplate,
): readonly RecognitionStroke[] =>
  template.strokes.map((stroke, strokeIndex) => ({
    id: `${template.id}:${strokeIndex}`,
    points: stroke.map(([x, y]) => ({ x, y })),
  }));

const flattenPoints = (strokes: readonly RecognitionStroke[]): RecognitionPoint[] =>
  strokes.flatMap((stroke) => stroke.points);

const getBoundsMaxDimension = (strokes: readonly RecognitionStroke[]): number => {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let found = false;

  for (const stroke of strokes) {
    for (const point of stroke.points) {
      found = true;
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
  }

  return found ? Math.max(maxX - minX, maxY - minY) : 0;
};

const getStrokePathLength = (points: readonly RecognitionPoint[]): number => {
  let length = 0;

  for (let index = 1; index < points.length; index += 1) {
    length += Math.hypot(
      points[index].x - points[index - 1].x,
      points[index].y - points[index - 1].y,
    );
  }

  return length;
};

const getClosureScore = (points: readonly RecognitionPoint[], pathLength: number): number => {
  if (points.length < 2 || pathLength <= 0) return 0;
  const first = points[0];
  const last = points[points.length - 1];
  return clamp01(1 - Math.hypot(first.x - last.x, first.y - last.y) / pathLength);
};

const getTemplateTopologyScore = (
  template: GlyphTemplate,
  strokes: readonly RecognitionStroke[],
): number => {
  const closureThreshold = template.topology_signature.closure_required ?? 0.9;
  let loopCount = 0;
  let openStrokeCount = 0;

  for (const stroke of strokes) {
    const pathLength = getStrokePathLength(stroke.points);
    if (pathLength < 2) continue;

    if (getClosureScore(stroke.points, pathLength) >= closureThreshold) {
      loopCount += 1;
    } else {
      openStrokeCount += 1;
    }
  }

  const expected = template.topology_signature;
  const loopDelta = Math.abs(loopCount - expected.loops);
  const openStrokeDelta = Math.abs(openStrokeCount - expected.open_strokes);
  const mismatchPenalty =
    loopDelta * DEFAULT_TOPOLOGY_MISMATCH_PENALTY +
    openStrokeDelta * (DEFAULT_TOPOLOGY_MISMATCH_PENALTY * 0.75);

  return -Math.min(0.18, mismatchPenalty);
};

const getTemplateIntrinsicMetrics = (template: GlyphTemplate): TemplateIntrinsicMetrics => {
  const cached = templateIntrinsicCache.get(template.id);
  if (cached) return cached;

  const metrics = {
    maxDimension: getBoundsMaxDimension(glyphTemplateToRecognitionStrokes(template)),
  };
  templateIntrinsicCache.set(template.id, metrics);
  return metrics;
};

const getSampledTemplate = (
  template: GlyphTemplate,
  totalSamplePoints: number,
): CachedTemplateSample => {
  const cacheKey = `${template.id}:${totalSamplePoints}`;
  const cached = templateSampleCache.get(cacheKey);
  if (cached) return cached;

  const normalizedTemplate = normalizeStrokes(glyphTemplateToRecognitionStrokes(template));
  const strokes = resampleGlyph(normalizedTemplate.strokes, totalSamplePoints);
  const sample = {
    strokes,
    points: flattenPoints(strokes),
  };
  templateSampleCache.set(cacheKey, sample);
  return sample;
};

const meanPointDistance = (
  firstPoints: readonly RecognitionPoint[],
  secondPoints: readonly RecognitionPoint[],
): number => {
  const pointCount = Math.min(firstPoints.length, secondPoints.length);

  if (pointCount === 0) {
    return Infinity;
  }

  let totalDistance = 0;

  for (let index = 0; index < pointCount; index += 1) {
    const first = firstPoints[index];
    const second = secondPoints[index];
    totalDistance += Math.hypot(first.x - second.x, first.y - second.y);
  }

  return totalDistance / pointCount;
};

const nearestPointMeanDistance = (
  sourcePoints: readonly RecognitionPoint[],
  targetPoints: readonly RecognitionPoint[],
): number => {
  if (sourcePoints.length === 0 || targetPoints.length === 0) {
    return Infinity;
  }

  let totalDistance = 0;

  const sourceStep = Math.max(1, Math.ceil(sourcePoints.length / MAX_CHAMFER_SAMPLE_POINTS));
  let sampledSourceCount = 0;

  for (let sourceIndex = 0; sourceIndex < sourcePoints.length; sourceIndex += sourceStep) {
    const source = sourcePoints[sourceIndex];
    let nearestDistance = Infinity;

    for (const target of targetPoints) {
      nearestDistance = Math.min(
        nearestDistance,
        Math.hypot(source.x - target.x, source.y - target.y),
      );
    }

    totalDistance += nearestDistance;
    sampledSourceCount += 1;
  }

  return totalDistance / Math.max(1, sampledSourceCount);
};

const chamferDistance = (
  firstPoints: readonly RecognitionPoint[],
  secondPoints: readonly RecognitionPoint[],
): number => {
  const forward = nearestPointMeanDistance(firstPoints, secondPoints);
  const backward = nearestPointMeanDistance(secondPoints, firstPoints);

  return (forward + backward) / 2;
};

const reverseStrokePoints = (
  strokes: readonly RecognitionStroke[],
): readonly RecognitionStroke[] =>
  strokes.map((stroke) => ({
    ...stroke,
    points: [...stroke.points].reverse(),
  }));

const reverseStrokeOrder = (
  strokes: readonly RecognitionStroke[],
): readonly RecognitionStroke[] => [...strokes].reverse();

const rotatePoint = (point: RecognitionPoint, degrees: number): RecognitionPoint => {
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const x = point.x - 50;
  const y = point.y - 50;

  return {
    ...point,
    x: 50 + x * cos - y * sin,
    y: 50 + x * sin + y * cos,
  };
};

const rotateStrokes = (
  strokes: readonly RecognitionStroke[],
  degrees: number,
): readonly RecognitionStroke[] => {
  const rotated = strokes.map((stroke) => ({
    ...stroke,
    points: stroke.points.map((point) => rotatePoint(point, degrees)),
  }));

  return normalizeStrokes(rotated).strokes;
};

const applyVariant = (
  strokes: readonly RecognitionStroke[],
  variant: TemplateMatchVariant,
): readonly RecognitionStroke[] => {
  if (variant === "direct") return strokes;
  if (variant === "reverse_points") return reverseStrokePoints(strokes);
  if (variant === "reverse_strokes") return reverseStrokeOrder(strokes);
  if (variant === "reverse_points_and_strokes") {
    return reverseStrokeOrder(reverseStrokePoints(strokes));
  }

  const rotation = ROTATION_BY_VARIANT[variant];
  return rotation === undefined ? strokes : rotateStrokes(strokes, rotation);
};

const getVariantSamples = (
  normalizedInputStrokes: readonly RecognitionStroke[],
  activeOptions: Required<TemplateMatcherOptions>,
): readonly VariantSample[] => activeOptions.allowedVariants.map((variant) => {
  const variantStrokes = applyVariant(normalizedInputStrokes, variant);
  const sampled = resampleGlyph(variantStrokes, activeOptions.totalSamplePoints);

  return {
    variant,
    strokes: sampled,
    points: flattenPoints(sampled),
  };
});

const getContextScore = (
  template: GlyphTemplate,
  context: TemplateMatcherContext,
): number => {
  const bounds = context.sourceBounds ?? null;
  const frameBounds = context.frameBounds ?? null;
  const maxDimension = bounds ? Math.max(bounds.width, bounds.height) : 0;
  const intrinsic = getTemplateIntrinsicMetrics(template);
  let score = 0;

  if (context.zone) {
    if (context.zone === "frame" && template.semantic_role !== "container") {
      score -= 0.18;
    }

    if (template.semantic_role === "container") {
      score += context.zone === "frame" ? 0.2 : -0.18;
    }

    if (template.semantic_role === "container" && context.zone !== "frame") {
      score -= 0.08;
    }

    if (template.semantic_role === "source") {
      if (context.zone === "core" || context.zone === "inner") score += 0.12;
      if (context.zone === "frame" || context.zone === "orbital") score -= 0.22;
    }
  }

  if (frameBounds && bounds) {
    const frameDimension = Math.max(1, Math.max(frameBounds.width, frameBounds.height));
    const frameRatio = maxDimension / frameDimension;

    if (template.semantic_role === "container") {
      if (frameRatio >= 0.72) score += 0.2;
      if (frameRatio < 0.38) score -= 0.28;
    }

    if (template.semantic_role === "source") {
      if (frameRatio <= 0.22) score += 0.16;
      if (frameRatio >= 0.45) score -= 0.3;
    }
  } else if (bounds) {
    if (template.semantic_role === "container") {
      if (maxDimension > 48) score += 0.08;
      if (maxDimension >= 120) score += 0.16;
      if (maxDimension <= 48) score -= 0.2;
    }

    if (template.semantic_role === "source") {
      if (maxDimension <= 48) score += 0.16;
      if (maxDimension > 48) score -= 0.22;
      if (maxDimension >= 120) score -= 0.28;
    }

    if (maxDimension <= 110 && intrinsic.maxDimension > 0) {
      const ratio = Math.min(maxDimension, intrinsic.maxDimension) /
        Math.max(maxDimension, intrinsic.maxDimension);
      score += Math.max(-0.08, (ratio - 0.75) * 0.18);
    }
  }

  return Math.max(-0.35, Math.min(0.3, score));
};

const scoreTemplate = (
  template: GlyphTemplate,
  inputVariants: readonly VariantSample[],
  options: Required<TemplateMatcherOptions>,
): Omit<TemplateMatchCandidate, "rank"> => {
  const sampledTemplate = getSampledTemplate(template, options.totalSamplePoints);
  let bestVariant = inputVariants[0];
  let bestBreakdown: TemplateMatchScoreBreakdown = {
    sequentialConfidence: 0,
    pointCloudConfidence: 0,
    chamferDistance: Infinity,
    meanDistance: Infinity,
    strokeCountPenalty: 0,
    variantConfidence: 0,
  };

  for (const variant of inputVariants) {
    const meanDistance = meanPointDistance(variant.points, sampledTemplate.points);
    const symmetricChamferDistance = chamferDistance(variant.points, sampledTemplate.points);
    const sequentialConfidence = clamp01(1 - meanDistance / options.maxMeanDistance);
    const pointCloudConfidence = clamp01(
      1 - symmetricChamferDistance / options.maxMeanDistance,
    );
    const variantConfidence = clamp01(
      sequentialConfidence * 0.64 + pointCloudConfidence * 0.36,
    );

    if (variantConfidence > bestBreakdown.variantConfidence) {
      bestVariant = variant;
      bestBreakdown = {
        sequentialConfidence,
        pointCloudConfidence,
        chamferDistance: symmetricChamferDistance,
        meanDistance,
        strokeCountPenalty: 0,
        variantConfidence,
      };
    }
  }

  const strokeCountDelta = Math.abs(bestVariant.strokes.length - template.strokes.length);
  const strokeCountPenalty = strokeCountDelta * options.strokeCountPenalty;
  const contextScore = getContextScore(template, options.context);
  const topologyScore = getTemplateTopologyScore(template, bestVariant.strokes);
  const shapeConfidence = bestBreakdown.variantConfidence;
  const confidence = clamp01(
    shapeConfidence - strokeCountPenalty + contextScore + topologyScore,
  );

  return {
    template,
    confidence,
    shapeConfidence,
    meanDistance: bestBreakdown.meanDistance,
    strokeCountDelta,
    sampledPointCount: Math.min(bestVariant.points.length, sampledTemplate.points.length),
    scoreBreakdown: {
      ...bestBreakdown,
      strokeCountPenalty,
    },
    matchedVariant: bestVariant.variant,
    contextScore: contextScore + topologyScore,
    normalizationMode: "bbox_0_100",
  };
};

const normalizeOptions = (options: TemplateMatcherOptions = {}): Required<TemplateMatcherOptions> => ({
  topK: options.topK ?? DEFAULT_TOP_K,
  totalSamplePoints: options.totalSamplePoints ?? DEFAULT_TOTAL_SAMPLE_POINTS,
  maxMeanDistance: options.maxMeanDistance ?? DEFAULT_MAX_MEAN_DISTANCE,
  strokeCountPenalty: options.strokeCountPenalty ?? DEFAULT_STROKE_COUNT_PENALTY,
  scribbleThresholds: options.scribbleThresholds ?? {},
  allowedVariants: options.allowedVariants ?? DEFAULT_ALLOWED_VARIANTS,
  context: options.context ?? {},
  roleFilter: options.roleFilter ?? [],
  templateIdFilter: options.templateIdFilter ?? [],
  strictTopology: options.strictTopology ?? false,
});

export const matchGlyphTemplates = (
  strokes: readonly RecognitionStroke[],
  options: TemplateMatcherOptions = {},
): TemplateMatchResult => {
  const activeOptions = normalizeOptions(options);
  const scribble = detectScribble(strokes, activeOptions.scribbleThresholds);
  const normalized = normalizeStrokes(strokes);

  if (scribble.isRejected || normalized.strokes.length === 0) {
    return {
      stage: "ranking_only",
      candidates: [],
      topCandidate: null,
      semanticMargin: 0,
      inputRejected: true,
      rejectionReason: scribble.outcome === "candidate" ? "unknown" : scribble.outcome,
      scribble,
      normalized,
    };
  }

  const inputVariants = getVariantSamples(normalized.strokes, {
    ...activeOptions,
    context: {
      sourceBounds: normalized.sourceBounds,
      ...activeOptions.context,
    },
  });
  const templatesToScore = glyphTemplates
    .filter((template) =>
      activeOptions.roleFilter.length === 0 ||
      activeOptions.roleFilter.includes(template.semantic_role),
    )
    .filter((template) =>
      activeOptions.templateIdFilter.length === 0 ||
      activeOptions.templateIdFilter.includes(template.id),
    );
  const candidates = templatesToScore
    .map((template) =>
      scoreTemplate(template, inputVariants, {
        ...activeOptions,
        context: {
          sourceBounds: normalized.sourceBounds,
          ...activeOptions.context,
        },
      }),
    )
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, activeOptions.topK)
    .map((candidate, index) => ({
      ...candidate,
      rank: index + 1,
    }));
  const topCandidate = candidates[0] ?? null;
  const runnerUp = candidates[1] ?? null;
  const semanticMargin =
    topCandidate && runnerUp ? topCandidate.confidence - runnerUp.confidence : 0;

  return {
    stage: "ranking_only",
    candidates,
    topCandidate,
    semanticMargin,
    inputRejected: false,
    rejectionReason: null,
    scribble,
    normalized,
  };
};
