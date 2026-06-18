import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { buildMandalaLiveHintV2 } from "@/lib/recognizerV2/canvasFeedbackV2";
import {
  scoreTemplateAgainstContext,
  type RecognitionContext,
} from "@/lib/recognizerV2/recognitionContext";
import {
  FUSION_ML_WEIGHT,
  FUSION_TEMPLATE_WEIGHT,
  fuseRecognitionScores,
} from "@/lib/recognizerV2/scoreFusion";
import { stitchShortStrokes } from "@/lib/recognizerV2/strokeStitch";
import type { RecognitionStroke } from "@/types/recognition";

const shortStroke = (
  id: string,
  points: readonly { x: number; y: number }[],
): RecognitionStroke => ({
  id,
  points: points.map((point, index) => ({ ...point, t: index * 8 })),
});

describe("recognition ambiguity helpers", () => {
  it("fuses template and ML scores with the planned weights", () => {
    expect(fuseRecognitionScores(1, 0.5)).toBeCloseTo(
      1 * FUSION_TEMPLATE_WEIGHT + 0.5 * FUSION_ML_WEIGHT,
      5,
    );
    expect(fuseRecognitionScores(0.8, 0.2, false)).toBe(0.8);
  });

  it("boosts enemy weakness and allowed loadout templates in context scoring", () => {
    const context: RecognitionContext = {
      allowedTemplateIds: new Set(["ELEMENT_LUX", "FORM_PROJECTILE"]),
      enemyWeakness: "LUX",
    };

    expect(scoreTemplateAgainstContext("ELEMENT_LUX", context)).toBeGreaterThan(0.2);
    expect(scoreTemplateAgainstContext("ELEMENT_AQUA", context)).toBeLessThan(0);
  });

  it("stitches nearby short strokes instead of discarding action marks", () => {
    const strokes = stitchShortStrokes([
      shortStroke("ELEMENT_AQUA:segment:0", [{ x: 100, y: 100 }, { x: 104, y: 103 }]),
      shortStroke("ELEMENT_AQUA:segment:1", [{ x: 105, y: 104 }, { x: 110, y: 108 }]),
    ]);

    expect(strokes).toHaveLength(1);
    expect(strokes[0]?.points.length).toBeGreaterThanOrEqual(4);
  });

  it("applies context scoring only in the ranker, not in fused recognitionScore", () => {
    const compilerSource = readFileSync(
      resolve(process.cwd(), "src/lib/recognizerV2/mandalaParserV2.ts"),
      "utf8",
    );
    expect(compilerSource).not.toContain("scoreParsedAgainstContext");
    expect(compilerSource).toContain("getCandidateTopologySignature");
  });

  it("surfaces live mandala hints for incomplete drawings", () => {
    const hint = buildMandalaLiveHintV2([]);
    expect(hint.missingCastingCircle).toBe(true);
    expect(hint.message).toContain("circulo externo");
  });

  it("routes player compilation through fused ranking in spellCompiler", () => {
    const compilerSource = readFileSync(
      resolve(process.cwd(), "src/lib/spell/spellCompiler.ts"),
      "utf8",
    );
    expect(compilerSource).toContain("parseMandalaV2CandidatesFused");
    expect(compilerSource).toContain("chooseParsedCandidate");
    expect(compilerSource).toContain("recognitionContext");
  });
});