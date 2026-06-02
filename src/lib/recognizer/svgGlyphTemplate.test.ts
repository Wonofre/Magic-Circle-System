import { describe, expect, it } from "vitest";

import { matchGlyphTemplates } from "@/lib/recognizer/templateMatcher";
import { glyphTemplateFromSvg, svgToGlyphStrokes } from "@/lib/recognizer/svgGlyphTemplate";

describe("svg glyph template importer", () => {
  it("normalizes basic SVG shapes into catalog strokes", () => {
    const svg = `
      <svg viewBox="0 0 100 100">
        <polygon points="50,12 82,50 50,88 18,50" />
        <line x1="31" y1="70" x2="69" y2="70" />
      </svg>
    `;

    const result = svgToGlyphStrokes(svg);

    expect(result.diagnostics).toEqual([]);
    expect(result.strokes).toHaveLength(2);
    expect(result.strokes[0][0]).toEqual([50, 12]);
    expect(result.strokes[0].at(-1)).toEqual([50, 12]);
  });

  it("creates a recognizable template payload from SVG authoring data", () => {
    const svg = `
      <svg viewBox="0 0 100 100">
        <path d="M 50 18 L 78 50 L 50 82 L 22 50 Z" />
        <path d="M 30 70 L 70 70" />
      </svg>
    `;

    const template = glyphTemplateFromSvg(svg, {
      id: "TEST_TERRA_SVG",
      displayName: "Terra SVG",
      family: "elemento_primario",
      semanticRole: "element",
      description: "Fixture SVG para autoria de glifos.",
      ports: ["bottom", "top"],
      topologySignature: {
        loops: 1,
        open_strokes: 1,
        dominant_geometry: "diamond_base",
        expected_intersections: 0,
        corners_min: 4,
        corners_max: 12,
      },
      tags: ["svg_authoring"],
    });
    const match = matchGlyphTemplates(
      template.strokes.map((stroke, index) => ({
        id: `svg-terra:${index}`,
        points: stroke.map(([x, y]) => ({ x, y })),
      })),
      {
        topK: 3,
        templateIdFilter: ["ELEMENT_TERRA"],
      },
    );

    expect(template.strokes).toHaveLength(2);
    expect(match.topCandidate?.template.id).toBe("ELEMENT_TERRA");
    expect(match.topCandidate?.confidence ?? 0).toBeGreaterThanOrEqual(0.78);
  });
});
