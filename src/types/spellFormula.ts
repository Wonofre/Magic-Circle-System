import type { GlyphSemanticRole } from "@/types/glyphTemplates";
import type { CircleQuality, MandalaSymbolPosition } from "@/types/mandala";
import type { SigilType, SignType } from "@/types/magic";
import type { SpellCardKind, SpellCardTarget } from "@/types/spellCard";

export type SpellEffectArea = "single" | "line" | "cone" | "area" | "self";

export interface FormulaRune {
  readonly templateId: string;
  readonly name: string;
  readonly role: GlyphSemanticRole;
  readonly isDrawn: boolean;
  readonly isDefault: boolean;
  readonly confidence: number;
  readonly position?: MandalaSymbolPosition;
  readonly expectedZoneMatched: boolean;
  readonly element?: SigilType;
  readonly kind?: SpellCardKind;
  readonly status?: string;
  readonly weight: number;
}

export interface SpellFormula {
  readonly version: 1;
  readonly formulaHash: string;
  readonly castHash: string;
  readonly formulaReading: string;
  readonly elements: readonly FormulaRune[];
  readonly actions: readonly FormulaRune[];
  readonly forms: readonly FormulaRune[];
  readonly targets: readonly FormulaRune[];
  readonly modifiers: readonly FormulaRune[];
  readonly allRunes: readonly FormulaRune[];
  readonly circleQuality: CircleQuality;
  readonly complexity: number;
  readonly amplification: number;
  readonly instability: number;
}

export interface SpellEffectProfile {
  readonly element?: SigilType;
  readonly form: SignType;
  readonly area: SpellEffectArea;
  readonly target: SpellCardTarget;
  readonly status?: string;
  readonly damageScale: number;
  readonly healingScale: number;
  readonly shieldScale: number;
  readonly controlScale: number;
  readonly summary: string;
}
