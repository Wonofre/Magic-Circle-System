import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { glyphModelOutputClassIds } from "@/lib/recognizer/ml/glyphClasses";
import { validateGlyphModelMetadata } from "@/lib/recognizer/ml/modelRuntime";

const rawMetadata = JSON.parse(
  readFileSync(
    new URL("../../../../public/models/glyph-recognizer-v1/metadata.json", import.meta.url),
    "utf-8",
  ),
) as {
  readonly classes: readonly string[];
  readonly classBindings: Readonly<Record<string, Readonly<Record<string, string>>>>;
  readonly [key: string]: unknown;
};

describe("glyph model metadata", () => {
  it("matches the active catalog, class order, bindings, and thresholds", () => {
    const metadata = validateGlyphModelMetadata(rawMetadata);

    expect(metadata.classes).toEqual(glyphModelOutputClassIds);
    expect(Object.keys(metadata.classThresholds)).toEqual(glyphModelOutputClassIds);
  });

  it("rejects stale class ordering before inference", () => {
    const classes = [...rawMetadata.classes];
    [classes[0], classes[1]] = [classes[1], classes[0]];

    expect(() =>
      validateGlyphModelMetadata({
        ...rawMetadata,
        classes,
      }),
    ).toThrow("Invalid glyph model metadata");
  });

  it("rejects stale visual-to-executable bindings", () => {
    expect(() =>
      validateGlyphModelMetadata({
        ...rawMetadata,
        classBindings: {
          ...rawMetadata.classBindings,
          ELEMENT_AQUA: {
            type: "sigil",
            sigilId: "IGNIS",
          },
        },
      }),
    ).toThrow('binding for "ELEMENT_AQUA" is stale');
  });
});
