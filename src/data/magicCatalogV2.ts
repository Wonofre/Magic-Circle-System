import { z } from "zod";

import rawCatalog from "@/data/magicCatalogV2.seed.json";
import type {
  ElementSigilId,
  FutureEffectHintsV2,
  MagicKeyId,
  MagicKeyKind,
} from "@/types/magicFormulaV2";

export const ELEMENT_SIGIL_IDS = [
  "IGNIS",
  "AQUA",
  "TERRA",
  "VENTUS",
  "LUX",
  "UMBRA",
  "VITA",
  "GELU",
  "FULMEN",
  "SANGUIS",
  "MENS",
] as const satisfies readonly ElementSigilId[];

export const MAGIC_KEY_IDS = [
  "PROJECTILE",
  "SPIRAL",
  "PIERCE",
  "FIELD",
  "TRAP",
  "BUBBLE",
  "SHIELD",
  "SUSTAIN",
  "TICK",
  "DISPEL",
  "COUNTER",
  "AMPLIFY",
  "DIFFUSE",
] as const satisfies readonly MagicKeyId[];

const MAGIC_KEY_KINDS = [
  "form",
  "modifier",
  "action",
  "defense_form",
] as const satisfies readonly MagicKeyKind[];

const futureEffectHintsSchema: z.ZodType<FutureEffectHintsV2> = z
  .object({
    damageTypes: z.array(z.string()).optional(),
    statuses: z.array(z.string()).optional(),
    fields: z.array(z.string()).optional(),
    fieldInteractions: z.array(z.string()).optional(),
    defense: z.array(z.string()).optional(),
    support: z.array(z.string()).optional(),
    utility: z.array(z.string()).optional(),
    visualMotifs: z.array(z.string()).optional(),
  })
  .passthrough();

const sigilSchema = z.object({
  id: z.enum(ELEMENT_SIGIL_IDS),
  name: z.string().min(1),
  element: z.string().min(1),
  futureEffectHints: futureEffectHintsSchema.default({}),
});

const keySchema = z.object({
  id: z.enum(MAGIC_KEY_IDS),
  kind: z.enum(MAGIC_KEY_KINDS),
  name: z.string().min(1),
  scopeRule: z.string().optional(),
  requiresCircularChannelForCompound: z.boolean().optional(),
  futureEffectTags: z.array(z.string()).default([]),
});

const catalogSchema = z.object({
  version: z.string(),
  legacyPolicy: z.object({
    runtimeLegacyAllowed: z.literal(false),
    removeCompletely: z.array(z.string()),
  }),
  ontology: z.object({
    coreOrder: z.array(z.string()),
    channelMeaning: z.string(),
    symmetryMeaning: z.string(),
  }),
  sigils: z.array(sigilSchema),
  keys: z.array(keySchema),
  circleRules: z.object({
    castingCircle: z.object({
      required: z.literal(true),
      mustBeOutermost: z.literal(true),
      rejectIfCrossedByInternalStroke: z.literal(true),
      minClosure: z.number(),
      minRoundness: z.number(),
      weightInQuality: z.number(),
    }),
    sigilContainment: z.object({
      required: z.literal(false),
      minClosure: z.number(),
      weightInQuality: z.number(),
    }),
    keyScopeCircle: z.object({
      required: z.literal(false),
      closedMeans: z.string(),
      missingMeans: z.string(),
      openMeans: z.string(),
      minClosure: z.number(),
      weightInQuality: z.number(),
    }),
  }),
  channelRules: z.object({
    keyToKey: z.object({
      requiredGeometry: z.string(),
      minCurvature: z.number(),
      symmetryBonus: z.boolean(),
      straightLinePenalty: z.number(),
    }),
    keyToSigil: z.object({
      requiredGeometry: z.string(),
      straightLineAllowed: z.boolean(),
      straightLinePenalty: z.number(),
    }),
    outerCircleCrossing: z.string(),
    endpointSnapRadiusRatio: z.number(),
  }),
  symmetryScoring: z.object({
    enabled: z.boolean(),
    doesNotOverrideValidity: z.literal(true),
    components: z.object({
      radialBalance: z.number(),
      keyAngularSpacing: z.number(),
      circleConcentricity: z.number(),
      channelArcRegularity: z.number(),
      mirrorBalance: z.number(),
      strokeCleanliness: z.number(),
    }),
    usageNow: z.array(z.string()),
    usageFuture: z.array(z.string()),
  }),
}).superRefine((catalog, context) => {
  const validateExactIds = (
    entries: readonly { readonly id: string }[],
    expectedIds: readonly string[],
    path: "sigils" | "keys",
  ) => {
    const counts = new Map<string, number>();
    entries.forEach((entry) => counts.set(entry.id, (counts.get(entry.id) ?? 0) + 1));

    for (const expectedId of expectedIds) {
      if ((counts.get(expectedId) ?? 0) !== 1) {
        context.addIssue({
          code: "custom",
          message: `${path} must contain exactly one "${expectedId}" entry`,
          path: [path],
        });
      }
    }
  };

  validateExactIds(catalog.sigils, ELEMENT_SIGIL_IDS, "sigils");
  validateExactIds(catalog.keys, MAGIC_KEY_IDS, "keys");
});

export type MagicCatalogV2 = z.infer<typeof catalogSchema>;
export type MagicCatalogSigilV2 = MagicCatalogV2["sigils"][number];
export type MagicCatalogKeyV2 = MagicCatalogV2["keys"][number];

const parseCatalog = (value: unknown): MagicCatalogV2 => {
  const result = catalogSchema.safeParse(value);
  if (!result.success) {
    throw new Error(`Invalid magic catalog v2 seed: ${z.prettifyError(result.error)}`);
  }
  return result.data;
};

export const magicCatalogV2 = parseCatalog(rawCatalog);

export const sigilsById = new Map<ElementSigilId, MagicCatalogSigilV2>(
  magicCatalogV2.sigils.map((sigil) => [sigil.id, sigil]),
);

export const keysById = new Map<MagicKeyId, MagicCatalogKeyV2>(
  magicCatalogV2.keys.map((key) => [key.id, key]),
);

export const getCatalogSigil = (id: ElementSigilId): MagicCatalogSigilV2 => {
  const sigil = sigilsById.get(id);
  if (!sigil) {
    throw new Error(`Unknown magic catalog sigil "${id}".`);
  }
  return sigil;
};

export const getCatalogKey = (id: MagicKeyId): MagicCatalogKeyV2 => {
  const key = keysById.get(id);
  if (!key) {
    throw new Error(`Unknown magic catalog key "${id}".`);
  }
  return key;
};
