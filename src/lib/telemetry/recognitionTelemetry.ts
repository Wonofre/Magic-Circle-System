import {
  emptyStrokeFixture,
  incompleteGlyphStrokeFixture,
  openCircleStrokeFixture,
  overtracedStrokeFixture,
  scribbleStrokeFixture,
} from "@/lib/recognizer/recognitionFixtures";
import type { RecognitionStroke, SemanticMarginResult } from "@/types/recognition";
import type {
  CandidateLike,
  GlyphConfusionMatrixRow,
  HardNegativeFixtureCase,
  RecognitionMetricSummary,
  RecognitionTelemetryCandidate,
  RecognitionTelemetryEvent,
  RecognitionTelemetryInput,
} from "@/types/telemetry";

export const hardNegativeFixtureSet: readonly HardNegativeFixtureCase[] = [
  {
    id: "hard-negative-empty",
    label: "empty drawing",
    strokes: emptyStrokeFixture,
    expectedDecision: "rejected",
    reason: "quase sem tinta ou gesto legivel",
  },
  {
    id: "hard-negative-scribble",
    label: "dense scribble",
    strokes: scribbleStrokeFixture,
    expectedDecision: "rejected",
    reason: "auto-intersecoes e densidade excessivas",
  },
  {
    id: "hard-negative-open-circle",
    label: "open circle",
    strokes: openCircleStrokeFixture,
    expectedDecision: "rejected",
    reason: "moldura visualmente proxima, mas aberta",
  },
  {
    id: "hard-negative-incomplete",
    label: "incomplete glyph",
    strokes: incompleteGlyphStrokeFixture,
    expectedDecision: "rejected",
    reason: "sinal sem estrutura minima",
  },
  {
    id: "hard-negative-overtraced",
    label: "overtraced line",
    strokes: overtracedStrokeFixture,
    expectedDecision: "rejected",
    reason: "sobretraco repetido demais",
  },
];

const roundMetric = (value: number): number => Number(value.toFixed(4));

const makeTelemetryId = (): string =>
  `rec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const serializeCandidate = (candidate: CandidateLike): RecognitionTelemetryCandidate => ({
  templateId: candidate.template.id,
  family: candidate.template.family,
  semanticRole: candidate.template.semantic_role,
  rank: candidate.rank,
  confidence: roundMetric(candidate.confidence),
  meanDistance: roundMetric(candidate.meanDistance),
  matchedVariant: candidate.matchedVariant,
  contextScore: candidate.contextScore === undefined
    ? undefined
    : roundMetric(candidate.contextScore),
  scoreBreakdown: candidate.scoreBreakdown
    ? {
        sequentialConfidence: roundMetric(candidate.scoreBreakdown.sequentialConfidence),
        pointCloudConfidence: roundMetric(candidate.scoreBreakdown.pointCloudConfidence),
        chamferDistance: roundMetric(candidate.scoreBreakdown.chamferDistance),
        meanDistance: roundMetric(candidate.scoreBreakdown.meanDistance),
        strokeCountPenalty: roundMetric(candidate.scoreBreakdown.strokeCountPenalty),
        variantConfidence: roundMetric(candidate.scoreBreakdown.variantConfidence),
      }
    : undefined,
});

const collectFailureCodes = (input: RecognitionTelemetryInput): readonly string[] => {
  const codes: string[] = [];

  if (input.match?.rejectionReason) codes.push(input.match.rejectionReason);
  if (input.failure?.code) codes.push(input.failure.code);
  if (input.failure?.diegeticFailure?.kind) codes.push(input.failure.diegeticFailure.kind);
  input.failure?.graphIssues?.forEach((issue) => codes.push(issue.code));
  input.topology?.checks
    .filter((check) => check.status === "fail")
    .forEach((check) => codes.push(check.id));
  input.semanticResults
    ?.flatMap((semantic) => semantic.reasons)
    .filter((reason) => reason.severity === "failure")
    .forEach((reason) => codes.push(reason.code));

  return [...new Set(codes)];
};

const acceptedTemplateId = (
  decision: RecognitionTelemetryInput["decision"],
  semanticResults: readonly SemanticMarginResult[] | undefined,
): string | null => {
  if (decision !== "accepted" && decision !== "legacy_bridge_fallback") return null;
  return semanticResults?.find((semantic) => semantic.candidate)?.candidate?.template.id ?? null;
};

export const createRecognitionTelemetryEvent = (
  input: RecognitionTelemetryInput,
): RecognitionTelemetryEvent => {
  const candidates = input.match?.candidates.map(serializeCandidate) ?? [];
  const firstSemantic = input.semanticResults?.[0];

  return {
    id: makeTelemetryId(),
    createdAt: new Date().toISOString(),
    context: input.context,
    rawStrokes: input.rawStrokes,
    normalizedStrokes: input.match?.normalized.strokes ?? [],
    candidates,
    semanticMargin: roundMetric(input.match?.semanticMargin ?? firstSemantic?.semanticMargin ?? 0),
    topologyValid: input.topology?.isValid ?? firstSemantic?.topologyValid ?? null,
    failureCodes: collectFailureCodes(input),
    decision: input.decision,
    acceptedTemplateId: acceptedTemplateId(input.decision, input.semanticResults),
    expectedGlyphId: input.context.expectedGlyphId,
    fallbackUsed: input.fallbackUsed,
  };
};

export const summarizeHardNegativeMetrics = (
  events: readonly RecognitionTelemetryEvent[],
): RecognitionMetricSummary => {
  const fixtureEvents = events.filter((event) => event.context.source === "fixture");
  const falsePositiveCount = fixtureEvents.filter((event) => event.decision === "accepted").length;
  const trueNegativeCount = fixtureEvents.length - falsePositiveCount;
  const precision = trueNegativeCount + falsePositiveCount === 0
    ? 1
    : trueNegativeCount / (trueNegativeCount + falsePositiveCount);

  return {
    sampleCount: fixtureEvents.length,
    falsePositiveCount,
    falseNegativeCount: 0,
    precision: roundMetric(precision),
    recall: 1,
    f1: roundMetric(precision === 0 ? 0 : (2 * precision) / (precision + 1)),
  };
};

export const buildGlyphConfusionMatrix = (
  events: readonly RecognitionTelemetryEvent[],
): readonly GlyphConfusionMatrixRow[] => {
  const counts = new Map<string, number>();

  events.forEach((event) => {
    if (!event.expectedGlyphId) return;
    const predicted = event.acceptedTemplateId ?? "REJECTED";
    const key = `${event.expectedGlyphId}\u0000${predicted}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });

  return [...counts.entries()].map(([key, count]) => {
    const [expectedGlyphId, predictedGlyphId] = key.split("\u0000");
    return {
      expectedGlyphId,
      predictedGlyphId,
      count,
    };
  });
};

export const cloneTelemetryStrokes = (
  strokes: readonly RecognitionStroke[],
): readonly RecognitionStroke[] =>
  strokes.map((stroke) => ({
    ...stroke,
    points: stroke.points.map((point) => ({ ...point })),
  }));
