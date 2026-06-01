import type { GlyphSemanticRole } from "@/types/glyphTemplates";

export type MandalaDocumentSource = "freehand" | "codex" | "enemy" | "debug-editor";

export type MandalaSymbolZone = "core" | "inner" | "middle" | "outer" | "orbital" | "frame";

export interface CircleQuality {
  readonly closure: number;
  readonly roundness: number;
  readonly centeredness: number;
  readonly smoothness: number;
  readonly overall: number;
}

export interface MandalaSymbolPosition {
  readonly angle: number;
  readonly radius: number;
  readonly zone: MandalaSymbolZone;
}

export interface MandalaSymbol {
  readonly id: string;
  readonly templateId: string;
  readonly role: GlyphSemanticRole;
  readonly isDrawn: boolean;
  readonly isDefault: boolean;
  readonly sourceStrokeIds: readonly string[];
  readonly confidence: number;
  readonly position?: MandalaSymbolPosition;
}

export interface MandalaDocument {
  readonly version: 1;
  readonly source: MandalaDocumentSource;
  readonly circleQuality: CircleQuality;
  readonly symbols: readonly MandalaSymbol[];
  readonly formulaReading: string;
  readonly mandalaHash: string;
}
