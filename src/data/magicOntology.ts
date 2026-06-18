import { z } from "zod";

import { getGlyphById } from "@/data/glyphTemplates";
import {
  ELEMENT_SIGIL_IDS,
  getCatalogKey,
  getCatalogSigil,
  MAGIC_KEY_IDS,
  magicCatalogV2,
} from "@/data/magicCatalogV2";
import rawRuneManifest from "@/data/magicRunesV2.seed.json";
import type { GlyphSemanticRole } from "@/types/glyphTemplates";
import type { ElementSigilId, MagicKeyId, MagicKeyKind } from "@/types/magicFormulaV2";

export const MAGIC_RUNE_ZONES = [
  "frame",
  "core",
  "inner",
  "middle",
  "outer",
  "orbital",
] as const;

export type MagicRuneZone = (typeof MAGIC_RUNE_ZONES)[number];

export type MagicRuneV2Binding =
  | {
      readonly type: "casting_circle";
    }
  | {
      readonly type: "sigil";
      readonly sigilId: ElementSigilId;
    }
  | {
      readonly type: "key";
      readonly keyId: MagicKeyId;
      readonly keyKind: MagicKeyKind;
    };

export interface MagicRuneDefinition {
  readonly id: string;
  readonly templateId: string;
  readonly name: string;
  readonly role: GlyphSemanticRole;
  readonly active: boolean;
  readonly playerDrawable: boolean;
  readonly enemyDrawable: boolean;
  readonly knownByDefault: boolean;
  readonly canBeDefaulted: boolean;
  readonly codexDiscoverable: boolean;
  readonly expectedZones: readonly MagicRuneZone[];
  readonly binding: MagicRuneV2Binding;
}

const runeFlagsSchema = z.object({
  active: z.boolean(),
  playerDrawable: z.boolean(),
  enemyDrawable: z.boolean(),
  knownByDefault: z.boolean(),
  canBeDefaulted: z.boolean(),
  codexDiscoverable: z.boolean(),
}).strict();

const runeBindingSeedSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("casting_circle") }).strict(),
  z.object({
    type: z.literal("sigil"),
    sigilId: z.enum(ELEMENT_SIGIL_IDS),
  }).strict(),
  z.object({
    type: z.literal("key"),
    keyId: z.enum(MAGIC_KEY_IDS),
  }).strict(),
]);

const runeSeedSchema = z.object({
  templateId: z.string().min(1),
  binding: runeBindingSeedSchema,
  expectedZones: z.array(z.enum(MAGIC_RUNE_ZONES)).min(1),
  active: z.boolean().optional(),
  playerDrawable: z.boolean().optional(),
  enemyDrawable: z.boolean().optional(),
  knownByDefault: z.boolean().optional(),
  canBeDefaulted: z.boolean().optional(),
  codexDiscoverable: z.boolean().optional(),
}).strict();

const runeManifestSchema = z.object({
  schemaVersion: z.literal(1),
  catalogVersion: z.string().min(1),
  defaults: runeFlagsSchema,
  unknownNegativeTemplateIds: z.array(z.string().min(1)),
  runes: z.array(runeSeedSchema).min(1),
}).strict().superRefine((manifest, context) => {
  const seenTemplateIds = new Set<string>();
  manifest.runes.forEach((rune, index) => {
    if (seenTemplateIds.has(rune.templateId)) {
      context.addIssue({
        code: "custom",
        message: `duplicate rune template "${rune.templateId}"`,
        path: ["runes", index, "templateId"],
      });
    }
    seenTemplateIds.add(rune.templateId);
  });

  const seenNegativeIds = new Set<string>();
  manifest.unknownNegativeTemplateIds.forEach((templateId, index) => {
    if (seenNegativeIds.has(templateId)) {
      context.addIssue({
        code: "custom",
        message: `duplicate UNKNOWN negative template "${templateId}"`,
        path: ["unknownNegativeTemplateIds", index],
      });
    }
    seenNegativeIds.add(templateId);
  });
});

const manifestResult = runeManifestSchema.safeParse(rawRuneManifest);
if (!manifestResult.success) {
  throw new Error(`Invalid magic rune manifest: ${z.prettifyError(manifestResult.error)}`);
}

export const magicRuneManifest = manifestResult.data;
export const magicRuneCatalogVersion = magicRuneManifest.catalogVersion;
export const unknownNegativeTemplateIds = magicRuneManifest.unknownNegativeTemplateIds;

if (magicRuneCatalogVersion !== magicCatalogV2.version) {
  throw new Error(
    `Rune manifest catalog version ${magicRuneCatalogVersion} does not match magic catalog ${magicCatalogV2.version}.`,
  );
}

const sigilRoles = new Set<GlyphSemanticRole>(["element", "derived"]);
const keyRoles = new Set<GlyphSemanticRole>(["action", "form", "defense", "time", "risk"]);

const buildRuneDefinition = (
  seed: (typeof magicRuneManifest.runes)[number],
): MagicRuneDefinition => {
  const glyph = getGlyphById(seed.templateId);
  if (!glyph) {
    throw new Error(`Rune manifest references missing glyph template "${seed.templateId}".`);
  }

  let binding: MagicRuneV2Binding;
  if (seed.binding.type === "casting_circle") {
    if (glyph.semantic_role !== "container") {
      throw new Error(`Casting circle "${seed.templateId}" must use a container template.`);
    }
    binding = seed.binding;
  } else if (seed.binding.type === "sigil") {
    getCatalogSigil(seed.binding.sigilId);
    if (!sigilRoles.has(glyph.semantic_role)) {
      throw new Error(`Sigil "${seed.templateId}" must use an element or derived template.`);
    }
    binding = seed.binding;
  } else {
    const key = getCatalogKey(seed.binding.keyId);
    if (!keyRoles.has(glyph.semantic_role)) {
      throw new Error(`Key "${seed.templateId}" uses unsupported role "${glyph.semantic_role}".`);
    }
    binding = {
      ...seed.binding,
      keyKind: key.kind,
    };
  }

  return {
    ...magicRuneManifest.defaults,
    ...seed,
    id: seed.templateId,
    name: glyph.display_name,
    role: glyph.semantic_role,
    binding,
  };
};

export const magicRunes: readonly MagicRuneDefinition[] =
  magicRuneManifest.runes.map(buildRuneDefinition);

for (const templateId of unknownNegativeTemplateIds) {
  if (!getGlyphById(templateId)) {
    throw new Error(`UNKNOWN negative references missing glyph template "${templateId}".`);
  }
}

const runesByTemplateId = new Map(magicRunes.map((rune) => [rune.templateId, rune]));

export const activeRuneDefinitions = magicRunes.filter((rune) => rune.active);

export const playerDrawableRuneDefinitions = activeRuneDefinitions.filter((rune) => rune.playerDrawable);

export const enemyDrawableRuneDefinitions = activeRuneDefinitions.filter((rune) => rune.enemyDrawable);

export const knownByDefaultRuneDefinitions = activeRuneDefinitions.filter((rune) => rune.knownByDefault);

export const activeRuneTemplateIds = activeRuneDefinitions.map((rune) => rune.templateId);

export const defaultKnownRuneTemplateIds = knownByDefaultRuneDefinitions.map((rune) => rune.templateId);

export const getRuneByTemplateId = (templateId: string): MagicRuneDefinition | undefined =>
  runesByTemplateId.get(templateId);

export const getV2BindingForTemplateId = (templateId: string): MagicRuneV2Binding | undefined =>
  getRuneByTemplateId(templateId)?.binding;

export const getElementSigilForTemplateId = (templateId: string): ElementSigilId | undefined => {
  const binding = getV2BindingForTemplateId(templateId);
  return binding?.type === "sigil" ? binding.sigilId : undefined;
};

export const getMagicKeyForTemplateId = (templateId: string): MagicKeyId | undefined => {
  const binding = getV2BindingForTemplateId(templateId);
  return binding?.type === "key" ? binding.keyId : undefined;
};

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
