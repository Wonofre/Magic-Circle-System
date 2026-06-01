import { glyphTemplates } from "@/data/glyphTemplates";
import type { GlyphTemplate } from "@/types/glyphTemplates";
import type {
  RecognitionPoint,
  RecognitionStroke,
  TemplateMatchCandidate,
  TemplateMatcherOptions,
  TemplateMatchResult,
} from "@/types/recognition";
import { normalizeStrokes } from "@/lib/recognizer/normalizeStrokes";
import { resampleGlyph } from "@/lib/recognizer/resampleStrokes";
import { detectScribble } from "@/lib/recognizer/scribbleDetector";

const DEFAULT_TOP_K = 5;
const DEFAULT_TOTAL_SAMPLE_POINTS = 96;
const DEFAULT_MAX_MEAN_DISTANCE = 42;
const DEFAULT_STROKE_COUNT_PENALTY = 0.04;

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

const scoreTemplate = (
  template: GlyphTemplate,
  sampledInputStrokes: readonly RecognitionStroke[],
  options: Required<TemplateMatcherOptions>,
): Omit<TemplateMatchCandidate, "rank"> => {
  const templateStrokes = glyphTemplateToRecognitionStrokes(template);
  const sampledTemplateStrokes = resampleGlyph(templateStrokes, options.totalSamplePoints);
  const inputPoints = flattenPoints(sampledInputStrokes);
  const templatePoints = flattenPoints(sampledTemplateStrokes);
  const meanDistance = meanPointDistance(inputPoints, templatePoints);
  const shapeConfidence = clamp01(1 - meanDistance / options.maxMeanDistance);
  const strokeCountDelta = Math.abs(sampledInputStrokes.length - template.strokes.length);
  const confidence = clamp01(
    shapeConfidence - strokeCountDelta * options.strokeCountPenalty,
  );

  return {
    template,
    confidence,
    shapeConfidence,
    meanDistance,
    strokeCountDelta,
    sampledPointCount: Math.min(inputPoints.length, templatePoints.length),
  };
};

const normalizeOptions = (options: TemplateMatcherOptions = {}): Required<TemplateMatcherOptions> => ({
  topK: options.topK ?? DEFAULT_TOP_K,
  totalSamplePoints: options.totalSamplePoints ?? DEFAULT_TOTAL_SAMPLE_POINTS,
  maxMeanDistance: options.maxMeanDistance ?? DEFAULT_MAX_MEAN_DISTANCE,
  strokeCountPenalty: options.strokeCountPenalty ?? DEFAULT_STROKE_COUNT_PENALTY,
});

export const matchGlyphTemplates = (
  strokes: readonly RecognitionStroke[],
  options: TemplateMatcherOptions = {},
): TemplateMatchResult => {
  const activeOptions = normalizeOptions(options);
  const scribble = detectScribble(strokes);
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

  const sampledInputStrokes = resampleGlyph(
    normalized.strokes,
    activeOptions.totalSamplePoints,
  );
  const candidates = glyphTemplates
    .map((template) => scoreTemplate(template, sampledInputStrokes, activeOptions))
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
