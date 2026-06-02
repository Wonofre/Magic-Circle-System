import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getGlyphById } from "@/data/glyphTemplates";
import { getLegacySigilForTemplateId } from "@/data/magicOntology";
import { analyzeRingQuality } from "@/lib/magicSystem";
import { defaultGrimoireLoadout, recordSpellCardDiscovery, validateSpellCardForLoadout } from "@/lib/spell/codexStore";
import { chooseEnemySpellPlan } from "@/lib/spell/enemySpellAI";
import { calculateSpellCardInkCost, simulateInkSpend } from "@/lib/spell/inkSimulator";
import { compileSpellFromLegacyComponents } from "@/lib/spell/legacyGlyphAdapter";
import { compileSpellFromStrokes } from "@/lib/spell/spellCompiler";
import { drawingStrokesToRecognitionStrokes, hasPointerDynamics } from "@/lib/spell/strokeAdapter";
import type { DrawingStroke, Entity, GlyphComponent, Point, SigilType, SignType } from "@/types/magic";
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

const compileCard = (sigil: SigilType = "fire", signs: readonly SignType[] = []) => {
  const result = compileSpellFromLegacyComponents([
    makeComponent("sigil", { sigilType: sigil }),
    ...signs.map((signType) => makeComponent("sign", { id: `sign-${signType}`, signType })),
    makeComponent("ring"),
  ], 92);

  if (!result.ok) {
    throw new Error(result.failure.message);
  }

  return result.card;
};

const makeEntity = (element: SigilType | null, overrides: Partial<Entity> = {}): Entity => ({
  id: `entity-${element ?? "none"}`,
  name: "Test Entity",
  hp: 30,
  maxHp: 30,
  shield: 0,
  ink: 12,
  maxInk: 12,
  inkRegenPerTurn: 3,
  inkPurity: 1,
  inkViscosity: 0.5,
  inkVolatility: 0.12,
  inkAffinity: null,
  activeInfusionIds: [],
  element,
  weakness: null,
  resistance: null,
  status: [],
  isPlayer: false,
  ...overrides,
});

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
      ...strokesFromTemplate("FRAME_CIRCLE_CONTAINMENT", 80, 80),
      ...strokesFromTemplate("ELEMENT_IGNIS", 90, 90),
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

  it("adds mandala positions, source stroke ids, and circle quality for freehand strokes", () => {
    const result = compileSpellFromStrokes([
      ...strokesFromTemplate("FRAME_CIRCLE_CONTAINMENT", 80, 80),
      ...strokesFromTemplate("ELEMENT_IGNIS", 90, 90),
      ...strokesFromTemplate("ACTION_EMIT", 250, 95),
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const mandala = result.card.mandala;
    expect(mandala).toBeDefined();
    expect(mandala?.circleQuality.overall).toBeGreaterThan(75);

    const frame = mandala?.symbols.find((symbol) => symbol.templateId === "FRAME_CIRCLE_CONTAINMENT");
    const ignis = mandala?.symbols.find((symbol) => symbol.templateId === "ELEMENT_IGNIS");
    const source = mandala?.symbols.find((symbol) => symbol.templateId === "SOURCE_DOT");

    expect(frame?.position?.zone).toBe("frame");
    expect(frame?.sourceStrokeIds.length).toBeGreaterThan(0);
    expect(ignis?.position).toBeDefined();
    expect(ignis?.sourceStrokeIds.length).toBeGreaterThan(0);
    expect(source?.isDefault).toBe(true);
    expect(source?.position).toBeUndefined();
    expect(source?.sourceStrokeIds).toEqual([]);
  });

  it("does not compile a SpellCard without a drawn frame", () => {
    const result = compileSpellFromStrokes([
      ...strokesFromTemplate("ELEMENT_IGNIS", 90, 90),
      ...strokesFromTemplate("ACTION_EMIT", 250, 95),
    ]);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.graphIssues?.some((issue) => issue.code === "missing_frame")).toBe(true);
  });

  it("generates a SpellCard through catalog glyph ids", () => {
    const card = compileCard("fire");

    expect(card.id).toMatch(/^formula_/);
    expect(card.componentTemplateIds).toEqual(expect.arrayContaining([
      "FRAME_CIRCLE_CONTAINMENT",
      "SOURCE_DOT",
      "ELEMENT_IGNIS",
      "ACTION_EMIT",
    ]));
    expect(card.drawnTemplateIds).toEqual(expect.arrayContaining([
      "FRAME_CIRCLE_CONTAINMENT",
      "ELEMENT_IGNIS",
    ]));
    expect(card.defaultedTemplateIds).toEqual(expect.arrayContaining([
      "SOURCE_DOT",
      "ACTION_EMIT",
      "FORM_PROJECTILE",
      "TARGET_ENEMY",
    ]));
    expect(card.codexTemplateIds).toEqual([
      "FRAME_CIRCLE_CONTAINMENT",
      "ELEMENT_IGNIS",
    ]);
    expect(card.name).not.toContain(" / ");
    expect(card.name).toBe("Projetil Igneo");
    expect(card.formula.formulaHash).toBe(card.id);
    expect(card.formula.castHash).toMatch(/^cast_/);
    expect(card.effectProfile.form).toBe("direction");
    expect(card.effectProfile.area).toBe("single");
    expect(card.effectSummary).toContain("Projetil");
    expect(card.mandala).toBeDefined();
    expect(card.mandala?.symbols.filter((symbol) => symbol.isDrawn).map((symbol) => symbol.templateId)).toEqual([
      "FRAME_CIRCLE_CONTAINMENT",
      "ELEMENT_IGNIS",
    ]);
    expect(card.mandala?.symbols.filter((symbol) => symbol.isDefault).map((symbol) => symbol.templateId)).toEqual([
      "SOURCE_DOT",
      "ACTION_EMIT",
      "FORM_PROJECTILE",
      "TARGET_ENEMY",
    ]);
    expect(card.mandala?.formulaReading).toContain("Circulo de Contencao");
    expect(card.mandala?.formulaReading).toContain("Ignis");
    expect(card.mandala?.formulaReading).not.toContain("/");
  });

  it("generates a stable mandala hash for repeated legacy compilations", () => {
    const first = compileCard("fire");
    const second = compileCard("fire");

    expect(first.mandala?.formulaHash).toMatch(/^formula_/);
    expect(first.mandala?.castHash).toMatch(/^cast_/);
    expect(first.mandala?.mandalaHash).toMatch(/^cast_/);
    expect(first.mandala?.formulaHash).toBe(second.mandala?.formulaHash);
    expect(first.mandala?.castHash).toBe(second.mandala?.castHash);
    expect(first.mandala?.mandalaHash).toBe(second.mandala?.mandalaHash);
  });

  it("records the complete formula but does not discover inferred defaults", () => {
    const card = compileCard("fire");
    const entries = recordSpellCardDiscovery([], card);

    expect(entries[0].componentTemplateIds).toEqual(expect.arrayContaining([
      "FRAME_CIRCLE_CONTAINMENT",
      "SOURCE_DOT",
      "ELEMENT_IGNIS",
      "ACTION_EMIT",
      "FORM_PROJECTILE",
      "TARGET_ENEMY",
    ]));
    expect(entries[0].codexTemplateIds).toEqual([
      "FRAME_CIRCLE_CONTAINMENT",
      "ELEMENT_IGNIS",
    ]);
    expect(entries[0].drawnTemplateIds).toEqual([
      "FRAME_CIRCLE_CONTAINMENT",
      "ELEMENT_IGNIS",
    ]);
    expect(entries[0].defaultedTemplateIds).toEqual(expect.arrayContaining([
      "SOURCE_DOT",
      "ACTION_EMIT",
      "FORM_PROJECTILE",
      "TARGET_ENEMY",
    ]));
    expect(entries[0].formulaHash).toBe(card.formula.formulaHash);
    expect(entries[0].castHash).toBe(card.formula.castHash);
    expect(entries[0].mandala?.formulaHash).toBe(card.formula.formulaHash);
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

  it("does not treat ELEMENT_MENS as legacy void", () => {
    expect(getLegacySigilForTemplateId("ELEMENT_MENS")).toBeUndefined();
    expect(compileSpellFromLegacyComponents([
      makeComponent("sigil", { sigilType: "void" }),
      makeComponent("ring"),
    ], 92).ok).toBe(false);
  });

  it("does not use equipped recipes as a whitelist for synthesized formulas", () => {
    const card = compileCard("fire");
    const validation = validateSpellCardForLoadout(card, {
      ...defaultGrimoireLoadout,
      allowedRecipeIds: [],
    });

    expect(validation.ok).toBe(true);
    expect(validation.recipeAllowed).toBe(false);
  });

  it("maps drawn forms into synthesized gameplay profiles", () => {
    expect(compileCard("fire", ["rain"]).effectProfile).toMatchObject({
      form: "rain",
      area: "area",
      target: "area",
    });
    expect(compileCard("fire", ["column"]).effectProfile).toMatchObject({
      form: "column",
      area: "line",
    });
    expect(compileCard("shadow", ["chain"]).effectProfile).toMatchObject({
      form: "chain",
      area: "single",
    });
    expect(compileCard("earth", ["shield_sign"]).effectProfile).toMatchObject({
      form: "shield_sign",
      area: "self",
      target: "self",
    });
    expect(compileCard("nature", ["heal_sign"]).effectProfile).toMatchObject({
      form: "heal_sign",
      area: "self",
      target: "self",
    });
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

  it("raises ink pressure when the mandala execution is unstable", () => {
    const card = compileCard("fire");
    const clean = calculateSpellCardInkCost({ card });
    const unstableCard = {
      ...card,
      stability: 42,
      formula: {
        ...card.formula,
        instability: 82,
        circleQuality: {
          closure: 45,
          roundness: 38,
          centeredness: 70,
          smoothness: 44,
          overall: 48,
        },
      },
    };
    const unstable = calculateSpellCardInkCost({ card: unstableCard });

    expect(unstable.stability).toBeGreaterThan(clean.stability);
    expect(unstable.risk).toBeGreaterThan(clean.risk);
    expect(unstable.total).toBeGreaterThan(clean.total);
  });
});

describe("enemy turn migration", () => {
  it("uses derived templates for enemy ice and thunder plans", () => {
    const player = makeEntity(null, { id: "player", isPlayer: true });
    const icePlan = chooseEnemySpellPlan(makeEntity("ice", { id: "enemy-ice-3" }), player);
    const thunderPlan = chooseEnemySpellPlan(makeEntity("thunder", { id: "enemy-thunder-3" }), player);

    expect(icePlan.templateIds).toContain("DERIVED_GELU");
    expect(icePlan.templateIds).not.toContain("ELEMENT_AQUA");
    expect(thunderPlan.templateIds).toContain("DERIVED_FULMEN");
    expect(thunderPlan.templateIds).not.toContain("ELEMENT_LUX");
  });

  it("does not call getEnemyAction from App", () => {
    const appSource = readFileSync(resolve(process.cwd(), "src/App.tsx"), "utf8");

    expect(appSource).not.toContain("getEnemyAction");
  });
});
