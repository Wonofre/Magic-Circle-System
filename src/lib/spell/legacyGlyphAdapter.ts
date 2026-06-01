import { getGlyphById } from "@/data/glyphTemplates";
import { compileSpellCardFromSemanticResults } from "@/lib/spell/spellCompiler";
import type { GlyphComponent, SigilType, SignType } from "@/types/magic";
import type {
  SemanticMarginResult,
  TemplateMatchCandidate,
} from "@/types/recognition";
import type { SpellCompileResult } from "@/types/spellCard";
import type { GlyphTemplate } from "@/types/glyphTemplates";

const SIGIL_TEMPLATE_BY_TYPE: Record<SigilType, string> = {
  fire: "ELEMENT_IGNIS",
  water: "ELEMENT_AQUA",
  earth: "ELEMENT_TERRA",
  wind: "ELEMENT_VENTUS",
  light: "ELEMENT_LUX",
  ice: "DERIVED_GELU",
  shadow: "ELEMENT_UMBRA",
  thunder: "DERIVED_FULMEN",
  nature: "ELEMENT_VITA",
  void: "ELEMENT_MENS",
};

const getSignTemplates = (sign: SignType): readonly string[] => {
  switch (sign) {
    case "heal_sign":
      return ["ACTION_RESTORE", "FORM_AURA", "TARGET_SELF"];
    case "shield_sign":
    case "float":
    case "billowing":
    case "reflect":
    case "anchor":
      return ["ACTION_CONTAIN", "DEFENSE_SHIELD", "TARGET_SELF"];
    case "chain":
    case "pull":
    case "convergence":
    case "collection":
      return ["ACTION_SEAL", "FORM_CHAIN", "TARGET_ENEMY"];
    case "column":
      return ["ACTION_EMIT", "FORM_BEAM", "TARGET_ENEMY"];
    case "rain":
      return ["ACTION_EMIT", "FORM_RAIN", "TARGET_ENEMY"];
    case "dispersion":
    case "weave":
      return ["ACTION_EMIT", "FORM_WAVE", "TARGET_ENEMY"];
    case "crush":
    case "explosion":
      return ["ACTION_EMIT", "FORM_PROJECTILE", "TARGET_ENEMY", "RISK_BACKFLOW"];
    case "levitation":
    case "direction":
    case "bolt":
    case "enlarge":
    case "bird":
    case "spiral":
    default:
      return ["ACTION_EMIT", "FORM_PROJECTILE", "TARGET_ENEMY"];
  }
};

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
    "SOURCE_DOT",
    ...sigils.map((sigil) => SIGIL_TEMPLATE_BY_TYPE[sigil]),
    ...(signs.length === 0
      ? ["ACTION_EMIT", "FORM_PROJECTILE", "TARGET_ENEMY"]
      : signs.flatMap(getSignTemplates)),
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
