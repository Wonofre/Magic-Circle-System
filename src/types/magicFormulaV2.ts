export type ElementSigilId =
  | "IGNIS"
  | "AQUA"
  | "TERRA"
  | "VENTUS"
  | "LUX"
  | "UMBRA"
  | "VITA"
  | "GELU"
  | "FULMEN"
  | "SANGUIS"
  | "MENS";

export type MagicKeyId =
  | "PROJECTILE"
  | "SPIRAL"
  | "PIERCE"
  | "FIELD"
  | "TRAP"
  | "BUBBLE"
  | "SHIELD"
  | "SUSTAIN"
  | "TICK"
  | "DISPEL"
  | "COUNTER"
  | "AMPLIFY"
  | "DIFFUSE";

export type MagicKeyKind = "form" | "modifier" | "action" | "defense_form";
export type CircleRole = "casting_circle" | "sigil_containment" | "key_scope";
export type ChannelKind = "key_to_key" | "key_to_sigil" | "key_to_containment";
export type ChannelGeometry =
  | "straight_radial"
  | "circular_arc"
  | "orbital_arc"
  | "curved_radial"
  | "invalid_straight";
export type FormulaValidity = "valid_visual_formula" | "valid_future_executable" | "partial" | "invalid";
export type KeyScopeV2 = "global" | "local" | "unstable" | "dormant";
export type VisualRankV2 = "fractured" | "rough" | "stable" | "symmetric" | "perfect";

export interface MagicPointV2 {
  readonly x: number;
  readonly y: number;
  readonly t?: number;
}

export interface FutureEffectHintsV2 {
  readonly damageTypes?: readonly string[];
  readonly statuses?: readonly string[];
  readonly fields?: readonly string[];
  readonly fieldInteractions?: readonly string[];
  readonly defense?: readonly string[];
  readonly support?: readonly string[];
  readonly utility?: readonly string[];
  readonly visualMotifs?: readonly string[];
}

export interface CircleInstanceV2 {
  readonly id: string;
  readonly role: CircleRole;
  readonly center: MagicPointV2;
  readonly radius: number;
  readonly closure: number;
  readonly roundness: number;
  readonly smoothness: number;
  readonly concentricity: number;
  readonly quality: number;
  readonly strokeIds: readonly string[];
}

export interface SigilInstanceV2 {
  readonly id: string;
  readonly sigilId: ElementSigilId;
  readonly templateId: string;
  readonly confidence: number;
  readonly closure: number;
  readonly isClosed: boolean;
  readonly center: MagicPointV2;
  readonly containedByCircleId?: string;
  readonly futureEffectHints: FutureEffectHintsV2;
}

export interface KeyInstanceV2 {
  readonly id: string;
  readonly keyId: MagicKeyId;
  readonly templateId: string;
  readonly kind: MagicKeyKind;
  readonly confidence: number;
  readonly center: MagicPointV2;
  readonly containedByCircleId?: string;
  readonly scope: KeyScopeV2;
  readonly futureEffectTags: readonly string[];
}

export interface ChannelInstanceV2 {
  readonly id: string;
  readonly kind: ChannelKind;
  readonly fromId: string;
  readonly toId: string;
  readonly geometry: ChannelGeometry;
  readonly arcCenter?: MagicPointV2;
  readonly arcRadius?: number;
  readonly curvatureScore: number;
  readonly endpointSnapScore: number;
  readonly symmetryScore: number;
  readonly crossesCastingCircle: boolean;
  readonly quality: number;
  readonly strokeIds: readonly string[];
}

export interface MandalaSymmetryScoreV2 {
  readonly radialBalance: number;
  readonly keyAngularSpacing: number;
  readonly circleConcentricity: number;
  readonly channelArcRegularity: number;
  readonly mirrorBalance: number;
  readonly strokeCleanliness: number;
  readonly overall: number;
}

export interface FormulaIssueV2 {
  readonly code: string;
  readonly message: string;
  readonly severity: "info" | "warning" | "error";
}

export type FormulaGraphNodeKindV2 = "circle" | "sigil" | "key";

export interface FormulaGraphNodeV2 {
  readonly id: string;
  readonly kind: FormulaGraphNodeKindV2;
  readonly label: string;
  readonly templateId?: string;
  readonly sigilId?: ElementSigilId;
  readonly keyId?: MagicKeyId;
  readonly circleRole?: CircleRole;
  readonly scope?: KeyScopeV2;
  readonly center: MagicPointV2;
  readonly confidence: number;
}

export interface FormulaGraphEdgeV2 {
  readonly id: string;
  readonly kind: ChannelKind;
  readonly fromId: string;
  readonly toId: string;
  readonly geometry: ChannelGeometry;
  readonly quality: number;
}

export interface FormulaGraphV2 {
  readonly version: 2;
  readonly nodes: readonly FormulaGraphNodeV2[];
  readonly edges: readonly FormulaGraphEdgeV2[];
  readonly formulaHash: string;
  readonly canonicalShape: string;
}

export interface SpellVisualV2 {
  readonly elementColor: string;
  readonly accentColor: string;
  readonly motif: string;
  readonly rank: VisualRankV2;
  readonly glow: number;
  readonly cleanliness: number;
  readonly orbitalChannelCount: number;
  readonly instability: number;
}

export interface MagicFormulaV2 {
  readonly version: 2;
  readonly castingCircle?: CircleInstanceV2;
  readonly sigilContainment?: CircleInstanceV2;
  readonly keyScopeCircles: readonly CircleInstanceV2[];
  readonly sigils: readonly SigilInstanceV2[];
  readonly keys: readonly KeyInstanceV2[];
  readonly channels: readonly ChannelInstanceV2[];
  readonly globalKeyIds: readonly MagicKeyId[];
  readonly localApplications: readonly {
    readonly keyInstanceId: string;
    readonly appliesToId: string;
    readonly channelId?: string;
  }[];
  readonly compoundKeys: readonly {
    readonly fromKeyInstanceId: string;
    readonly toKeyInstanceId: string;
    readonly channelId: string;
  }[];
  readonly symmetry: MandalaSymmetryScoreV2;
  readonly validity: FormulaValidity;
  readonly issues: readonly FormulaIssueV2[];
  readonly formulaHash: string;
  readonly visualHash: string;
  readonly name: string;
  readonly visual: SpellVisualV2;
  readonly sourceTemplateIds: readonly string[];
}
