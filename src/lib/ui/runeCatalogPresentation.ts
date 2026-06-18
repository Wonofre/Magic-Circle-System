import { activeRuneDefinitions, getRuneByTemplateId } from "@/data/magicOntology";
import { getCatalogKey, getCatalogSigil } from "@/data/magicCatalogV2";
import type { GlyphSemanticRole, GlyphTemplate } from "@/types/glyphTemplates";
import type { MagicKeyKind } from "@/types/magicFormulaV2";
import type { SpellCardKind } from "@/types/spellCard";

export const roleLabels: Record<GlyphSemanticRole, string> = {
  container: "Moldura",
  source: "Fonte",
  connector: "Canal",
  element: "Elemento",
  derived: "Derivado",
  action: "Acao",
  form: "Forma",
  defense: "Defesa",
  time: "Tempo",
  risk: "Risco",
  ink: "Tinta",
};

export const glyphRoleOrder: readonly GlyphSemanticRole[] = [
  "container",
  "source",
  "element",
  "derived",
  "action",
  "form",
  "defense",
  "connector",
  "time",
  "risk",
  "ink",
];

export const kindLabels: Record<SpellCardKind, string> = {
  attack: "Ataque",
  defense: "Defesa",
  support: "Suporte",
  control: "Controle",
  utility: "Utilidade",
};

export const riskLabels = {
  low: "baixo",
  medium: "medio",
  high: "alto",
} as const;

export const keyKindLabels: Record<MagicKeyKind, string> = {
  form: "forma",
  modifier: "modificador",
  action: "acao",
  defense_form: "forma defensiva",
};

export const sortGlyphsForCatalog = <T extends { readonly semantic_role: GlyphSemanticRole; readonly display_name: string }>(
  glyphs: readonly T[],
): readonly T[] =>
  [...glyphs].sort((a, b) =>
    glyphRoleOrder.indexOf(a.semantic_role) - glyphRoleOrder.indexOf(b.semantic_role) ||
    a.display_name.localeCompare(b.display_name),
  );

export const getRuneNameForTemplate = (templateId: string): string =>
  getRuneByTemplateId(templateId)?.name ?? templateId;

export const getRuneBindingLabel = (templateId: string): string => {
  const rune = getRuneByTemplateId(templateId);
  if (!rune) return "fora da ontologia v2";

  if (rune.binding.type === "casting_circle") {
    return "Circulo de conjuracao v2";
  }

  if (rune.binding.type === "sigil") {
    return `Sigilo v2: ${getCatalogSigil(rune.binding.sigilId).name}`;
  }

  return `Chave v2: ${getCatalogKey(rune.binding.keyId).name} (${keyKindLabels[rune.binding.keyKind]})`;
};

export const getTemplateRoleLabel = (templateId: string): string => {
  const rune = getRuneByTemplateId(templateId);
  return rune ? roleLabels[rune.role] : "Glifo";
};

export const getActiveRuneCountByRole = (role: GlyphSemanticRole): number =>
  activeRuneDefinitions.filter((rune) => rune.role === role).length;

export const getGlyphCatalogLine = (glyph: GlyphTemplate): string => {
  const rune = getRuneByTemplateId(glyph.id);
  const zone = rune?.expectedZones.join(", ") ?? "mandala";
  const binding = rune ? ` ${getRuneBindingLabel(glyph.id)}.` : "";
  const defaulted = rune?.canBeDefaulted ? " Pode ser completado pelo compilador." : "";
  return `${roleLabels[glyph.semantic_role]} esperado em ${zone}.${binding}${defaulted}`;
};
