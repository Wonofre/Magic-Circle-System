import { describe, expect, it } from "vitest";
import { getGlyphById } from "@/data/glyphTemplates";
import { getCandidateTopologySignature } from "@/lib/recognizerV2/candidateSignature";
import { chooseParsedCandidate } from "@/lib/recognizerV2/candidateRanker";
import { parseMandalaV2FromStrokes } from "@/lib/recognizerV2/mandalaParserV2";
import type { RecognitionContext } from "@/lib/recognizerV2/recognitionContext";
import type { RecognitionStroke } from "@/types/recognition";

const formulaStrokes = (templateIds: readonly string[]): readonly RecognitionStroke[] => {
  let strokeId = 0;
  return templateIds.flatMap((templateId, index) => {
    const template = getGlyphById(templateId);
    if (!template) throw new Error(`Missing test template ${templateId}`);

    const placement = templateId.startsWith("FRAME_")
      ? { x: 260, y: 260, scale: 3 }
      : templateId.startsWith("ELEMENT_") || templateId.startsWith("DERIVED_")
        ? { x: 260, y: 260, scale: 0.78 }
        : { x: 360, y: 260, scale: 0.72 };

    return template.strokes.map((stroke) => ({
      id: `${templateId}:${strokeId++}`,
      points: stroke.map(([x, y], pointIndex) => ({
        x: placement.x + (x - 50) * placement.scale,
        y: placement.y + (y - 50) * placement.scale,
        t: pointIndex * 8,
      })),
    }));
  });
};

describe("candidate topology signature", () => {
  it("distinguishes parses that share templates but differ in channel topology", () => {
    const base = parseMandalaV2FromStrokes(formulaStrokes([
      "FRAME_CIRCLE_CONTAINMENT",
      "ELEMENT_AQUA",
      "FORM_PROJECTILE",
    ]));
    const withChannel = {
      ...base,
      channels: [
        ...base.channels,
        {
          id: "channel:test",
          kind: "key_to_sigil" as const,
          fromId: "key:0",
          toId: "sigil:0",
          geometry: "straight_radial" as const,
          quality: 0.8,
          crossesCastingCircle: false,
        },
      ],
    };

    expect(getCandidateTopologySignature(base)).not.toBe(
      getCandidateTopologySignature(withChannel),
    );
  });

  it("prefers enemy weakness element when fused recognition scores tie", () => {
    const aquaParsed = parseMandalaV2FromStrokes(formulaStrokes([
      "FRAME_CIRCLE_CONTAINMENT",
      "ELEMENT_AQUA",
      "FORM_PROJECTILE",
    ]));
    const luxParsed = parseMandalaV2FromStrokes(formulaStrokes([
      "FRAME_CIRCLE_CONTAINMENT",
      "ELEMENT_LUX",
      "FORM_PROJECTILE",
    ]));
    const context: RecognitionContext = {
      allowedTemplateIds: new Set([
        "FRAME_CIRCLE_CONTAINMENT",
        "ELEMENT_AQUA",
        "ELEMENT_LUX",
        "FORM_PROJECTILE",
      ]),
      enemyWeakness: "LUX",
    };

    const selected = chooseParsedCandidate(
      [
        { parsed: aquaParsed, semanticResults: [], recognitionScore: 5 },
        { parsed: luxParsed, semanticResults: [], recognitionScore: 5 },
      ],
      context,
    );

    expect(selected.formula.sigils[0]?.templateId).toBe("ELEMENT_LUX");
  });
});