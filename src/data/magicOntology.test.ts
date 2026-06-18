import { describe, expect, it } from "vitest";
import { glyphTemplates, getGlyphById } from "@/data/glyphTemplates";
import {
  activeRuneDefinitions,
  canTemplateBeDefaulted,
  getCodexDiscoverableTemplateIds,
  getDefaultableTemplateIds,
  getElementSigilForTemplateId,
  getKnownByDefaultTemplateIds,
  getMagicKeyForTemplateId,
  getRuneByTemplateId,
  magicRuneCatalogVersion,
  magicRunes,
  unknownNegativeTemplateIds,
} from "@/data/magicOntology";
import { magicCatalogV2 } from "@/data/magicCatalogV2";
import { fallbackSpellRecipe, spellRecipes } from "@/data/spellRecipes";
import { getGlyphCatalogLine, getRuneBindingLabel } from "@/lib/ui/runeCatalogPresentation";
import { GLYPH_SEMANTIC_ROLES, type GlyphSemanticRole } from "@/types/glyphTemplates";

describe("magic ontology v2", () => {
  it("points every active definition at an existing glyph template with the same role", () => {
    expect(magicRuneCatalogVersion).toBe(magicCatalogV2.version);
    for (const rune of magicRunes) {
      const template = getGlyphById(rune.templateId);

      expect(template, rune.templateId).toBeDefined();
      expect(template?.semantic_role).toBe(rune.role);
      expect(getRuneByTemplateId(rune.templateId)).toBe(rune);
    }
  });

  it("keeps explicit UNKNOWN negatives outside the learned class catalog", () => {
    const activeLearnedIds = new Set(
      activeRuneDefinitions
        .filter((rune) => rune.binding.type !== "casting_circle")
        .map((rune) => rune.templateId),
    );

    for (const templateId of unknownNegativeTemplateIds) {
      expect(getGlyphById(templateId), templateId).toBeDefined();
      expect(activeLearnedIds.has(templateId), templateId).toBe(false);
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

  it("maps template ids to v2 sigils and keys without source defaults", () => {
    expect(getElementSigilForTemplateId("ELEMENT_IGNIS")).toBe("IGNIS");
    expect(getElementSigilForTemplateId("DERIVED_GELU")).toBe("GELU");
    expect(getMagicKeyForTemplateId("FORM_PROJECTILE")).toBe("PROJECTILE");
    expect(getGlyphById("TARGET_SELF")).toBeUndefined();
    expect(getGlyphById("TARGET_ENEMY")).toBeUndefined();
    expect(getMagicKeyForTemplateId("TARGET_SELF")).toBeUndefined();
    expect(getRuneByTemplateId("SOURCE_DOT")).toBeUndefined();
    expect(getDefaultableTemplateIds()).toEqual([]);

    for (const rune of magicRunes) {
      expect(canTemplateBeDefaulted(rune.templateId)).toBe(false);
    }
  });

  it("keeps the v2 catalog free of source and connector glyph semantics", () => {
    const activeTemplates = new Set(activeRuneDefinitions.map((rune) => rune.templateId));
    const sourceTemplates = glyphTemplates
      .filter((template) => template.semantic_role === "source" || template.semantic_role === "connector")
      .map((template) => template.id);

    for (const templateId of sourceTemplates) {
      expect(activeTemplates.has(templateId), templateId).toBe(false);
    }

    expect(magicCatalogV2.legacyPolicy.runtimeLegacyAllowed).toBe(false);
    expect(magicCatalogV2.keys.some((key) => key.id === "PROJECTILE")).toBe(true);
  });

  it("covers every v2 sigil and key with at least one active drawable template", () => {
    const sigilIds = new Set(
      activeRuneDefinitions.flatMap((rune) => rune.binding.type === "sigil" ? [rune.binding.sigilId] : []),
    );
    const keyIds = new Set(
      activeRuneDefinitions.flatMap((rune) => rune.binding.type === "key" ? [rune.binding.keyId] : []),
    );

    for (const sigil of magicCatalogV2.sigils) {
      expect(sigilIds.has(sigil.id), sigil.id).toBe(true);
    }
    for (const key of magicCatalogV2.keys) {
      expect(keyIds.has(key.id), key.id).toBe(true);
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
        expect(role, `${recipe.id} should not require source`).not.toBe("source");
      }
    }
  });

  it("exposes v2 executable bindings in catalog presentation lines", () => {
    const emitGlyph = getGlyphById("ACTION_EMIT");
    const projectileGlyph = getGlyphById("FORM_PROJECTILE");
    const ignisGlyph = getGlyphById("ELEMENT_IGNIS");

    expect(emitGlyph).toBeDefined();
    expect(projectileGlyph).toBeDefined();
    expect(ignisGlyph).toBeDefined();
    if (!emitGlyph || !projectileGlyph || !ignisGlyph) return;

    expect(getRuneByTemplateId("ACTION_EMIT")?.name).toBe(emitGlyph.display_name);
    expect(getRuneByTemplateId("FORM_PROJECTILE")?.name).toBe(projectileGlyph.display_name);
    expect(getRuneBindingLabel("ACTION_EMIT")).toBe("Chave v2: Projetil (forma)");
    expect(getRuneBindingLabel("FORM_PROJECTILE")).toBe("Chave v2: Projetil (forma)");
    expect(getRuneBindingLabel("ELEMENT_IGNIS")).toBe("Sigilo v2: Ignis");
    expect(getGlyphCatalogLine(emitGlyph)).toContain("Chave v2: Projetil");
    expect(getGlyphCatalogLine(projectileGlyph)).toContain("Chave v2: Projetil");
    expect(getGlyphCatalogLine(ignisGlyph)).toContain("Sigilo v2: Ignis");
  });
});
