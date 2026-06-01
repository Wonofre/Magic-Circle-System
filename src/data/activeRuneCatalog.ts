import {
  activeRuneDefinitions,
  getKnownByDefaultTemplateIds,
  getTemplateIdsForLegacySign,
  type MagicRuneDefinition,
} from "@/data/magicOntology";
import type { SigilType, SignType } from "@/types/magic";

export interface ActiveRuneDisplayEntry {
  readonly templateId: string;
  readonly name: string;
  readonly role: MagicRuneDefinition["role"];
  readonly legacySigil?: SigilType;
}

export const activeRuneTemplateIds: readonly string[] =
  activeRuneDefinitions.map((rune) => rune.templateId);

export const defaultKnownRuneTemplateIds: readonly string[] = getKnownByDefaultTemplateIds();

export const activeLegacySigils: readonly SigilType[] =
  activeRuneDefinitions
    .map((rune) => rune.legacySigil)
    .filter((sigil): sigil is SigilType => Boolean(sigil));

export const activeLegacySigns: readonly SignType[] = [
  "column",
  "dispersion",
  "levitation",
  "direction",
  "convergence",
  "bolt",
  "rain",
  "enlarge",
  "bird",
  "weave",
  "pull",
  "crush",
  "collection",
  "billowing",
  "float",
  "shield_sign",
  "heal_sign",
  "reflect",
  "chain",
  "explosion",
  "spiral",
  "anchor",
];

export const activeRuneDisplayEntries: readonly ActiveRuneDisplayEntry[] =
  activeRuneDefinitions.map((rune) => ({
    templateId: rune.templateId,
    name: rune.name,
    role: rune.role,
    legacySigil: rune.legacySigil,
  }));

export const getTemplateIdsForActiveLegacySign = (sign: SignType): readonly string[] =>
  getTemplateIdsForLegacySign(sign);
