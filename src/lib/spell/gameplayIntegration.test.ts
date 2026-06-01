import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getGlyphById } from "@/data/glyphTemplates";
import { analyzeRingQuality } from "@/lib/magicSystem";
import { defaultGrimoireLoadout, validateSpellCardForLoadout } from "@/lib/spell/codexStore";
import { calculateSpellCardInkCost, simulateInkSpend } from "@/lib/spell/inkSimulator";
import { compileSpellFromLegacyComponents } from "@/lib/spell/legacyGlyphAdapter";
import { compileSpellFromStrokes } from "@/lib/spell/spellCompiler";
import { drawingStrokesToRecognitionStrokes, hasPointerDynamics } from "@/lib/spell/strokeAdapter";
import type { DrawingStroke, GlyphComponent, Point, SigilType } from "@/types/magic";
import type { RecognitionStroke } from "@/types/recognition";

const makeCircle = (
  cx: number,
  cy: number,
  rx: number,
  ry = rx,
  end = Math.PI * 2,
  steps = 96,
): Point[] =>
  Array.from({ length: steps + 1 }, (_, index) => {
    const angle = (index / steps) * end;
    return {
      x: cx + Math.cos(angle) * rx,
      y: cy + Math.sin(angle) * ry,
      t: index * 8,
    };
  });

const makeComponent = (
  type: GlyphComponent["type"],
  options: Partial<GlyphComponent> = {},
): GlyphComponent => ({
  id: `${type}-test`,
  type,
  points: makeCircle(260, 260, type === "ring" ? 170 : 35),
  center: { x: 260, y: 260 },
  bounds: type === "ring"
    ? { minX: 90, minY: 90, maxX: 430, maxY: 430 }
    : { minX: 225, minY: 225, maxX: 295, maxY: 295 },
  precision: 92,
  size: type === "ring" ? 340 : 70,
  ...options,
});

const compileCard = (sigil: SigilType = "fire") => {
  const result = compileSpellFromLegacyComponents([
    makeComponent("sigil", { sigilType: sigil }),
    makeComponent("ring"),
  ], 92);

  if (!result.ok) {
    throw new Error(result.failure.message);
  }

  return result.card;
};

const strokesFromTemplate = (
  templateId: string,
  offsetX: number,
  offsetY: number,
): RecognitionStroke[] => {
  const template = getGlyphById(templateId);
  if (!template) throw new Error(`Missing test template ${templateId}`);

  return template.strokes.map((stroke, strokeIndex) => ({
    id: `${templateId}:${strokeIndex}`,
    points: stroke.map(([x, y], pointIndex) => ({
      x: x + offsetX,
      y: y + offsetY,
      t: pointIndex * 8,
    })),
  }));
};

describe("stroke adapter", () => {
  it("preserves optional pointer dynamics without requiring them", () => {
    const strokes: DrawingStroke[] = [
      {
        id: "plain",
        timestamp: 100,
        points: [{ x: 1, y: 2 }, { x: 3, y: 4 }],
      },
      {
        id: "pen",
        timestamp: 200,
        points: [
          { x: 5, y: 6, t: 210, pressure: 0.45, tiltX: 12, tiltY: -8, twist: 22, pointerType: "pen" },
          { x: 7, y: 8, t: 230, pressure: 0.52, pointerType: "pen" },
        ],
      },
    ];

    const converted = drawingStrokesToRecognitionStrokes(strokes);

    expect(converted[0].points[0].pressure).toBeUndefined();
    expect(converted[1].points[0]).toMatchObject({
      pressure: 0.45,
      tiltX: 12,
      tiltY: -8,
      twist: 22,
      pointerType: "pen",
    });
    expect(hasPointerDynamics(converted)).toBe(true);
  });
});

describe("ring quality", () => {
  it("scores a closed centered circle higher than open, oval, or off-center rings", () => {
    const center = { x: 260, y: 260 };
    const closed = analyzeRingQuality(makeCircle(260, 260, 170), center);
    const open = analyzeRingQuality(makeCircle(260, 260, 170, 170, Math.PI * 1.45), center);
    const oval = analyzeRingQuality(makeCircle(260, 260, 210, 105), center);
    const offCenter = analyzeRingQuality(makeCircle(370, 370, 170), center);

    expect(closed.precision).toBeGreaterThan(82);
    expect(closed.isPlausibleRing).toBe(true);
    expect(open.precision).toBeLessThan(closed.precision);
    expect(oval.precision).toBeLessThan(closed.precision);
    expect(offCenter.precision).toBeLessThan(closed.precision);
  });
});

describe("Codex and SpellCard integration", () => {
  it("compiles the new component recognizer and ignores one unrecognized stroke", () => {
    const result = compileSpellFromStrokes([
      ...strokesFromTemplate("ELEMENT_IGNIS", 90, 90),
      ...strokesFromTemplate("ACTION_EMIT", 250, 95),
      {
        id: "unknown-test-stroke",
        points: [
          { x: 410, y: 110 },
          { x: 450, y: 145 },
          { x: 420, y: 180 },
          { x: 465, y: 215 },
          { x: 435, y: 250 },
        ],
      },
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.card.componentTemplateIds).toEqual(expect.arrayContaining([
      "FRAME_CIRCLE_CONTAINMENT",
      "SOURCE_DOT",
      "ELEMENT_IGNIS",
      "ACTION_EMIT",
      "FORM_PROJECTILE",
      "TARGET_ENEMY",
    ]));
    expect(result.semanticResults.some((semantic) => semantic.candidate?.template.id === "unknown-test-stroke")).toBe(false);
  });

  it("generates a SpellCard through catalog glyph ids", () => {
    const card = compileCard("fire");

    expect(card.id).toMatch(/^spell_/);
    expect(card.componentTemplateIds).toEqual(expect.arrayContaining([
      "FRAME_CIRCLE_CONTAINMENT",
      "SOURCE_DOT",
      "ELEMENT_IGNIS",
      "ACTION_EMIT",
    ]));
  });

  it("allows active glyphs and blocks glyphs missing from a custom loadout", () => {
    const knownCard = compileCard("fire");
    const unknownCard = compileCard("ice");
    const loadoutWithoutIce = {
      ...defaultGrimoireLoadout,
      knownGlyphIds: defaultGrimoireLoadout.knownGlyphIds.filter((id) => id !== "DERIVED_GELU"),
    };

    expect(validateSpellCardForLoadout(knownCard, defaultGrimoireLoadout).ok).toBe(true);
    expect(validateSpellCardForLoadout(unknownCard, defaultGrimoireLoadout).ok).toBe(true);
    expect(validateSpellCardForLoadout(unknownCard, loadoutWithoutIce).ok).toBe(false);
    expect(validateSpellCardForLoadout(unknownCard, loadoutWithoutIce).missingGlyphIds).toContain("DERIVED_GELU");
  });

  it("blocks recipes that are not equipped", () => {
    const card = compileCard("fire");
    const validation = validateSpellCardForLoadout(card, {
      ...defaultGrimoireLoadout,
      allowedRecipeIds: [],
    });

    expect(validation.ok).toBe(false);
    expect(validation.recipeAllowed).toBe(false);
  });

  it("blocks a SpellCard when the reservoir cannot pay the final ink cost", () => {
    const card = compileCard("fire");
    const breakdown = calculateSpellCardInkCost({ card });
    const ink = simulateInkSpend({
      ink: 0,
      maxInk: 12,
      inkRegenPerTurn: 3,
      inkPurity: 1,
      inkViscosity: 0.5,
      inkVolatility: 0.12,
      inkAffinity: null,
      activeInfusionIds: [],
    }, breakdown);

    expect(ink.ok).toBe(false);
    expect(ink.failureCode).toBe("insufficient_ink");
  });
});

describe("enemy turn migration", () => {
  it("does not call getEnemyAction from App", () => {
    const appSource = readFileSync(resolve(process.cwd(), "src/App.tsx"), "utf8");

    expect(appSource).not.toContain("getEnemyAction");
  });
});
