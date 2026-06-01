import type { GlyphFamily, GlyphSemanticRole, GlyphTemplate } from "@/types/glyphTemplates";
import type { RecognitionOutcome } from "@/types/recognition";

export type SpellGraphNodeKind =
  | "frame"
  | "source"
  | "connector"
  | "element"
  | "action"
  | "form"
  | "target"
  | "defense"
  | "time"
  | "risk"
  | "ink"
  | "default_target";

export interface SpellGraphNode {
  readonly id: string;
  readonly kind: SpellGraphNodeKind;
  readonly templateId: string;
  readonly displayName: string;
  readonly family: GlyphFamily | "default";
  readonly semanticRole: GlyphSemanticRole | "default_target";
  readonly ports: readonly string[];
  readonly confidence?: number;
  readonly recognitionOutcome?: RecognitionOutcome;
}

export interface SpellGraphEdge {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly fromPort: string;
  readonly toPort: string;
}

export interface SpellGraph {
  readonly version: 1;
  readonly nodes: readonly SpellGraphNode[];
  readonly edges: readonly SpellGraphEdge[];
  readonly spellHash: string;
  readonly canonicalShape: string;
}

export interface SpellGraphCompileIssue {
  readonly code: string;
  readonly message: string;
  readonly severity: "error" | "warning";
}

export interface SpellGraphGlyphInput {
  readonly template: GlyphTemplate;
  readonly confidence?: number;
  readonly recognitionOutcome?: RecognitionOutcome;
}

export interface SpellGraphCompileOptions {
  readonly addDefaultTarget?: boolean;
}

export type SpellGraphCompileResult =
  | {
      readonly ok: true;
      readonly graph: SpellGraph;
      readonly issues: readonly SpellGraphCompileIssue[];
    }
  | {
      readonly ok: false;
      readonly graph: null;
      readonly issues: readonly SpellGraphCompileIssue[];
    };
