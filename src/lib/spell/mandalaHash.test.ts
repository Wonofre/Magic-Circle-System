import { describe, expect, it } from "vitest";
import { createCastHash, createFormulaHash, createMandalaHash } from "@/lib/spell/mandalaHash";
import type { CircleQuality, MandalaSymbol } from "@/types/mandala";

const circleQuality: CircleQuality = {
  closure: 100,
  roundness: 100,
  centeredness: 100,
  smoothness: 100,
  overall: 100,
};

const makeSymbol = (
  templateId: string,
  isDefault = false,
  sourceStrokeIds: readonly string[] = [],
): MandalaSymbol => ({
  id: `symbol:${templateId}`,
  templateId,
  role: templateId.startsWith("FRAME") ? "container" : "element",
  isDrawn: !isDefault,
  isDefault,
  sourceStrokeIds,
  confidence: 0.92,
});

describe("mandala hash", () => {
  it("is stable for the same normalized mandala", () => {
    const input = {
      version: 1 as const,
      circleQuality,
      symbols: [
        makeSymbol("FRAME_CIRCLE_CONTAINMENT"),
        makeSymbol("ELEMENT_IGNIS"),
      ],
      formulaReading: "Circulo de Contencao -> Ignis",
    };

    expect(createFormulaHash(input)).toBe(createFormulaHash(input));
    expect(createCastHash(input)).toBe(createCastHash(input));
    expect(createMandalaHash(input)).toBe(createCastHash(input));
  });

  it("changes formula identity when template identity or default flags change", () => {
    const base = {
      version: 1 as const,
      circleQuality,
      symbols: [
        makeSymbol("FRAME_CIRCLE_CONTAINMENT"),
        makeSymbol("ELEMENT_IGNIS"),
      ],
      formulaReading: "Circulo de Contencao -> Ignis",
    };
    const changedTemplate = {
      ...base,
      symbols: [
        makeSymbol("FRAME_CIRCLE_CONTAINMENT"),
        makeSymbol("ELEMENT_AQUA"),
      ],
      formulaReading: "Circulo de Contencao -> Aqua",
    };
    const changedDefaultFlag = {
      ...base,
      symbols: [
        makeSymbol("FRAME_CIRCLE_CONTAINMENT"),
        makeSymbol("ELEMENT_IGNIS", true),
      ],
    };

    expect(createFormulaHash(base)).not.toBe(createFormulaHash(changedTemplate));
    expect(createFormulaHash(base)).not.toBe(createFormulaHash(changedDefaultFlag));
  });

  it("ignores source stroke ids for both formula and cast hashes", () => {
    const base = {
      version: 1 as const,
      circleQuality,
      symbols: [
        makeSymbol("FRAME_CIRCLE_CONTAINMENT", false, ["stroke-a"]),
        makeSymbol("ELEMENT_IGNIS", false, ["stroke-b"]),
      ],
      formulaReading: "Circulo de Contencao -> Ignis",
    };
    const changedStrokeIds = {
      ...base,
      symbols: [
        makeSymbol("FRAME_CIRCLE_CONTAINMENT", false, ["other-stroke"]),
        makeSymbol("ELEMENT_IGNIS", false, ["timestamp-like-123"]),
      ],
    };

    expect(createFormulaHash(base)).toBe(createFormulaHash(changedStrokeIds));
    expect(createCastHash(base)).toBe(createCastHash(changedStrokeIds));
  });

  it("keeps formula hash stable when only execution quality changes", () => {
    const base = {
      version: 1 as const,
      circleQuality,
      symbols: [
        makeSymbol("FRAME_CIRCLE_CONTAINMENT"),
        makeSymbol("ELEMENT_IGNIS"),
      ],
      formulaReading: "Circulo de Contencao -> Ignis",
    };
    const shakyCast = {
      ...base,
      circleQuality: {
        closure: 70,
        roundness: 64,
        centeredness: 82,
        smoothness: 68,
        overall: 70,
      },
      symbols: [
        { ...makeSymbol("FRAME_CIRCLE_CONTAINMENT"), confidence: 0.74 },
        { ...makeSymbol("ELEMENT_IGNIS"), confidence: 0.71 },
      ],
    };

    expect(createFormulaHash(base)).toBe(createFormulaHash(shakyCast));
    expect(createCastHash(base)).not.toBe(createCastHash(shakyCast));
  });
});
