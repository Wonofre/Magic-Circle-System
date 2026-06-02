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
  ...new Set(activeRuneDefinitions.flatMap((rune) => rune.legacySigns ?? [])),
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
