import { z } from "zod";

import rawGlyphTemplates from "./glyphTemplates.seed.json";
import {
  GLYPH_FAMILIES,
  GLYPH_SEMANTIC_ROLES,
  type GlyphFamily,
  type GlyphSemanticRole,
  type GlyphTemplate,
} from "@/types/glyphTemplates";

const glyphPointSchema = z.tuple([z.number(), z.number()]);

const glyphTemplateSchema = z
  .object({
    id: z.string().min(1),
    display_name: z.string().min(1),
    family: z.enum(GLYPH_FAMILIES),
    semantic_role: z.enum(GLYPH_SEMANTIC_ROLES),
    description: z.string(),
    strokes: z.array(z.array(glyphPointSchema).min(1)).min(1),
    ports: z.array(z.string().min(1)),
    topology_signature: z
      .object({
        loops: z.number().int().nonnegative(),
        open_strokes: z.number().int().nonnegative(),
        dominant_geometry: z.string().min(1),
        closure_required: z.number().min(0).max(1).optional(),
        expected_intersections: z.number().int().nonnegative().optional(),
        corners_min: z.number().int().nonnegative().optional(),
        corners_max: z.number().int().nonnegative().optional(),
        requires_exit_marker: z.boolean().optional(),
        turns_min: z.number().nonnegative().optional(),
      })
      .strict(),
    recognition: z
      .object({
        method: z.string().min(1),
        min_confidence: z.number().min(0).max(1),
        min_semantic_margin: z.number().min(0).max(1),
        recommended_recognizers: z.array(z.string().min(1)),
        reject_if: z.array(z.string().min(1)),
      })
      .strict(),
    tags: z.array(z.string().min(1)),
  })
  .strict();

const glyphTemplateSeedSchema = z.array(glyphTemplateSchema).superRefine((templates, context) => {
  const seenIds = new Map<string, number>();

  templates.forEach((template, index) => {
    const firstIndex = seenIds.get(template.id);

    if (firstIndex !== undefined) {
      context.addIssue({
        code: "custom",
        message: `duplicate glyph id "${template.id}" also appears at index ${firstIndex}`,
        path: [index, "id"],
      });
      return;
    }

    seenIds.set(template.id, index);
  });
});

const parseGlyphTemplates = (value: unknown): readonly GlyphTemplate[] => {
  const result = glyphTemplateSeedSchema.safeParse(value);

  if (!result.success) {
    throw new Error(`Invalid glyph template seed: ${z.prettifyError(result.error)}`);
  }

  return result.data;
};

export const glyphTemplates: readonly GlyphTemplate[] = parseGlyphTemplates(rawGlyphTemplates);

export const glyphTemplateCount = glyphTemplates.length;

const glyphsById = new Map(glyphTemplates.map((glyph) => [glyph.id, glyph]));

const indexGlyphsBy = <TKey extends string>(
  getKey: (glyph: GlyphTemplate) => TKey,
): ReadonlyMap<TKey, readonly GlyphTemplate[]> => {
  const index = new Map<TKey, GlyphTemplate[]>();

  for (const glyph of glyphTemplates) {
    const key = getKey(glyph);
    const glyphs = index.get(key);

    if (glyphs) {
      glyphs.push(glyph);
    } else {
      index.set(key, [glyph]);
    }
  }

  return index;
};

const glyphsByFamily = indexGlyphsBy((glyph) => glyph.family);
const glyphsByRole = indexGlyphsBy((glyph) => glyph.semantic_role);

export const getGlyphById = (id: string): GlyphTemplate | undefined => glyphsById.get(id);

export const getGlyphsByFamily = (family: GlyphFamily): readonly GlyphTemplate[] =>
  glyphsByFamily.get(family) ?? [];

export const getGlyphsByRole = (role: GlyphSemanticRole): readonly GlyphTemplate[] =>
  glyphsByRole.get(role) ?? [];
