import type { GlyphTemplate } from "@/types/glyphTemplates";
import type { RecognitionStroke } from "@/types/recognition";

export interface EnemyStrokeRenderOptions {
  readonly seed?: number;
  readonly noise?: number;
}

const GLYPH_POSITIONS: readonly { readonly x: number; readonly y: number; readonly scale: number }[] = [
  { x: 50, y: 50, scale: 0.34 },
  { x: 50, y: 26, scale: 0.2 },
  { x: 70, y: 50, scale: 0.2 },
  { x: 50, y: 72, scale: 0.2 },
  { x: 30, y: 50, scale: 0.2 },
  { x: 66, y: 34, scale: 0.16 },
  { x: 66, y: 66, scale: 0.16 },
  { x: 34, y: 66, scale: 0.16 },
  { x: 34, y: 34, scale: 0.16 },
];

const makeRandom = (seed: number): (() => number) => {
  let state = seed >>> 0;

  return () => {
    state = Math.imul(1664525, state) + 1013904223;
    return ((state >>> 0) / 0xffffffff);
  };
};

const hashSeed = (value: string): number => {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0;
};

const getPlacement = (template: GlyphTemplate, index: number) => {
  if (template.semantic_role === "container") {
    return { x: 50, y: 50, scale: 1 };
  }

  return GLYPH_POSITIONS[index % GLYPH_POSITIONS.length];
};

export const renderEnemySpellStrokes = (
  templates: readonly GlyphTemplate[],
  options: EnemyStrokeRenderOptions = {},
): readonly RecognitionStroke[] => {
  const seed = options.seed ?? hashSeed(templates.map((template) => template.id).join("|"));
  const noise = Math.max(0, options.noise ?? 0.55);
  const random = makeRandom(seed);
  let strokeId = 0;
  let timestamp = 0;

  return templates.flatMap((template, templateIndex) => {
    const placement = getPlacement(template, templateIndex);

    return template.strokes.map((stroke) => {
      const points = stroke.map(([x, y]) => {
        const jitterX = (random() - 0.5) * noise;
        const jitterY = (random() - 0.5) * noise;
        timestamp += 16 + Math.round(random() * 10);

        return {
          x: placement.x + (x - 50) * placement.scale + jitterX,
          y: placement.y + (y - 50) * placement.scale + jitterY,
          t: timestamp,
          pressure: 0.55 + random() * 0.25,
          pointerType: "enemy_ai",
        };
      });

      return {
        id: `enemy-stroke-${strokeId++}`,
        points,
        timestamp,
      };
    });
  });
};
