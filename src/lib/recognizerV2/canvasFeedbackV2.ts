import { fitCircleToPoints, fitCircleToStroke, isCircleLike } from "@/lib/geometry/circleFit";
import { parseMandalaV2FromStrokes } from "@/lib/recognizerV2/mandalaParserV2";
import { compileMagicFormulaV2 } from "@/lib/spellV2/formulaCompilerV2";
import type { DrawingStroke, Point, PrecisionBreakdown } from "@/types/magic";
import type { RecognitionStroke } from "@/types/recognition";

interface CastingCircleGesture {
  readonly closureDistance: number;
  readonly precision: number;
  readonly isPlausibleCastingCircle: boolean;
}

interface MandalaCanvasAnalysisV2 {
  readonly precision: PrecisionBreakdown;
  readonly hasCastingCircle: boolean;
}

export type MandalaLiveHintSeverityV2 = "info" | "warn" | "ok";

export interface MandalaLiveHintV2 {
  readonly message: string;
  readonly severity: MandalaLiveHintSeverityV2;
  readonly missingCastingCircle: boolean;
  readonly missingSigil: boolean;
  readonly missingKey: boolean;
}

const clampScore = (value: number): number =>
  Math.max(0, Math.min(100, Math.round(value)));

const averageScore = (values: readonly number[], fallback = 0): number =>
  values.length > 0
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : fallback;

export const getStrokeClosureDistance = (points: readonly Point[]): number => {
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) return Infinity;
  return Math.hypot(first.x - last.x, first.y - last.y);
};

export const closeStrokeIfNearV2 = (
  points: readonly Point[],
  threshold: number,
): readonly Point[] => {
  if (points.length < 3 || getStrokeClosureDistance(points) > threshold) return points;
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last || (first.x === last.x && first.y === last.y)) return points;
  return [...points, { ...first, t: last.t }];
};

const toRecognitionStroke = (stroke: DrawingStroke, index: number): RecognitionStroke => ({
  id: stroke.id || `stroke:${index}`,
  points: stroke.points.map((point) => ({
    x: point.x,
    y: point.y,
    t: point.t,
    pressure: point.pressure,
    tiltX: point.tiltX,
    tiltY: point.tiltY,
    pointerType: point.pointerType,
  })),
});

const toRecognitionStrokes = (
  strokes: readonly DrawingStroke[],
): readonly RecognitionStroke[] =>
  strokes.map(toRecognitionStroke);

export const analyzeCastingCircleGesture = (
  points: readonly Point[],
): CastingCircleGesture => {
  const fit = fitCircleToPoints(points);
  const closureDistance = getStrokeClosureDistance(points);
  const centeredness = fit
    ? Math.max(0, 1 - Math.hypot(fit.center.x - 260, fit.center.y - 260) / 190)
    : 0;
  const precision = fit
    ? clampScore((fit.quality * 0.74 + centeredness * 0.26) * 100)
    : 0;

  return {
    closureDistance,
    precision,
    isPlausibleCastingCircle: Boolean(
      fit &&
        isCircleLike(fit, { minClosure: 0.52, minRoundness: 0.4, minQuality: 0.48 }) &&
        centeredness >= 0.38,
    ),
  };
};

export const hasPlausibleCastingCircleStroke = (
  stroke: DrawingStroke,
): boolean => {
  const closedStroke = {
    id: stroke.id,
    points: closeStrokeIfNearV2(stroke.points, 42),
  };
  const fit = fitCircleToStroke(closedStroke);
  if (!fit) return false;
  const centeredness = Math.max(0, 1 - Math.hypot(fit.center.x - 260, fit.center.y - 260) / 190);

  return (
    isCircleLike(fit, { minClosure: 0.52, minRoundness: 0.4, minQuality: 0.48 }) &&
    centeredness >= 0.38
  );
};

export const buildMandalaLiveHintV2 = (
  strokes: readonly DrawingStroke[],
): MandalaLiveHintV2 => {
  const parsed = parseMandalaV2FromStrokes(toRecognitionStrokes(strokes));
  const formula = compileMagicFormulaV2(parsed);
  const missingCastingCircle = !parsed.castingCircle;
  const missingSigil = parsed.sigils.length === 0;
  const missingKey = parsed.keys.length === 0;

  if (missingCastingCircle) {
    return {
      message: "Feche o circulo externo para ancorar a formula.",
      severity: "warn",
      missingCastingCircle,
      missingSigil,
      missingKey,
    };
  }

  if (missingSigil) {
    return {
      message: "Desenhe o sigilo central (elemento).",
      severity: "warn",
      missingCastingCircle,
      missingSigil,
      missingKey,
    };
  }

  if (missingKey) {
    return {
      message: "Adicione uma chave (forma ou acao).",
      severity: "info",
      missingCastingCircle,
      missingSigil,
      missingKey,
    };
  }

  const weakComponent = [...parsed.sigils, ...parsed.keys].some(
    (component) => component.confidence < 0.62,
  );
  if (weakComponent) {
    return {
      message: "Simbolo reconhecido com baixa nitidez — reforce o traco.",
      severity: "warn",
      missingCastingCircle,
      missingSigil,
      missingKey,
    };
  }

  if (formula.validity === "valid_visual_formula") {
    return {
      message: "Formula completa. Feche o circulo externo para conjurar.",
      severity: "ok",
      missingCastingCircle,
      missingSigil,
      missingKey,
    };
  }

  return {
    message: "Continue refinando a mandala.",
    severity: "info",
    missingCastingCircle,
    missingSigil,
    missingKey,
  };
};

export const analyzeMandalaCanvasStrokesV2 = (
  strokes: readonly DrawingStroke[],
): MandalaCanvasAnalysisV2 => {
  if (strokes.length === 0) {
    return {
      hasCastingCircle: false,
      precision: {
        castingCircleQuality: 0,
        castingCircleClosure: 0,
        sigilPrecision: 0,
        keyPrecision: 0,
        symmetry: 0,
        proportions: 0,
        overall: 0,
      },
    };
  }

  const parsed = parseMandalaV2FromStrokes(toRecognitionStrokes(strokes));
  const formula = compileMagicFormulaV2(parsed);
  const castingCircleQuality = clampScore((parsed.castingCircle?.quality ?? 0) * 100);
  const castingCircleClosure = clampScore((parsed.castingCircle?.closure ?? 0) * 100);
  const sigilPrecision = clampScore(averageScore(parsed.sigils.map((sigil) => sigil.confidence * 100)));
  const keyPrecision = clampScore(averageScore(parsed.keys.map((key) => key.confidence * 100)));
  const symmetry = clampScore(formula.symmetry.overall * 100);
  const proportions = clampScore(averageScore([
    formula.symmetry.radialBalance,
    formula.symmetry.keyAngularSpacing,
    formula.symmetry.circleConcentricity,
  ].map((value) => value * 100)));
  const validityFactor = formula.validity === "invalid" ? 0.25 : formula.validity === "partial" ? 0.68 : 1;
  const overall = clampScore((
    castingCircleQuality * 0.18 +
    castingCircleClosure * 0.12 +
    sigilPrecision * 0.27 +
    keyPrecision * 0.23 +
    symmetry * 0.13 +
    proportions * 0.07
  ) * validityFactor);

  return {
    hasCastingCircle: Boolean(parsed.castingCircle),
    precision: {
      castingCircleQuality,
      castingCircleClosure,
      sigilPrecision,
      keyPrecision,
      symmetry,
      proportions,
      overall,
    },
  };
};
