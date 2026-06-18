export const GLYPH_FAMILIES = [
  "moldura",
  "fonte",
  "canal",
  "elemento_primario",
  "elemento_derivado",
  "acao",
  "forma",
  "defesa",
  "tempo",
  "risco",
  "tinta",
] as const;

export const GLYPH_SEMANTIC_ROLES = [
  "container",
  "source",
  "connector",
  "element",
  "derived",
  "action",
  "form",
  "defense",
  "time",
  "risk",
  "ink",
] as const;

export type GlyphFamily = (typeof GLYPH_FAMILIES)[number];

export type GlyphSemanticRole = (typeof GLYPH_SEMANTIC_ROLES)[number];

export type GlyphPoint = readonly [number, number];

export type GlyphStroke = readonly GlyphPoint[];

export type GlyphStrokes = readonly GlyphStroke[];

export interface GlyphTopologySignature {
  readonly loops: number;
  readonly open_strokes: number;
  readonly dominant_geometry: string;
  readonly closure_required?: number;
  readonly expected_intersections?: number;
  readonly corners_min?: number;
  readonly corners_max?: number;
  readonly requires_exit_marker?: boolean;
  readonly turns_min?: number;
}

export interface GlyphRecognitionConfig {
  readonly method: string;
  readonly min_confidence: number;
  readonly min_semantic_margin: number;
  readonly recommended_recognizers: readonly string[];
  readonly reject_if: readonly string[];
}

export interface GlyphTemplate {
  readonly id: string;
  readonly display_name: string;
  readonly family: GlyphFamily;
  readonly semantic_role: GlyphSemanticRole;
  readonly description: string;
  readonly strokes: GlyphStrokes;
  readonly ports: readonly string[];
  readonly topology_signature: GlyphTopologySignature;
  readonly recognition: GlyphRecognitionConfig;
  readonly tags: readonly string[];
}
