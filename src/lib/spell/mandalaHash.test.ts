import { describe, expect, it } from "vitest";
import { createMandalaHash } from "@/lib/spell/mandalaHash";
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

    expect(createMandalaHash(input)).toBe(createMandalaHash(input));
  });

  it("changes when template identity or default flags change", () => {
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

    expect(createMandalaHash(base)).not.toBe(createMandalaHash(changedTemplate));
    expect(createMandalaHash(base)).not.toBe(createMandalaHash(changedDefaultFlag));
  });

  it("ignores source stroke ids", () => {
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

    expect(createMandalaHash(base)).toBe(createMandalaHash(changedStrokeIds));
  });
});
