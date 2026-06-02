import { activeRuneDefinitions, getRuneByTemplateId } from "@/data/magicOntology";
import type { GlyphSemanticRole, GlyphTemplate } from "@/types/glyphTemplates";
import type { SpellCardKind, SpellCardTarget } from "@/types/spellCard";

export const roleLabels: Record<GlyphSemanticRole, string> = {
  container: "Moldura",
  source: "Fonte",
  connector: "Canal",
  element: "Elemento",
  derived: "Derivado",
  action: "Acao",
  form: "Forma",
  target: "Alvo",
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
  "target",
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

export const targetLabels: Record<SpellCardTarget, string> = {
  enemy: "Inimigo",
  self: "Conjurador",
  ally: "Aliado",
  area: "Area",
  default_enemy: "Inimigo padrao",
};

export const riskLabels = {
  low: "baixo",
  medium: "medio",
  high: "alto",
} as const;

export const sortGlyphsForCatalog = <T extends { readonly semantic_role: GlyphSemanticRole; readonly display_name: string }>(
  glyphs: readonly T[],
): readonly T[] =>
  [...glyphs].sort((a, b) =>
    glyphRoleOrder.indexOf(a.semantic_role) - glyphRoleOrder.indexOf(b.semantic_role) ||
    a.display_name.localeCompare(b.display_name),
  );

export const getRuneNameForTemplate = (templateId: string): string =>
  getRuneByTemplateId(templateId)?.name ?? templateId;

export const getTemplateRoleLabel = (templateId: string): string => {
  const rune = getRuneByTemplateId(templateId);
  return rune ? roleLabels[rune.role] : "Glifo";
};

export const getActiveRuneCountByRole = (role: GlyphSemanticRole): number =>
  activeRuneDefinitions.filter((rune) => rune.role === role).length;

export const getGlyphCatalogLine = (glyph: GlyphTemplate): string => {
  const rune = getRuneByTemplateId(glyph.id);
  const zone = rune?.expectedZones.join(", ") ?? "mandala";
  const defaulted = rune?.canBeDefaulted ? " Pode ser completado pelo compilador." : "";
  return `${roleLabels[glyph.semantic_role]} esperado em ${zone}.${defaulted}`;
};
