import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getGlyphById } from "@/data/glyphTemplates";
import { defaultGrimoireLoadout, recordSpellCardDiscovery, validateSpellCardForLoadout } from "@/lib/spell/codexStore";
import { calculateFinalCastPrecision, resolveSpellCardCast } from "@/lib/spell/combatResolver";
import { chooseEnemySpellPlan } from "@/lib/spell/enemySpellAI";
import { calculateSpellCardInkCost, simulateInkSpend } from "@/lib/spell/inkSimulator";
import { compileSpellFromStrokes, compileSpellFromStrokesSync } from "@/lib/spell/spellCompiler";
import { getAllowedGlyphIds } from "@/lib/spell/codexStore";
import type { RecognitionContext } from "@/lib/recognizerV2/recognitionContext";

import { detectChannelsV2 } from "@/lib/recognizerV2/channelDetectorV2";
import { analyzeCastingCircleGesture } from "@/lib/recognizerV2/canvasFeedbackV2";
import { compileMagicFormulaV2 } from "@/lib/spellV2/formulaCompilerV2";
import { generateEnemy } from "@/lib/spellEngine";
import { drawingStrokesToRecognitionStrokes, hasPointerDynamics } from "@/lib/spell/strokeAdapter";
import type { DrawingStroke, Entity, Point } from "@/types/magic";
import type { ElementSigilId } from "@/types/magicFormulaV2";
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

const placementForTemplate = (templateId: string, index: number) => {
  if (templateId.startsWith("FRAME_")) return { x: 260, y: 260, scale: 3 };
  if (templateId.startsWith("ELEMENT_") || templateId.startsWith("DERIVED_")) return { x: 260, y: 260, scale: 0.78 };
  const keyPlacements = [
    { x: 360, y: 260, scale: 0.72 },
    { x: 260, y: 360, scale: 0.72 },
    { x: 160, y: 260, scale: 0.72 },
    { x: 260, y: 160, scale: 0.72 },
  ];
  return keyPlacements[(index - 2 + keyPlacements.length) % keyPlacements.length];
};

const formulaStrokes = (templateIds: readonly string[]): readonly RecognitionStroke[] => {
  let strokeId = 0;
  return templateIds.flatMap((templateId, index) => {
    const template = getGlyphById(templateId);
    if (!template) throw new Error(`Missing test template ${templateId}`);
    const placement = placementForTemplate(templateId, index);

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

const splitStrokeIntoSegments = (
  stroke: RecognitionStroke,
): readonly RecognitionStroke[] =>
  stroke.points.slice(1).map((point, index) => ({
    id: `${stroke.id}:segment:${index}`,
    points: [stroke.points[index], point],
  }));

const compileCard = (templateIds: readonly string[] = [
  "FRAME_CIRCLE_CONTAINMENT",
  "DERIVED_FULMEN",
  "ACTION_EMIT",
  "FORM_PROJECTILE",
]) => {
  const result = compileSpellFromStrokesSync(formulaStrokes(templateIds));
  if (!result.ok) throw new Error(result.failure.message);
  return result.card;
};

const tutorialTopologyStrokes = (): readonly RecognitionStroke[] => {
  const canonical = formulaStrokes([
    "FRAME_CIRCLE_CONTAINMENT",
    "ELEMENT_AQUA",
    "FORM_PROJECTILE",
  ]);
  return [
    ...canonical.filter((stroke) => stroke.id?.startsWith("ELEMENT_AQUA")),
    {
      id: "tutorial-containment",
      points: makeCircle(260, 260, 52),
    },
    ...canonical.filter((stroke) => stroke.id?.startsWith("FORM_PROJECTILE")),
    {
      id: "tutorial-key-scope",
      points: makeCircle(360, 260, 42),
    },
    {
      id: "tutorial-channel",
      points: [
        { x: 312, y: 260 },
        { x: 336, y: 260 },
        { x: 360, y: 260 },
      ],
    },
    {
      id: "tutorial-casting-circle",
      points: makeCircle(260, 260, 160),
    },
  ];
};

const makeEntity = (element: ElementSigilId | null, overrides: Partial<Entity> = {}): Entity => ({
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
    const closed = analyzeCastingCircleGesture(makeCircle(260, 260, 170));
    const open = analyzeCastingCircleGesture(makeCircle(260, 260, 170, 170, Math.PI * 1.45));
    const oval = analyzeCastingCircleGesture(makeCircle(260, 260, 210, 105));
    const offCenter = analyzeCastingCircleGesture(makeCircle(370, 370, 170));

    expect(closed.precision).toBeGreaterThan(82);
    expect(closed.isPlausibleCastingCircle).toBe(true);
    expect(open.precision).toBeLessThan(closed.precision);
    expect(oval.precision).toBeLessThan(closed.precision);
    expect(offCenter.precision).toBeLessThan(closed.precision);
  });
});

describe("MagicFormulaV2 gameplay integration", () => {
  it("compiles strokes into a v2 visual formula without inferred defaults", () => {
    const card = compileCard();

    expect(card.id).toMatch(/^formula_v2_/);
    expect(card.formula.version).toBe(2);
    expect(card.formula.validity).toBe("valid_visual_formula");
    expect(card.formula.sigils[0]?.sigilId).toBe("FULMEN");
    expect(card.formula.keys.map((key) => key.keyId)).toEqual(expect.arrayContaining(["PROJECTILE"]));
    expect(card.componentTemplateIds).not.toContain("SOURCE_DOT");
    expect(card.defaultedTemplateIds).toEqual([]);
    expect(card.name).toContain("Fulmen");
    expect(card.name).not.toContain("Projetil Projetil");
    expect(card.kind).toBe("attack");
    expect(card.effectProfile.form).toBe("PROJECTILE");
    expect(card.effectProfile.area).toBe("single");
    expect(card.formulaV2).toBe(card.formula);
    expect(card.graph.version).toBe(2);
    expect(card.graph.formulaHash).toBe(card.formula.formulaHash);
  });

  it("synthesizes executable status, field, shield bypass, and healing effects from v2 keys", () => {
    const trap = compileCard([
      "FRAME_CIRCLE_CONTAINMENT",
      "ELEMENT_IGNIS",
      "FORM_TRAP",
      "TIME_TICK",
    ]);
    const pierce = compileCard([
      "FRAME_CIRCLE_CONTAINMENT",
      "DERIVED_FULMEN",
      "FORM_BEAM",
      "MODIFIER_SPIRAL",
    ]);
    const heal = compileCard([
      "FRAME_CIRCLE_CONTAINMENT",
      "ELEMENT_VITA",
      "ACTION_RESTORE",
      "FORM_AURA",
    ]);

    expect(trap.effectProfile.statusEffects.some((status) => status.type === "burn")).toBe(true);
    expect(trap.effectProfile.fieldEffect?.type).toBe("trap_zone");
    expect(pierce.effectProfile.shieldBypassRatio).toBeGreaterThan(0.4);
    expect(heal.kind).toBe("support");
    expect(heal.effectProfile.area).toBe("self");
    expect(heal.effectProfile.healingScale).toBeGreaterThan(0);
  }, 15000);

  it("rejects a formula without a casting circle", () => {
    const result = compileSpellFromStrokesSync(formulaStrokes([
      "ELEMENT_IGNIS",
      "ACTION_EMIT",
      "FORM_PROJECTILE",
    ]));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.formulaIssues?.some((issue) => issue.code === "missing_casting_circle")).toBe(true);
  });

  it("rejects a straight key-to-key channel", () => {
    const castingCircle = {
      id: "circle:casting",
      role: "casting_circle" as const,
      center: { x: 260, y: 260 },
      radius: 140,
      closure: 1,
      roundness: 1,
      smoothness: 1,
      concentricity: 1,
      quality: 1,
      strokeIds: ["circle"],
    };
    const sigil = {
      id: "sigil:fulmen",
      sigilId: "FULMEN" as const,
      templateId: "DERIVED_FULMEN",
      confidence: 1,
      closure: 0,
      isClosed: false,
      center: { x: 260, y: 260 },
      futureEffectHints: {},
    };
    const keys = [
      {
        id: "key:projectile",
        keyId: "PROJECTILE" as const,
        templateId: "FORM_PROJECTILE",
        kind: "form" as const,
        confidence: 1,
        center: { x: 360, y: 260 },
        scope: "global" as const,
        futureEffectTags: [],
      },
      {
        id: "key:pierce",
        keyId: "PIERCE" as const,
        templateId: "FORM_BEAM",
        kind: "modifier" as const,
        confidence: 1,
        center: { x: 260, y: 360 },
        scope: "global" as const,
        futureEffectTags: [],
      },
    ];
    const strokes = [{
      id: "straight-key-channel",
      points: [
        { x: 360, y: 260 },
        { x: 310, y: 310 },
        { x: 260, y: 360 },
      ],
    }];
    const channels = detectChannelsV2({
      strokes,
      sigils: [sigil],
      keys,
      castingCircle,
      excludedStrokeIds: new Set(),
    });
    const formula = compileMagicFormulaV2({
      strokes,
      castingCircle,
      keyScopeCircles: [],
      sigils: [sigil],
      keys,
      channels,
      componentRecognitions: [],
      excludedStrokeIds: new Set(),
    });

    expect(channels[0]?.geometry).toBe("invalid_straight");
    expect(formula.validity).toBe("invalid");
    expect(formula.issues.some((issue) => issue.code === "straight_key_channel")).toBe(true);
  });

  it("snaps a straight central channel to the containment edge", () => {
    const castingCircle = {
      id: "circle:casting",
      role: "casting_circle" as const,
      center: { x: 260, y: 260 },
      radius: 140,
      closure: 1,
      roundness: 1,
      smoothness: 1,
      concentricity: 1,
      quality: 1,
      strokeIds: ["circle"],
    };
    const containment = {
      id: "circle:sigil",
      role: "sigil_containment" as const,
      center: { x: 260, y: 260 },
      radius: 52,
      closure: 1,
      roundness: 1,
      smoothness: 1,
      concentricity: 1,
      quality: 1,
      strokeIds: ["containment"],
    };
    const sigil = {
      id: "sigil:aqua",
      sigilId: "AQUA" as const,
      templateId: "ELEMENT_AQUA",
      confidence: 1,
      closure: 1,
      isClosed: true,
      center: { x: 260, y: 260 },
      containedByCircleId: containment.id,
      futureEffectHints: {},
    };
    const key = {
      id: "key:projectile",
      keyId: "PROJECTILE" as const,
      templateId: "FORM_PROJECTILE",
      kind: "form" as const,
      confidence: 1,
      center: { x: 360, y: 260 },
      scope: "global" as const,
      futureEffectTags: [],
    };
    const stroke = {
      id: "straight-central-channel",
      points: [
        { x: 312, y: 260 },
        { x: 336, y: 260 },
        { x: 360, y: 260 },
      ],
    };
    const channels = detectChannelsV2({
      strokes: [stroke],
      sigils: [sigil],
      keys: [key],
      containment,
      castingCircle,
      excludedStrokeIds: new Set(),
    });

    expect(channels).toHaveLength(1);
    expect(channels[0]?.kind).toBe("key_to_containment");
    expect(channels[0]?.geometry).toBe("straight_radial");
    expect(channels[0]?.fromId === containment.id || channels[0]?.toId === containment.id).toBe(true);
  });

  it("accepts a central sigil-to-key channel as straight when no containment exists", () => {
    const castingCircle = {
      id: "circle:casting",
      role: "casting_circle" as const,
      center: { x: 260, y: 260 },
      radius: 140,
      closure: 1,
      roundness: 1,
      smoothness: 1,
      concentricity: 1,
      quality: 1,
      strokeIds: ["circle"],
    };
    const sigil = {
      id: "sigil:aqua",
      sigilId: "AQUA" as const,
      templateId: "ELEMENT_AQUA",
      confidence: 1,
      closure: 1,
      isClosed: true,
      center: { x: 260, y: 260 },
      futureEffectHints: {},
    };
    const key = {
      id: "key:projectile",
      keyId: "PROJECTILE" as const,
      templateId: "FORM_PROJECTILE",
      kind: "form" as const,
      confidence: 1,
      center: { x: 360, y: 260 },
      scope: "global" as const,
      futureEffectTags: [],
    };
    const channels = detectChannelsV2({
      strokes: [{
        id: "straight-sigil-channel",
        points: [
          { x: 260, y: 260 },
          { x: 310, y: 260 },
          { x: 360, y: 260 },
        ],
      }],
      sigils: [sigil],
      keys: [key],
      castingCircle,
      excludedStrokeIds: new Set(),
    });

    expect(channels[0]?.kind).toBe("key_to_sigil");
    expect(channels[0]?.geometry).toBe("straight_radial");
  });

  it("recognizes a glyph completed with more than three pen strokes", () => {
    const canonical = formulaStrokes([
      "FRAME_CIRCLE_CONTAINMENT",
      "ELEMENT_AQUA",
      "FORM_PROJECTILE",
    ]);
    const aquaStrokes = canonical.filter((stroke) => stroke.id?.startsWith("ELEMENT_AQUA"));
    const segmentedAqua = [
      ...splitStrokeIntoSegments(aquaStrokes[0]),
      ...aquaStrokes.slice(1),
    ];
    const strokes = [
      ...canonical.filter((stroke) => stroke.id?.startsWith("FRAME_")),
      ...segmentedAqua,
      ...canonical.filter((stroke) => stroke.id?.startsWith("FORM_PROJECTILE")),
    ];
    const result = compileSpellFromStrokesSync(strokes);

    expect(segmentedAqua.length).toBeGreaterThan(3);
    expect(
      result.ok,
      result.ok
        ? "compiled"
        : `${result.failure.message}:${result.failure.formulaIssues?.map((issue) => issue.code).join(",")}`,
    ).toBe(true);
    if (result.ok) {
      expect(result.card.drawnTemplateIds).toContain("ELEMENT_AQUA");
      expect(
        result.card.drawnTemplateIds.some((id) =>
          id === "FORM_PROJECTILE" || id === "ACTION_EMIT",
        ),
      ).toBe(true);
    }
  }, 10000);

  it("compiles the traced tutorial topology through the containment circle", () => {
    const result = compileSpellFromStrokesSync(tutorialTopologyStrokes());

    expect(
      result.ok,
      result.ok
        ? "compiled"
        : `${result.failure.message}:${result.failure.formulaIssues?.map((issue) => issue.code).join(",")}`,
    ).toBe(true);
    if (result.ok) {
      expect(result.card.formula.sigilContainment?.strokeIds).toContain("tutorial-containment");
      expect(result.card.formula.channels).toEqual(expect.arrayContaining([
        expect.objectContaining({
          kind: "key_to_containment",
          geometry: "straight_radial",
        }),
      ]));
      expect(result.card.formula.validity).toBe("valid_visual_formula");
    }
  }, 20000);

  it("compiles tutorial topology through fused async recognition with gameplay context", async () => {
    const strokes = tutorialTopologyStrokes();
    const recognitionContext: RecognitionContext = {
      allowedTemplateIds: getAllowedGlyphIds(defaultGrimoireLoadout, []),
      enemyWeakness: "UMBRA",
    };
    const result = await compileSpellFromStrokes(strokes, { recognitionContext });

    expect(
      result.ok,
      result.ok
        ? "compiled"
        : `${result.failure.message}:${result.failure.formulaIssues?.map((issue) => issue.code).join(",")}`,
    ).toBe(true);
    if (!result.ok) return;

    expect(result.card.formula.version).toBe(2);
    expect(result.card.formula.validity).toBe("valid_visual_formula");
    expect(result.card.formula.sigils[0]?.sigilId).toBe("AQUA");
    expect(result.card.formula.sigilContainment?.strokeIds).toContain("tutorial-containment");
    expect(result.card.formula.channels).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: "key_to_containment",
        geometry: "straight_radial",
      }),
    ]));
    expect(result.card.drawnTemplateIds).toContain("ELEMENT_AQUA");
    expect(result.semanticResults?.length).toBeGreaterThan(0);
    if (result.telemetry?.model) {
      expect(["ready", "unavailable"]).toContain(result.telemetry.model.status);
    }
  }, 30000);

  it("resolves player combat from async fused SpellCard", async () => {
    const compiled = await compileSpellFromStrokes(tutorialTopologyStrokes(), {
      recognitionContext: {
        allowedTemplateIds: getAllowedGlyphIds(defaultGrimoireLoadout, []),
        enemyWeakness: "UMBRA",
      },
    });

    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;

    const enemy = makeEntity("UMBRA", { id: "enemy-umbra", weakness: "LUX" });
    const precision = calculateFinalCastPrecision(compiled.card);
    const cast = resolveSpellCardCast({
      card: compiled.card,
      precision,
      opponent: enemy,
      inkCost: calculateSpellCardInkCost({ card: compiled.card }).total,
    });

    expect(cast.formula?.version).toBe(2);
    expect(cast.spellCard.id).toBe(compiled.card.id);
    expect(cast.inkCostBreakdown.total).toBeGreaterThan(0);
    expect(
      cast.damage + cast.healing + cast.shield + cast.statusEffects.length + (cast.fieldEffect ? 1 : 0),
    ).toBeGreaterThan(0);
    expect(compiled.card.effectProfile.form).toBe("PROJECTILE");
  }, 30000);

  it("recovers a curved key channel even when the stroke was consumed by component grouping", () => {
    const castingCircle = {
      id: "circle:casting",
      role: "casting_circle" as const,
      center: { x: 260, y: 260 },
      radius: 140,
      closure: 1,
      roundness: 1,
      smoothness: 1,
      concentricity: 1,
      quality: 1,
      strokeIds: ["circle"],
    };
    const sigil = {
      id: "sigil:fulmen",
      sigilId: "FULMEN" as const,
      templateId: "DERIVED_FULMEN",
      confidence: 1,
      closure: 0,
      isClosed: false,
      center: { x: 260, y: 260 },
      futureEffectHints: {},
    };
    const keys = [
      {
        id: "key:projectile",
        keyId: "PROJECTILE" as const,
        templateId: "FORM_PROJECTILE",
        kind: "form" as const,
        confidence: 1,
        center: { x: 360, y: 260 },
        scope: "global" as const,
        futureEffectTags: [],
      },
      {
        id: "key:spiral",
        keyId: "SPIRAL" as const,
        templateId: "MODIFIER_SPIRAL",
        kind: "modifier" as const,
        confidence: 1,
        center: { x: 260, y: 360 },
        scope: "global" as const,
        futureEffectTags: [],
      },
    ];
    const stroke = {
      id: "soft-excluded-channel",
      points: Array.from({ length: 18 }, (_, index) => {
        const angle = (index / 17) * (Math.PI / 2);
        return {
          x: 260 + Math.cos(angle) * 100,
          y: 260 + Math.sin(angle) * 100,
        };
      }),
    };
    const channels = detectChannelsV2({
      strokes: [stroke],
      sigils: [sigil],
      keys,
      castingCircle,
      excludedStrokeIds: new Set(["soft-excluded-channel"]),
    });
    const hardExcluded = detectChannelsV2({
      strokes: [stroke],
      sigils: [sigil],
      keys,
      castingCircle,
      excludedStrokeIds: new Set(["soft-excluded-channel"]),
      hardExcludedStrokeIds: new Set(["soft-excluded-channel"]),
    });

    expect(channels[0]?.kind).toBe("key_to_key");
    expect(channels[0]?.geometry).not.toBe("invalid_straight");
    expect(hardExcluded).toHaveLength(0);
  });

  it("records MagicFormulaV2 in the Codex", () => {
    const card = compileCard();
    const entries = recordSpellCardDiscovery([], card);

    expect(entries[0].formulaV2?.version).toBe(2);
    expect(entries[0].formulaHash).toBe(card.formula.formulaHash);
    expect(entries[0].visualHash).toBe(card.formula.visualHash);
    expect(entries[0].componentTemplateIds).toEqual(card.componentTemplateIds);
  });

  it("keeps Codex storage on the v2 key without importing v1 entries", () => {
    const source = readFileSync(resolve(process.cwd(), "src/lib/spell/codexStore.ts"), "utf8");

    expect(source).toContain("magic-circle-codex-v2");
    expect(source).not.toContain("magic-circle-codex-v1");
    expect(source).not.toContain("witch-hat-codex");
    expect(source).not.toContain("migrateLegacyCodexEntries");
  });

  it("allows active glyphs and blocks glyphs missing from a custom loadout", () => {
    const knownCard = compileCard();
    const geluCard = compileCard([
      "FRAME_CIRCLE_CONTAINMENT",
      "DERIVED_FULMEN",
      "ACTION_EMIT",
      "FORM_PROJECTILE",
    ]);
    const loadoutWithoutFulmen = {
      ...defaultGrimoireLoadout,
      knownGlyphIds: defaultGrimoireLoadout.knownGlyphIds.filter((id) => id !== "DERIVED_FULMEN"),
    };

    expect(validateSpellCardForLoadout(knownCard, defaultGrimoireLoadout).ok).toBe(true);
    expect(validateSpellCardForLoadout(geluCard, defaultGrimoireLoadout).ok).toBe(true);
    expect(validateSpellCardForLoadout(geluCard, loadoutWithoutFulmen).ok).toBe(false);
    expect(validateSpellCardForLoadout(geluCard, loadoutWithoutFulmen).missingGlyphIds).toContain("DERIVED_FULMEN");
  });

  it("does not use equipped recipes as a hard whitelist", () => {
    const card = compileCard();
    const validation = validateSpellCardForLoadout(card, {
      ...defaultGrimoireLoadout,
      allowedRecipeIds: [],
    });

    expect(validation.ok).toBe(true);
    expect(validation.recipeAllowed).toBe(false);
  });

  it("blocks a SpellCard when the reservoir cannot pay the final ink cost", () => {
    const card = compileCard();
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

  it("raises ink pressure when the v2 formula is unstable", () => {
    const card = compileCard();
    const clean = calculateSpellCardInkCost({ card });
    const unstableCard = {
      ...card,
      stability: 36,
      formula: {
        ...card.formula,
        validity: "invalid" as const,
        keys: card.formula.keys.map((key, index) => index === 0 ? { ...key, scope: "dormant" as const } : key),
        channels: [
          ...card.formula.channels,
          {
            id: "channel:test",
            kind: "key_to_key" as const,
            fromId: "key:a",
            toId: "key:b",
            geometry: "invalid_straight" as const,
            curvatureScore: 0,
            endpointSnapScore: 1,
            symmetryScore: 0,
            crossesCastingCircle: false,
            quality: 0.1,
            strokeIds: ["test"],
          },
        ],
      },
    };
    const unstable = calculateSpellCardInkCost({ card: unstableCard });

    expect(unstable.stability).toBeGreaterThan(clean.stability);
    expect(unstable.risk).toBeGreaterThan(clean.risk);
    expect(unstable.total).toBeGreaterThan(clean.total);
  });
});

describe("enemy turn v2 migration", () => {
  it("uses v2 derived templates for enemy ice and lightning plans", () => {
    const player = makeEntity(null, { id: "player", isPlayer: true });
    const icePlan = chooseEnemySpellPlan(makeEntity("GELU", { id: "enemy-ice-3" }), player);
    const lightningPlan = chooseEnemySpellPlan(makeEntity("FULMEN", { id: "enemy-lightning-3" }), player);

    expect(icePlan.templateIds).toContain("DERIVED_GELU");
    expect(icePlan.templateIds).not.toContain("ELEMENT_AQUA");
    expect(lightningPlan.templateIds).toContain("DERIVED_FULMEN");
    expect(lightningPlan.templateIds).not.toContain("ELEMENT_LUX");
  });

  it("compiles enemy plan strokes into executable SpellCards", () => {
    const player = makeEntity(null, { id: "player", isPlayer: true });

    for (let round = 1; round <= 12; round += 1) {
      const enemy = generateEnemy(round);
      const plan = chooseEnemySpellPlan(enemy, player, { turn: round });
      const compiled = compileSpellFromStrokesSync(plan.strokes);

      expect(
        compiled.ok,
        `${enemy.name}:${plan.intent}:${plan.templateIds.join(",")}:${compiled.ok ? "ok" : compiled.failure.message}`,
      ).toBe(true);
      if (!compiled.ok) continue;
      expect(
        compiled.card.formula.validity,
        `${enemy.name}:${plan.intent}:${compiled.card.formula.issues.map((issue) => issue.code).join(",")}`,
      ).toBe("valid_visual_formula");
      expect(compiled.card.formula.sourceTemplateIds).toEqual(expect.arrayContaining(plan.templateIds.slice(1, 3)));
    }
  }, 15000);

  it("resolves enemy combat from the compiled SpellCard instead of plan estimates", () => {
    const player = makeEntity(null, { id: "player", isPlayer: true });
    const enemy = makeEntity("FULMEN", { id: "enemy-lightning-3" });
    const plan = chooseEnemySpellPlan(enemy, player, { turn: 3 });
    const compiled = compileSpellFromStrokesSync(plan.strokes);

    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;

    const precision = calculateFinalCastPrecision(compiled.card);
    const cast = resolveSpellCardCast({
      card: compiled.card,
      precision,
      opponent: player,
      inkCost: calculateSpellCardInkCost({ card: compiled.card }).total,
    });

    expect(cast.formula?.version).toBe(2);
    expect(cast.spellCard.id).toBe(compiled.card.id);
    expect(cast.inkCostBreakdown.total).toBeGreaterThan(0);
    expect(cast.damage + cast.healing + cast.shield + cast.statusEffects.length + (cast.fieldEffect ? 1 : 0)).toBeGreaterThan(0);
    expect(cast.damage).not.toBe(plan.expectedPower);
  });

  it("does not call getEnemyAction from App", () => {
    const appSource = readFileSync(resolve(process.cwd(), "src/App.tsx"), "utf8");

    expect(appSource).not.toContain("getEnemyAction");
  });

  it("keeps gameplay and canvas on the v2.2 runtime path", () => {
    const appSource = readFileSync(resolve(process.cwd(), "src/App.tsx"), "utf8");
    const canvasSource = readFileSync(resolve(process.cwd(), "src/components/GameCanvas.tsx"), "utf8");
    const magicTypesSource = readFileSync(resolve(process.cwd(), "src/types/magic.ts"), "utf8");

    expect(appSource).not.toContain("drawingElementToV2");
    expect(appSource).not.toContain("componentsOverride.length === 0");
    expect(canvasSource).not.toContain("magicSystem");
    expect(canvasSource).toContain("canvasFeedbackV2");
    expect(magicTypesSource).not.toContain("DrawingSigilShapeId");
    expect(magicTypesSource).not.toContain("DrawingKeyShapeId");
    expect(magicTypesSource).not.toContain("GlyphComponent");
  });

  it("keeps the runtime free of the removed target glyph system", () => {
    const spellCardSource = readFileSync(resolve(process.cwd(), "src/types/spellCard.ts"), "utf8");
    const compilerSource = readFileSync(resolve(process.cwd(), "src/lib/spell/spellCompiler.ts"), "utf8");
    const aiSource = readFileSync(resolve(process.cwd(), "src/lib/spell/enemySpellAI.ts"), "utf8");

    for (const source of [spellCardSource, compilerSource, aiSource]) {
      expect(source).not.toContain("TARGET_SELF");
      expect(source).not.toContain("TARGET_ENEMY");
      expect(source).not.toContain("BIND_SELF");
      expect(source).not.toContain("BIND_ENEMY");
      expect(source).not.toContain("SpellCardTarget");
    }
  });
});
