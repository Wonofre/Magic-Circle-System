import { describe, expect, it } from "vitest";
import { interpretHolisticMandala } from "@/lib/recognizer/ml/mandalaVisionLite";
import { parseMandalaV2FromStrokes } from "@/lib/recognizerV2/mandalaParserV2";
import { compileMagicFormulaV2 } from "@/lib/spellV2/formulaCompilerV2";
import type { RecognitionStroke } from "@/types/recognition";

const stroke = (
  points: readonly { x: number; y: number }[],
  id: string,
): RecognitionStroke => ({
  id,
  points: points.map((point, index) => ({ ...point, t: index })),
});

describe("mandalaVisionLite", () => {
  it("returns bounded cohesion and precision for a minimal mandala parse", () => {
    const strokes: RecognitionStroke[] = [
      stroke(
        Array.from({ length: 48 }, (_, index) => {
          const angle = (index / 48) * Math.PI * 2;
          return { x: 260 + Math.cos(angle) * 150, y: 260 + Math.sin(angle) * 150 };
        }),
        "outer",
      ),
    ];
    const parsed = parseMandalaV2FromStrokes(strokes);
    const formula = compileMagicFormulaV2(parsed);
    const interpretation = interpretHolisticMandala(strokes, parsed, formula);

    expect(interpretation.cohesion).toBeGreaterThanOrEqual(0);
    expect(interpretation.cohesion).toBeLessThanOrEqual(1);
    expect(interpretation.precision).toBeGreaterThanOrEqual(0);
    expect(interpretation.precision).toBeLessThanOrEqual(1);
    expect(interpretation.recognitionBoost).toBeGreaterThanOrEqual(0);
  });
});