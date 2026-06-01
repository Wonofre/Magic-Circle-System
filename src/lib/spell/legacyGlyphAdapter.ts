import { getGlyphById } from "@/data/glyphTemplates";
import { getTemplateIdsForActiveLegacySign } from "@/data/activeRuneCatalog";
import { getTemplateIdForLegacySigil } from "@/data/magicOntology";
import { compileSpellCardFromSemanticResults } from "@/lib/spell/spellCompiler";
import type { GlyphComponent } from "@/types/magic";
import type {
  SemanticMarginResult,
  TemplateMatchCandidate,
} from "@/types/recognition";
import type { SpellCompileResult } from "@/types/spellCard";
import type { GlyphTemplate } from "@/types/glyphTemplates";

const unique = <T,>(values: readonly T[]): readonly T[] => [...new Set(values)];

export const getTemplateIdsFromLegacyComponents = (
  components: readonly GlyphComponent[],
): readonly string[] => {
  const hasRing = components.some((component) => component.type === "ring");
  const sigils = components
    .filter((component) => component.type === "sigil" && component.sigilType)
    .map((component) => component.sigilType!);
  const signs = components
    .filter((component) => component.type === "sign" && component.signType)
    .map((component) => component.signType!);

  return unique([
    ...(hasRing ? ["FRAME_CIRCLE_CONTAINMENT"] : []),
    ...sigils
      .map(getTemplateIdForLegacySigil)
      .filter((id): id is string => Boolean(id)),
    ...signs.flatMap(getTemplateIdsForActiveLegacySign),
  ]);
};

const makeCandidate = (
  template: GlyphTemplate,
  rank: number,
  confidence: number,
): TemplateMatchCandidate => ({
  template,
  rank,
  confidence,
  shapeConfidence: confidence,
  meanDistance: Math.max(0, (1 - confidence) * 18),
  strokeCountDelta: 0,
  sampledPointCount: template.strokes.reduce((sum, stroke) => sum + stroke.length, 0),
});

const makeSemanticResult = (
  template: GlyphTemplate,
  rank: number,
  confidence: number,
): SemanticMarginResult => ({
  outcome: confidence >= 0.78 ? "cast_clean" : "cast_weak",
  candidate: makeCandidate(template, rank, confidence),
  riskLevel: template.semantic_role === "risk" || template.semantic_role === "ink"
    ? "high"
    : template.semantic_role === "action" || template.semantic_role === "defense" || template.semantic_role === "form"
      ? "medium"
      : "low",
  confidence,
  minConfidence: template.recognition.min_confidence,
  semanticMargin: Math.max(template.recognition.min_semantic_margin, 0.2),
  minSemanticMargin: template.recognition.min_semantic_margin,
  topologyValid: true,
  reasons: [
    {
      code: "legacy_catalog_bridge",
      message: `Legacy component mapped to catalog glyph ${template.id}.`,
      severity: "info",
    },
  ],
});

export const compileSpellFromLegacyComponents = (
  components: readonly GlyphComponent[],
  stability: number,
): SpellCompileResult => {
  const templateIds = getTemplateIdsFromLegacyComponents(components);
  const templates = templateIds.map((id) => getGlyphById(id)).filter((template): template is GlyphTemplate => Boolean(template));
  const confidence = Math.max(0.45, Math.min(0.98, stability / 100));

  return compileSpellCardFromSemanticResults(
    templates.map((template, index) => makeSemanticResult(template, index + 1, confidence)),
  );
};
