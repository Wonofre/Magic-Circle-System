import { describe, expect, it } from "vitest";
import { getGlyphById } from "@/data/glyphTemplates";
import { glyphModelClassIds } from "@/lib/recognizer/ml/glyphClasses";
import { rasterizeGlyphStrokes } from "@/lib/recognizer/ml/rasterizeGlyph";
import { activeRuneDefinitions } from "@/data/magicOntology";

const fnv1a = (values: Uint8Array): number => {
  let hash = 0x811c9dc5;
  values.forEach((value) => {
    hash ^= value;
    hash = Math.imul(hash, 0x01000193);
  });
  return hash >>> 0;
};

describe("ML glyph rasterizer", () => {
  it("matches the Python reference raster for ELEMENT_AQUA", () => {
    const template = getGlyphById("ELEMENT_AQUA");
    expect(template).toBeDefined();
    const raster = rasterizeGlyphStrokes(
      template!.strokes.map((stroke) => ({
        points: stroke.map(([x, y]) => ({ x, y })),
      })),
    );
    const bytes = Uint8Array.from(raster.data, (value) => Math.round(value * 255));

    expect(raster.data.reduce((sum, value) => sum + value, 0)).toBe(1840);
    expect(fnv1a(bytes)).toBe(1558015677);
  });

  it("keeps model classes aligned with active non-circle runes", () => {
    const expected = activeRuneDefinitions
      .filter((rune) => rune.binding.type !== "casting_circle")
      .map((rune) => rune.templateId);

    expect(glyphModelClassIds).toEqual(expected);
    expect(glyphModelClassIds).toHaveLength(28);
  });
});
