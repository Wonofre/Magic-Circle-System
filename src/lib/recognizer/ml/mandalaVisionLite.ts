import { getCatalogKey, getCatalogSigil } from "@/data/magicCatalogV2";
import { rasterizeGlyphStrokes } from "@/lib/recognizer/ml/rasterizeGlyph";
import type { ParsedMandalaV2 } from "@/lib/recognizerV2/mandalaParserV2";
import type { MagicFormulaV2, VisualRankV2 } from "@/types/magicFormulaV2";
import type { RecognitionStroke } from "@/types/recognition";

export interface HolisticMandalaInterpretation {
  readonly cohesion: number;
  readonly precision: number;
  readonly visualRank: MagicFormulaV2["visual"]["rank"];
  readonly nameHint: string | null;
  readonly recognitionBoost: number;
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const inkDensityScore = (data: Float32Array): number => {
  let filled = 0;
  for (let index = 0; index < data.length; index += 1) {
    if (data[index] > 0.08) filled += 1;
  }
  const ratio = filled / Math.max(1, data.length);
  if (ratio < 0.02) return 0.2;
  if (ratio > 0.42) return 0.55;
  return clamp01(0.35 + ratio);
};

const structuralCohesion = (_parsed: ParsedMandalaV2, formula: MagicFormulaV2): number => {
  const symmetry = formula.symmetry.overall;
  const channels = formula.channels.length > 0
    ? formula.channels.filter((channel) => channel.geometry !== "invalid_straight").length /
      formula.channels.length
    : 1;
  const casting = formula.castingCircle?.quality ?? 0;
  const components = [...formula.sigils, ...formula.keys];
  const confidence = components.length > 0
    ? components.reduce((sum, component) => sum + component.confidence, 0) / components.length
    : 0;
  return clamp01(symmetry * 0.42 + channels * 0.2 + casting * 0.18 + confidence * 0.2);
};

const precisionEstimate = (parsed: ParsedMandalaV2, formula: MagicFormulaV2): number => {
  const drawingPrecision = parsed.strokes.length > 0
    ? clamp01(
        formula.symmetry.strokeCleanliness * 0.35 +
          (formula.castingCircle?.quality ?? 0) * 0.3 +
          formula.symmetry.circleConcentricity * 0.2 +
          formula.symmetry.radialBalance * 0.15,
      )
    : 0;
  const components = [...formula.sigils, ...formula.keys];
  const matcherPrecision = components.length > 0
    ? components.reduce((sum, component) => sum + component.confidence, 0) / components.length
    : 0;
  return clamp01(drawingPrecision * 0.55 + matcherPrecision * 0.45);
};

const rankFromScores = (cohesion: number, precision: number): VisualRankV2 => {
  const blended = cohesion * 0.45 + precision * 0.55;
  if (blended >= 0.85) return "perfect";
  if (blended >= 0.72) return "symmetric";
  if (blended >= 0.55) return "stable";
  if (blended >= 0.38) return "rough";
  return "fractured";
};

const buildNameHint = (formula: MagicFormulaV2): string | null => {
  const primarySigil = formula.sigils[0];
  const primaryKey = formula.keys[0];
  if (!primarySigil && !primaryKey) return null;
  const sigilName = primarySigil ? getCatalogSigil(primarySigil.sigilId)?.name : null;
  const keyName = primaryKey ? getCatalogKey(primaryKey.keyId)?.name : null;
  if (sigilName && keyName) return `${sigilName} ${keyName}`;
  return sigilName ?? keyName ?? null;
};

export const interpretHolisticMandala = (
  strokes: readonly RecognitionStroke[],
  parsed: ParsedMandalaV2,
  formula: MagicFormulaV2,
): HolisticMandalaInterpretation => {
  const raster = rasterizeGlyphStrokes(strokes, { size: 96, padding: 10, lineWidth: 4 });
  const density = inkDensityScore(raster.data);
  const structural = structuralCohesion(parsed, formula);
  const cohesion = clamp01(structural * 0.82 + density * 0.18);
  const precision = precisionEstimate(parsed, formula);
  const visualRank = rankFromScores(cohesion, precision);
  const recognitionBoost = clamp01(
    cohesion * 0.35 +
      precision * 0.35 +
      (formula.validity === "valid_visual_formula" ? 0.2 : formula.validity === "partial" ? 0.08 : 0),
  );

  return {
    cohesion,
    precision,
    visualRank,
    nameHint: buildNameHint(formula),
    recognitionBoost,
  };
};