import { describe, expect, it } from "vitest";
import { glyphTemplates, getGlyphById } from "@/data/glyphTemplates";
import {
  activeRuneDefinitions,
  canTemplateBeDefaulted,
  getCodexDiscoverableTemplateIds,
  getDefaultableTemplateIds,
  getKnownByDefaultTemplateIds,
  getLegacySigilForTemplateId,
  getRuneByLegacySigil,
  getRuneByTemplateId,
  getTemplateIdForLegacySigil,
  magicRunes,
} from "@/data/magicOntology";
import { activeLegacySigns } from "@/data/activeRuneCatalog";
import { fallbackSpellRecipe, spellRecipes } from "@/data/spellRecipes";
import { GLYPH_SEMANTIC_ROLES, type GlyphSemanticRole } from "@/types/glyphTemplates";
import type { SigilType } from "@/types/magic";

const allLegacySigils: readonly SigilType[] = [
  "fire",
  "water",
  "earth",
  "wind",
  "light",
  "ice",
  "shadow",
  "thunder",
  "nature",
  "void",
];

const safeDefaultTemplateIds = new Set([
  "SOURCE_DOT",
  "ACTION_EMIT",
  "FORM_PROJECTILE",
  "TARGET_ENEMY",
]);

describe("magic ontology", () => {
  it("defines exactly one rune for every glyph template", () => {
    const templateIds = glyphTemplates.map((template) => template.id).sort();
    const runeTemplateIds = magicRunes.map((rune) => rune.templateId).sort();

    expect(runeTemplateIds).toEqual(templateIds);
    expect(new Set(runeTemplateIds).size).toBe(runeTemplateIds.length);
  });

  it("points every ontology definition at an existing glyph template with the same role", () => {
    for (const rune of magicRunes) {
      const template = getGlyphById(rune.templateId);

      expect(template, rune.templateId).toBeDefined();
      expect(template?.semantic_role).toBe(rune.role);
      expect(getRuneByTemplateId(rune.templateId)).toBe(rune);
    }
  });

  it("keeps helper template id outputs inside the glyph catalog", () => {
    const helperOutputs = [
      ...activeRuneDefinitions.map((rune) => rune.templateId),
      ...getDefaultableTemplateIds(),
      ...getCodexDiscoverableTemplateIds(),
      ...getKnownByDefaultTemplateIds(),
    ];

    for (const templateId of helperOutputs) {
      expect(getGlyphById(templateId), templateId).toBeDefined();
    }
  });

  it("keeps legacy sigil mappings unique and leaves void unmapped", () => {
    const mappedTemplateIds = allLegacySigils
      .map((sigil) => getTemplateIdForLegacySigil(sigil))
      .filter((templateId): templateId is string => Boolean(templateId));

    expect(new Set(mappedTemplateIds).size).toBe(mappedTemplateIds.length);
    expect(getTemplateIdForLegacySigil("void")).toBeUndefined();
    expect(getRuneByLegacySigil("void")).toBeUndefined();
    expect(getLegacySigilForTemplateId("ELEMENT_MENS")).toBeUndefined();
    expect(getTemplateIdForLegacySigil("ice")).toBe("DERIVED_GELU");
    expect(getTemplateIdForLegacySigil("thunder")).toBe("DERIVED_FULMEN");
    expect(getLegacySigilForTemplateId("DERIVED_GELU")).toBe("ice");
    expect(getLegacySigilForTemplateId("DERIVED_FULMEN")).toBe("thunder");
  });

  it("derives active legacy signs from ontology definitions", () => {
    const ontologySigns = [
      ...new Set(activeRuneDefinitions.flatMap((rune) => rune.legacySigns ?? [])),
    ].sort();

    expect([...activeLegacySigns].sort()).toEqual(ontologySigns);
    expect(activeLegacySigns).toContain("rain");
    expect(activeLegacySigns).toContain("shield_sign");
    expect(activeLegacySigns).toContain("chain");
  });

  it("only marks compiler-safe templates as defaultable", () => {
    expect(getDefaultableTemplateIds().sort()).toEqual([...safeDefaultTemplateIds].sort());

    for (const rune of magicRunes) {
      expect(canTemplateBeDefaulted(rune.templateId)).toBe(safeDefaultTemplateIds.has(rune.templateId));
    }
  });

  it("keeps spell recipe roles valid against glyph role types", () => {
    const roleSet = new Set<GlyphSemanticRole>(GLYPH_SEMANTIC_ROLES);
    const currentTemplateRoles = new Set(glyphTemplates.map((template) => template.semantic_role));

    for (const recipe of [...spellRecipes, fallbackSpellRecipe]) {
      for (const role of [...recipe.requiredRoles, ...(recipe.optionalRoles ?? [])]) {
        expect(roleSet.has(role), `${recipe.id}:${role}`).toBe(true);
      }

      for (const role of recipe.requiredRoles) {
        expect(currentTemplateRoles.has(role), `${recipe.id}:${role}`).toBe(true);
      }
    }
  });
});
