import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { activeRuneDefinitions } from "@/data/magicOntology";
import { getGlyphById } from "@/data/glyphTemplates";
import { hardNegativeFixtureSet } from "@/lib/telemetry/recognitionTelemetry";
import {
  compileSpellFromStrokes,
  compileSpellFromStrokesSync,
} from "@/lib/spell/spellCompiler";
import { recognizeMandalaComponentsV2 } from "@/lib/recognizerV2/componentRecognizerV2";
import { evaluateSemanticMargin } from "@/lib/recognizer/semanticMargin";
import { matchGlyphTemplates } from "@/lib/recognizer/templateMatcher";
import { validateGlyphTopology } from "@/lib/recognizer/topologyValidator";
import type { GlyphTemplate } from "@/types/glyphTemplates";
import type { RecognitionPoint, RecognitionStroke } from "@/types/recognition";

const activeTemplateIds = [...new Set(activeRuneDefinitions.map((rune) => rune.templateId))];
const castableOutcomes = new Set(["cast_clean", "cast_weak", "partial"]);
const multiStrokeTemplateIds = [
  "ELEMENT_LUX",
  "FORM_RAIN",
  "ELEMENT_VITA",
  "DERIVED_GELU",
  "FORM_PROJECTILE",
  "FORM_BEAM",
];

const getTemplate = (templateId: string): GlyphTemplate => {
  const template = getGlyphById(templateId);
  if (!template) throw new Error(`Missing template ${templateId}`);
  return template;
};

const templateStrokes = (
  templateId: string,
  offsetX = 0,
  offsetY = 0,
  transform: (point: RecognitionPoint, pointIndex: number) => RecognitionPoint = (point) => point,
): RecognitionStroke[] => {
  const template = getTemplate(templateId);
  let globalPointIndex = 0;

  return template.strokes.map((stroke, strokeIndex) => ({
    id: `${templateId}:${strokeIndex}`,
    points: stroke.map(([x, y]) => {
      const transformed = transform({ x, y }, globalPointIndex);
      const point = {
        ...transformed,
        x: transformed.x + offsetX,
        y: transformed.y + offsetY,
        t: globalPointIndex * 8,
      };
      globalPointIndex += 1;
      return point;
    }),
  }));
};

const rotateAroundTemplateCenter = (degrees: number) => (point: RecognitionPoint) => {
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const x = point.x - 50;
  const y = point.y - 50;

  return {
    ...point,
    x: 50 + x * cos - y * sin,
    y: 50 + x * sin + y * cos,
  };
};

const jitter = (amount: number) => (
  point: RecognitionPoint,
  pointIndex: number,
): RecognitionPoint => {
  const firstNoise = Math.sin((pointIndex + 1) * 12.9898) * 43758.5453;
  const secondNoise = Math.sin((pointIndex + 1) * 78.233) * 19341.123;

  return {
    ...point,
    x: point.x + ((firstNoise - Math.floor(firstNoise)) * 2 - 1) * amount,
    y: point.y + ((secondNoise - Math.floor(secondNoise)) * 2 - 1) * amount,
  };
};

const reversePoints = (strokes: readonly RecognitionStroke[]): RecognitionStroke[] =>
  strokes.map((stroke) => ({
    ...stroke,
    points: [...stroke.points].reverse(),
  }));

const mergeStrokes = (strokes: readonly RecognitionStroke[]): RecognitionStroke[] => [
  {
    id: "merged-strokes",
    points: strokes.flatMap((stroke) => stroke.points),
  },
];

describe("template matcher regressions", () => {
  it("ranks every active glyph's exact template as the top candidate", () => {
    for (const templateId of activeTemplateIds) {
      const template = getTemplate(templateId);
      const context = template.semantic_role === "container"
        ? { zone: "frame" as const }
        : template.semantic_role === "source"
          ? { zone: "core" as const }
          : undefined;
      const match = matchGlyphTemplates(templateStrokes(templateId, 80, 80), {
        topK: 12,
        context,
      });

      expect(match.topCandidate?.template.id, templateId).toBe(templateId);
      expect(match.topCandidate?.confidence, templateId).toBeGreaterThanOrEqual(
        template.recognition.min_confidence,
      );

      const topology = validateGlyphTopology(
        match.normalized.strokes,
        match.topCandidate!.template,
      );
      const semantic = evaluateSemanticMargin(match, topology);
      expect(
        castableOutcomes.has(semantic.outcome),
        `${templateId}: ${semantic.outcome} ${semantic.reasons.map((reason) => reason.code).join(",")}`,
      ).toBe(true);
    }
  }, 15000);

  it("keeps the intended glyph on top for common human drawing variations", () => {
    const cases = [
      {
        templateId: "ELEMENT_IGNIS",
        strokes: templateStrokes("ELEMENT_IGNIS", 120, 120, jitter(2.5)),
      },
      {
        templateId: "DERIVED_FULMEN",
        strokes: templateStrokes("DERIVED_FULMEN", 120, 120, rotateAroundTemplateCenter(15)),
      },
      {
        templateId: "ACTION_EMIT",
        strokes: reversePoints(templateStrokes("ACTION_EMIT", 120, 120)),
      },
      {
        templateId: "ELEMENT_IGNIS",
        strokes: mergeStrokes(templateStrokes("ELEMENT_IGNIS", 120, 120)),
      },
    ];

    for (const { templateId, strokes } of cases) {
      const match = matchGlyphTemplates(strokes, { topK: 12 });
      expect(match.topCandidate?.template.id, templateId).toBe(templateId);
    }
  });

  it.each(multiStrokeTemplateIds)(
    "recognizes active multi-stroke glyph component %s as a complete symbol",
    (templateId) => {
      const parsed = recognizeMandalaComponentsV2([
        ...templateStrokes("FRAME_CIRCLE_CONTAINMENT", 80, 80),
        ...templateStrokes(templateId, 180, 100),
      ]);
      const recognizedIds = parsed.recognitions
        .map((recognition) => recognition.semantic.candidate?.template.id)
        .filter(Boolean);

      expect(recognizedIds, templateId).toContain(templateId);
    },
  );

  it("keeps hard negative fixtures rejected by the compiler", () => {
    for (const fixture of hardNegativeFixtureSet) {
      const result = compileSpellFromStrokesSync(fixture.strokes);
      expect(result.ok, fixture.id).toBe(false);
    }
  });

  it("compiles player strokes with fused template+ML ranking without direct stroke-only parse", async () => {
    const compilerSource = readFileSync(resolve(process.cwd(), "src/lib/spell/spellCompiler.ts"), "utf8");
    expect(compilerSource).toContain("parseMandalaV2CandidatesFused");
    expect(compilerSource).toContain("chooseParsedCandidate");
    expect(compilerSource).not.toContain("parseMandalaV2CandidatesHolistically");
    expect(compilerSource).not.toContain("parseMandalaV2CandidatesFromStrokes");

    const result = await compileSpellFromStrokes([
      ...templateStrokes("FRAME_CIRCLE_CONTAINMENT", 80, 80),
      ...templateStrokes("ELEMENT_AQUA", 180, 180),
      ...templateStrokes("FORM_PROJECTILE", 280, 180),
    ]);

    if (result.telemetry?.model) {
      expect(["ready", "unavailable"]).toContain(result.telemetry.model.status);
    }
  });

  it("casts when the outer circle closes instead of requiring a button", () => {
    const source = readFileSync(resolve(process.cwd(), "src/components/GameCanvas.tsx"), "utf8");

    expect(source).not.toContain("scheduleIdleFinalization");
    expect(source).not.toContain("finalizeIdleTimeoutRef");
    expect(source).toContain("isOuterCastingCircleGesture(closedStroke)");
    expect(source).toContain("finalizeGlyph(nextStrokes)");
    expect(source).toContain("Circulo externo fechado. Conjurando...");
    expect(source).not.toContain("onClick={() => finalizeGlyph()}");
  });

  it("renders the complete first-formula tracing guide", () => {
    const source = readFileSync(resolve(process.cwd(), "src/components/GameCanvas.tsx"), "utf8");

    expect(source).toContain("drawTutorialTraceGuide");
    expect(source).toContain("'ELEMENT_AQUA'");
    expect(source).toContain("'FORM_PROJECTILE'");
    expect(source).toContain("TUTORIAL_STEP_MARKERS");
    expect(source).toContain("Passo {tutorialStep}:");
  });
});
