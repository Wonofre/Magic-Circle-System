import { activeRuneDefinitions } from "@/data/magicOntology";
import { getGlyphById } from "@/data/glyphTemplates";
import { evaluateSemanticMargin } from "@/lib/recognizer/semanticMargin";
import { matchGlyphTemplates } from "@/lib/recognizer/templateMatcher";
import { validateGlyphTopology } from "@/lib/recognizer/topologyValidator";
import type { GlyphTemplate } from "@/types/glyphTemplates";
import type {
  RecognitionPoint,
  RecognitionStroke,
  RecognitionOutcome,
  TemplateMatcherContext,
} from "@/types/recognition";

export interface GlyphCalibrationVariant {
  readonly id: string;
  readonly label: string;
  readonly transform: (
    point: RecognitionPoint,
    pointIndex: number,
    template: GlyphTemplate,
  ) => RecognitionPoint;
  readonly mergeStrokes?: boolean;
  readonly reversePoints?: boolean;
}

export interface GlyphCalibrationResult {
  readonly templateId: string;
  readonly variantId: string;
  readonly expectedTemplateId: string;
  readonly recognizedTemplateId: string | null;
  readonly runnerUpTemplateId: string | null;
  readonly confidence: number;
  readonly semanticMargin: number;
  readonly outcome: RecognitionOutcome;
  readonly topologyValid: boolean | null;
  readonly passed: boolean;
}

export interface GlyphCalibrationSummary {
  readonly results: readonly GlyphCalibrationResult[];
  readonly failures: readonly GlyphCalibrationResult[];
  readonly minimumConfidence: number;
  readonly minimumSemanticMargin: number;
}

const activeTemplateIds = activeRuneDefinitions.map((rune) => rune.templateId);

const identityVariant: GlyphCalibrationVariant = {
  id: "exact",
  label: "template exato",
  transform: (point) => point,
};

const rotateAroundCenter = (degrees: number): GlyphCalibrationVariant => ({
  id: `rotate_${degrees}`,
  label: `rotacao ${degrees} graus`,
  transform: (point) => {
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
  },
});

const deterministicJitter = (amount: number): GlyphCalibrationVariant => ({
  id: `jitter_${amount}`,
  label: `jitter deterministico ${amount}`,
  transform: (point, pointIndex) => {
    const firstNoise = Math.sin((pointIndex + 1) * 12.9898) * 43758.5453;
    const secondNoise = Math.sin((pointIndex + 1) * 78.233) * 19341.123;

    return {
      ...point,
      x: point.x + ((firstNoise - Math.floor(firstNoise)) * 2 - 1) * amount,
      y: point.y + ((secondNoise - Math.floor(secondNoise)) * 2 - 1) * amount,
    };
  },
});

const stretchFromCenter = (xFactor: number, yFactor: number): GlyphCalibrationVariant => ({
  id: `stretch_${xFactor}_${yFactor}`,
  label: `escala ${xFactor}x/${yFactor}y`,
  transform: (point) => ({
    ...point,
    x: 50 + (point.x - 50) * xFactor,
    y: 50 + (point.y - 50) * yFactor,
  }),
});

const reversePointsVariant: GlyphCalibrationVariant = {
  id: "reverse_points",
  label: "traco invertido",
  transform: (point) => point,
  reversePoints: true,
};

export const glyphCalibrationVariants: readonly GlyphCalibrationVariant[] = [
  identityVariant,
  deterministicJitter(1.5),
  rotateAroundCenter(-10),
  rotateAroundCenter(10),
  stretchFromCenter(1.08, 0.94),
  reversePointsVariant,
];

const templateContext = (template: GlyphTemplate): TemplateMatcherContext => {
  if (template.semantic_role === "container") return { zone: "frame" };
  if (template.semantic_role === "source") return { zone: "core" };
  if (template.semantic_role === "target") return { zone: "outer" };
  return { zone: "inner" };
};

export const glyphTemplateToRecognitionStrokes = (
  template: GlyphTemplate,
  variant: GlyphCalibrationVariant = identityVariant,
): RecognitionStroke[] => {
  let pointIndex = 0;
  const strokes = template.strokes.map((stroke, strokeIndex) => {
    const points = stroke.map(([x, y]) => {
      const transformed = variant.transform({ x, y }, pointIndex, template);
      const point = {
        ...transformed,
        t: pointIndex * 8,
      };
      pointIndex += 1;
      return point;
    });
    const firstRaw = stroke[0];
    const lastRaw = stroke[stroke.length - 1];
    const isClosedStroke =
      firstRaw &&
      lastRaw &&
      Math.hypot(firstRaw[0] - lastRaw[0], firstRaw[1] - lastRaw[1]) < 0.001;
    const closedPoints = isClosedStroke && points.length > 1
      ? [...points.slice(0, -1), { ...points[0], t: points[points.length - 1].t }]
      : points;

    return {
      id: `${template.id}:${variant.id}:${strokeIndex}`,
      points: variant.reversePoints ? [...closedPoints].reverse() : closedPoints,
    };
  });

  if (!variant.mergeStrokes) return strokes;

  return [
    {
      id: `${template.id}:${variant.id}:merged`,
      points: strokes.flatMap((stroke) => stroke.points),
    },
  ];
};

export const auditGlyphTemplateRecognition = (
  templateIds: readonly string[] = activeTemplateIds,
  variants: readonly GlyphCalibrationVariant[] = glyphCalibrationVariants,
): GlyphCalibrationSummary => {
  const results: GlyphCalibrationResult[] = [];

  for (const templateId of templateIds) {
    const template = getGlyphById(templateId);
    if (!template) continue;

    for (const variant of variants) {
      const strokes = glyphTemplateToRecognitionStrokes(template, variant);
      const match = matchGlyphTemplates(strokes, {
        topK: 12,
        context: templateContext(template),
        templateIdFilter: templateIds,
      });
      const topology = match.topCandidate
        ? validateGlyphTopology(match.normalized.strokes, match.topCandidate.template, {
            intersectionTolerance: 2,
            maxNoiseStrokeRatio: 0.5,
          })
        : null;
      const semantic = evaluateSemanticMargin(match, topology ?? undefined, {
        severeConfidenceGap: 0.32,
        weakTopologyOutcome: "partial",
      });
      const recognizedTemplateId = match.topCandidate?.template.id ?? null;
      const runnerUpTemplateId = match.candidates[1]?.template.id ?? null;
      const passed =
        recognizedTemplateId === templateId &&
        semantic.confidence >= template.recognition.min_confidence &&
        semantic.semanticMargin >= template.recognition.min_semantic_margin &&
        (semantic.outcome === "cast_clean" || semantic.outcome === "cast_weak" || semantic.outcome === "partial");

      results.push({
        templateId,
        variantId: variant.id,
        expectedTemplateId: templateId,
        recognizedTemplateId,
        runnerUpTemplateId,
        confidence: semantic.confidence,
        semanticMargin: semantic.semanticMargin,
        outcome: semantic.outcome,
        topologyValid: topology?.isValid ?? null,
        passed,
      });
    }
  }

  const failures = results.filter((result) => !result.passed);
  const minimumConfidence = results.reduce(
    (minimum, result) => Math.min(minimum, result.confidence),
    results.length === 0 ? 0 : Infinity,
  );
  const minimumSemanticMargin = results.reduce(
    (minimum, result) => Math.min(minimum, result.semanticMargin),
    results.length === 0 ? 0 : Infinity,
  );

  return {
    results,
    failures,
    minimumConfidence,
    minimumSemanticMargin,
  };
};
