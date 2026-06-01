import { describe, expect, it } from "vitest";
import { getGlyphById } from "@/data/glyphTemplates";
import { compileSpellGraph } from "@/lib/recognizer/graphCompiler";
import type { GlyphTemplate } from "@/types/glyphTemplates";

const getTemplate = (id: string): GlyphTemplate => {
  const template = getGlyphById(id);
  if (!template) throw new Error(`Missing template ${id}`);
  return template;
};

const graphInputs = [
  "ELEMENT_IGNIS",
  "FRAME_CIRCLE_CONTAINMENT",
  "ACTION_EMIT",
  "SOURCE_DOT",
  "FORM_PROJECTILE",
  "TARGET_ENEMY",
].map((id) => ({
  template: getTemplate(id),
  confidence: 0.9,
  recognitionOutcome: "cast_clean" as const,
}));

describe("graph compiler order", () => {
  it("role-sorts inputs by default", () => {
    const result = compileSpellGraph(graphInputs);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.graph.nodes.map((node) => node.templateId)).toEqual([
      "FRAME_CIRCLE_CONTAINMENT",
      "SOURCE_DOT",
      "ELEMENT_IGNIS",
      "ACTION_EMIT",
      "FORM_PROJECTILE",
      "TARGET_ENEMY",
    ]);
  });

  it("preserves caller order when preserveMandalaOrder is true", () => {
    const result = compileSpellGraph(graphInputs, { preserveMandalaOrder: true });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.graph.nodes.map((node) => node.templateId)).toEqual([
      "ELEMENT_IGNIS",
      "FRAME_CIRCLE_CONTAINMENT",
      "ACTION_EMIT",
      "SOURCE_DOT",
      "FORM_PROJECTILE",
      "TARGET_ENEMY",
    ]);
  });
});
