import type { GlyphSemanticRole } from "@/types/glyphTemplates";
import type { SigilType, SignType } from "@/types/magic";
import type { SpellCardKind } from "@/types/spellCard";

export type MagicRuneZone = "frame" | "core" | "inner" | "middle" | "outer" | "orbital";

export interface MagicRuneDefinition {
  readonly id: string;
  readonly templateId: string;
  readonly legacySigil?: SigilType;
  readonly legacySigns?: readonly SignType[];
  readonly name: string;
  readonly role: GlyphSemanticRole;
  readonly active: boolean;
  readonly playerDrawable: boolean;
  readonly enemyDrawable: boolean;
  readonly knownByDefault: boolean;
  readonly canBeDefaulted: boolean;
  readonly codexDiscoverable: boolean;
  readonly expectedZones: readonly MagicRuneZone[];
  readonly gameplay?: {
    readonly element?: SigilType;
    readonly kind?: SpellCardKind;
    readonly basePower?: number;
    readonly status?: string;
  };
}

const commonRune = {
  active: true,
  playerDrawable: true,
  enemyDrawable: true,
  codexDiscoverable: true,
  canBeDefaulted: false,
} as const;

export const magicRunes: readonly MagicRuneDefinition[] = [
  {
    ...commonRune,
    id: "FRAME_CIRCLE_CONTAINMENT",
    templateId: "FRAME_CIRCLE_CONTAINMENT",
    name: "Circulo de Contencao",
    role: "container",
    knownByDefault: true,
    expectedZones: ["frame"],
  },
  {
    ...commonRune,
    id: "FRAME_DOUBLE_SEAL",
    templateId: "FRAME_DOUBLE_SEAL",
    name: "Duplo Circulo de Selamento",
    role: "container",
    knownByDefault: false,
    expectedZones: ["frame"],
  },
  {
    ...commonRune,
    id: "SOURCE_DOT",
    templateId: "SOURCE_DOT",
    name: "Ponto de Fonte",
    role: "source",
    knownByDefault: true,
    canBeDefaulted: true,
    expectedZones: ["core"],
  },
  {
    ...commonRune,
    id: "SOURCE_DOUBLE",
    templateId: "SOURCE_DOUBLE",
    name: "Nascente Dupla",
    role: "source",
    knownByDefault: false,
    expectedZones: ["core"],
  },
  {
    ...commonRune,
    id: "ELEMENT_IGNIS",
    templateId: "ELEMENT_IGNIS",
    legacySigil: "fire",
    name: "Ignis",
    role: "element",
    knownByDefault: true,
    expectedZones: ["core", "inner"],
    gameplay: { element: "fire", kind: "attack", basePower: 20, status: "burn" },
  },
  {
    ...commonRune,
    id: "ELEMENT_AQUA",
    templateId: "ELEMENT_AQUA",
    legacySigil: "water",
    name: "Aqua",
    role: "element",
    knownByDefault: true,
    expectedZones: ["core", "inner"],
    gameplay: { element: "water", kind: "control", basePower: 16, status: "wet" },
  },
  {
    ...commonRune,
    id: "ELEMENT_TERRA",
    templateId: "ELEMENT_TERRA",
    legacySigil: "earth",
    name: "Terra",
    role: "element",
    knownByDefault: true,
    expectedZones: ["core", "inner"],
    gameplay: { element: "earth", kind: "defense", basePower: 18 },
  },
  {
    ...commonRune,
    id: "ELEMENT_VENTUS",
    templateId: "ELEMENT_VENTUS",
    legacySigil: "wind",
    name: "Ventus",
    role: "element",
    knownByDefault: true,
    expectedZones: ["core", "inner"],
    gameplay: { element: "wind", kind: "utility", basePower: 15 },
  },
  {
    ...commonRune,
    id: "ELEMENT_LUX",
    templateId: "ELEMENT_LUX",
    legacySigil: "light",
    name: "Lux",
    role: "element",
    knownByDefault: true,
    expectedZones: ["core", "inner"],
    gameplay: { element: "light", kind: "attack", basePower: 18 },
  },
  {
    ...commonRune,
    id: "ELEMENT_UMBRA",
    templateId: "ELEMENT_UMBRA",
    legacySigil: "shadow",
    name: "Umbra",
    role: "element",
    knownByDefault: true,
    expectedZones: ["core", "inner"],
    gameplay: { element: "shadow", kind: "control", basePower: 18, status: "cursed" },
  },
  {
    ...commonRune,
    id: "ELEMENT_VITA",
    templateId: "ELEMENT_VITA",
    legacySigil: "nature",
    name: "Vita",
    role: "element",
    knownByDefault: true,
    expectedZones: ["core", "inner"],
    gameplay: { element: "nature", kind: "support", basePower: 16, status: "rooted" },
  },
  {
    ...commonRune,
    id: "ELEMENT_MENS",
    templateId: "ELEMENT_MENS",
    name: "Mens",
    role: "element",
    knownByDefault: true,
    expectedZones: ["core", "inner"],
    gameplay: { kind: "control", basePower: 16 },
  },
  {
    ...commonRune,
    id: "DERIVED_GELU",
    templateId: "DERIVED_GELU",
    legacySigil: "ice",
    name: "Gelu",
    role: "derived",
    knownByDefault: true,
    expectedZones: ["inner", "middle"],
    gameplay: { element: "ice", kind: "control", basePower: 18, status: "frozen" },
  },
  {
    ...commonRune,
    id: "DERIVED_FULMEN",
    templateId: "DERIVED_FULMEN",
    legacySigil: "thunder",
    name: "Fulmen",
    role: "derived",
    knownByDefault: true,
    expectedZones: ["inner", "middle"],
    gameplay: { element: "thunder", kind: "attack", basePower: 22, status: "stun" },
  },
  {
    ...commonRune,
    id: "ACTION_EMIT",
    templateId: "ACTION_EMIT",
    legacySigns: ["column", "rain", "dispersion", "weave", "crush", "explosion", "levitation", "direction", "bolt", "enlarge", "bird", "spiral"],
    name: "Emitir",
    role: "action",
    knownByDefault: true,
    canBeDefaulted: true,
    expectedZones: ["middle", "outer"],
  },
  {
    ...commonRune,
    id: "ACTION_CONTAIN",
    templateId: "ACTION_CONTAIN",
    legacySigns: ["shield_sign", "float", "billowing", "reflect", "anchor"],
    name: "Conter",
    role: "action",
    knownByDefault: true,
    expectedZones: ["middle", "outer"],
  },
  {
    ...commonRune,
    id: "ACTION_RESTORE",
    templateId: "ACTION_RESTORE",
    legacySigns: ["heal_sign"],
    name: "Restaurar",
    role: "action",
    knownByDefault: true,
    expectedZones: ["middle", "outer"],
  },
  {
    ...commonRune,
    id: "ACTION_SEAL",
    templateId: "ACTION_SEAL",
    legacySigns: ["chain", "pull", "convergence", "collection"],
    name: "Selar",
    role: "action",
    knownByDefault: true,
    expectedZones: ["middle", "outer"],
  },
  {
    ...commonRune,
    id: "FORM_PROJECTILE",
    templateId: "FORM_PROJECTILE",
    legacySigns: ["levitation", "direction", "bolt", "enlarge", "bird", "spiral", "crush", "explosion"],
    name: "Projetil",
    role: "form",
    knownByDefault: true,
    canBeDefaulted: true,
    expectedZones: ["middle", "outer"],
  },
  {
    ...commonRune,
    id: "FORM_BEAM",
    templateId: "FORM_BEAM",
    legacySigns: ["column"],
    name: "Raio",
    role: "form",
    knownByDefault: true,
    expectedZones: ["middle", "outer"],
  },
  {
    ...commonRune,
    id: "FORM_AURA",
    templateId: "FORM_AURA",
    legacySigns: ["heal_sign"],
    name: "Aura",
    role: "form",
    knownByDefault: true,
    expectedZones: ["middle", "outer"],
  },
  {
    ...commonRune,
    id: "FORM_WAVE",
    templateId: "FORM_WAVE",
    legacySigns: ["dispersion", "weave"],
    name: "Onda",
    role: "form",
    knownByDefault: true,
    expectedZones: ["middle", "outer"],
  },
  {
    ...commonRune,
    id: "FORM_CHAIN",
    templateId: "FORM_CHAIN",
    legacySigns: ["chain", "pull", "convergence", "collection"],
    name: "Corrente",
    role: "form",
    knownByDefault: true,
    expectedZones: ["middle", "outer"],
  },
  {
    ...commonRune,
    id: "FORM_RAIN",
    templateId: "FORM_RAIN",
    legacySigns: ["rain"],
    name: "Chuva",
    role: "form",
    knownByDefault: true,
    expectedZones: ["middle", "outer"],
  },
  {
    ...commonRune,
    id: "DEFENSE_SHIELD",
    templateId: "DEFENSE_SHIELD",
    legacySigns: ["shield_sign", "float", "billowing", "reflect", "anchor"],
    name: "Escudo",
    role: "defense",
    knownByDefault: true,
    expectedZones: ["middle", "outer"],
    gameplay: { kind: "defense", basePower: 16 },
  },
  {
    ...commonRune,
    id: "TARGET_ENEMY",
    templateId: "TARGET_ENEMY",
    legacySigns: ["column", "rain", "dispersion", "weave", "crush", "explosion", "levitation", "direction", "bolt", "enlarge", "bird", "spiral", "chain", "pull", "convergence", "collection"],
    name: "Inimigo",
    role: "target",
    knownByDefault: true,
    canBeDefaulted: true,
    expectedZones: ["outer", "orbital"],
  },
  {
    ...commonRune,
    id: "TARGET_SELF",
    templateId: "TARGET_SELF",
    legacySigns: ["heal_sign", "shield_sign", "float", "billowing", "reflect", "anchor"],
    name: "Autoalvo",
    role: "target",
    knownByDefault: true,
    expectedZones: ["outer", "orbital"],
  },
  {
    ...commonRune,
    id: "RISK_BACKFLOW",
    templateId: "RISK_BACKFLOW",
    legacySigns: ["crush", "explosion"],
    name: "Retorno de Fluxo",
    role: "risk",
    knownByDefault: false,
    expectedZones: ["outer", "orbital"],
    gameplay: { kind: "attack", status: "backflow" },
  },
] as const;

const runesByTemplateId = new Map(magicRunes.map((rune) => [rune.templateId, rune]));
const runesByLegacySigil = new Map(
  magicRunes
    .filter((rune): rune is MagicRuneDefinition & { readonly legacySigil: SigilType } => Boolean(rune.legacySigil))
    .map((rune) => [rune.legacySigil, rune]),
);

export const activeRuneDefinitions = magicRunes.filter((rune) => rune.active);

export const playerDrawableRuneDefinitions = activeRuneDefinitions.filter((rune) => rune.playerDrawable);

export const enemyDrawableRuneDefinitions = activeRuneDefinitions.filter((rune) => rune.enemyDrawable);

export const knownByDefaultRuneDefinitions = activeRuneDefinitions.filter((rune) => rune.knownByDefault);

export const getRuneByTemplateId = (templateId: string): MagicRuneDefinition | undefined =>
  runesByTemplateId.get(templateId);

export const getRuneByLegacySigil = (sigil: SigilType): MagicRuneDefinition | undefined =>
  runesByLegacySigil.get(sigil);

export const getTemplateIdForLegacySigil = (sigil: SigilType): string | undefined =>
  getRuneByLegacySigil(sigil)?.templateId;

export const getLegacySigilForTemplateId = (templateId: string): SigilType | undefined =>
  getRuneByTemplateId(templateId)?.legacySigil;

export const getDefaultableTemplateIds = (): readonly string[] =>
  activeRuneDefinitions
    .filter((rune) => rune.canBeDefaulted)
    .map((rune) => rune.templateId);

export const canTemplateBeDefaulted = (templateId: string): boolean =>
  getRuneByTemplateId(templateId)?.canBeDefaulted === true;

export const getCodexDiscoverableTemplateIds = (): readonly string[] =>
  activeRuneDefinitions
    .filter((rune) => rune.codexDiscoverable)
    .map((rune) => rune.templateId);

export const getKnownByDefaultTemplateIds = (): readonly string[] =>
  knownByDefaultRuneDefinitions.map((rune) => rune.templateId);

export const getTemplateIdsForLegacySign = (sign: SignType): readonly string[] =>
  activeRuneDefinitions
    .filter((rune) => rune.legacySigns?.includes(sign))
    .map((rune) => rune.templateId);
