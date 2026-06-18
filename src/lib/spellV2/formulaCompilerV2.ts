import { calculateMandalaSymmetryScoreV2 } from "@/lib/geometry/symmetryScore";
import { getPathLength } from "@/lib/geometry/circleFit";
import { resolveSpellNameV2 } from "@/lib/spellV2/spellNameResolverV2";
import { synthesizeSpellVisualV2 } from "@/lib/spellV2/spellVisualSynthesizerV2";
import { magicCatalogV2 } from "@/data/magicCatalogV2";
import type { ParsedMandalaV2 } from "@/lib/recognizerV2/mandalaParserV2";
import type {
  FormulaIssueV2,
  FormulaValidity,
  KeyInstanceV2,
  MagicFormulaV2,
  MagicKeyId,
} from "@/types/magicFormulaV2";

const clamp = (value: number, min = 0, max = 1): number =>
  Math.max(min, Math.min(max, value));

const createHash = (prefix: string, value: unknown): string => {
  const text = JSON.stringify(value);
  let hash = 0x811c9dc5;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return `${prefix}_${(hash >>> 0).toString(16).padStart(8, "0")}`;
};

const issue = (
  code: string,
  message: string,
  severity: FormulaIssueV2["severity"] = "error",
): FormulaIssueV2 => ({ code, message, severity });

const connectedKeyIds = (parsed: ParsedMandalaV2): ReadonlySet<string> =>
  new Set(
    parsed.channels.flatMap((channel) => [channel.fromId, channel.toId].filter((id) => id.startsWith("key:"))),
  );

const applyDormantScopes = (parsed: ParsedMandalaV2): readonly KeyInstanceV2[] => {
  const connected = connectedKeyIds(parsed);
  return parsed.keys.map((key) => {
    if (!key.containedByCircleId) return key;
    if (connected.has(key.id)) return key;
    return { ...key, scope: "dormant" };
  });
};

const collectIssues = (
  formula: Pick<MagicFormulaV2, "castingCircle" | "sigils" | "keys" | "channels">,
): readonly FormulaIssueV2[] => {
  const issues: FormulaIssueV2[] = [];
  const castingRule = magicCatalogV2.circleRules.castingCircle;

  if (!formula.castingCircle) {
    issues.push(issue("missing_casting_circle", "A formula precisa de um circulo externo de conjuracao."));
  } else {
    if (formula.castingCircle.closure < castingRule.minClosure) {
      issues.push(issue("casting_circle_open", "O circulo externo esta aberto demais."));
    }
    if (formula.castingCircle.roundness < castingRule.minRoundness) {
      issues.push(issue("casting_circle_irregular", "O circulo externo nao esta redondo o suficiente.", "warning"));
    }
  }

  if (formula.sigils.length === 0) {
    issues.push(issue("missing_central_sigil", "A formula precisa de pelo menos um sigilo central."));
  }

  if (formula.keys.length === 0) {
    issues.push(issue("missing_key", "A formula precisa de pelo menos uma chave para nome e visual completos.", "warning"));
  }

  formula.keys
    .filter((key) => key.scope === "dormant")
    .forEach((key) => {
      issues.push(issue("dormant_key", `A chave ${key.keyId} esta contida, mas nao possui canal.`, "warning"));
    });

  formula.channels.forEach((channel) => {
    if (channel.crossesCastingCircle) {
      issues.push(issue("channel_crosses_casting_circle", "Um canal cruza ou vaza para fora do circulo externo."));
    }
    if (channel.kind === "key_to_key" && channel.geometry === "invalid_straight") {
      issues.push(issue("straight_key_channel", "Canal entre chaves deve ser circular ou orbital."));
    }
  });

  return issues;
};

const validityFromIssues = (
  issues: readonly FormulaIssueV2[],
  parsed: ParsedMandalaV2,
): FormulaValidity => {
  if (issues.some((entry) => entry.severity === "error")) return "invalid";
  if (parsed.castingCircle && parsed.sigils.length > 0 && parsed.keys.length > 0) return "valid_visual_formula";
  return "partial";
};

const getStrokeCleanliness = (parsed: ParsedMandalaV2): number => {
  const ratios = parsed.strokes.map((stroke) => {
    const points = stroke.points;
    if (points.length < 2) return 0;
    const path = getPathLength(points);
    const first = points[0];
    const last = points[points.length - 1];
    const chord = first && last ? Math.hypot(last.x - first.x, last.y - first.y) : 0;
    return clamp(chord / Math.max(1, path), 0.18, 1);
  });
  if (ratios.length === 0) return 0;
  return clamp(ratios.reduce((sum, value) => sum + value, 0) / ratios.length + 0.18);
};

const sourceTemplateIds = (parsed: ParsedMandalaV2): readonly string[] => [
  ...new Set([
    ...parsed.sigils.map((sigil) => sigil.templateId),
    ...parsed.keys.map((key) => key.templateId),
  ]),
];

const compileShape = (
  formula: Pick<
    MagicFormulaV2,
    | "castingCircle"
    | "sigils"
    | "keys"
    | "channels"
    | "globalKeyIds"
    | "localApplications"
    | "compoundKeys"
    | "symmetry"
    | "validity"
  >,
) => ({
  version: 2,
  castingCircle: formula.castingCircle
    ? {
        closure: formula.castingCircle.closure,
        roundness: formula.castingCircle.roundness,
        radius: Math.round(formula.castingCircle.radius),
      }
    : null,
  sigils: formula.sigils.map((sigil) => sigil.sigilId),
  keys: formula.keys.map((key) => ({ keyId: key.keyId, scope: key.scope })),
  channels: formula.channels.map((channel) => ({
    kind: channel.kind,
    from: channel.fromId,
    to: channel.toId,
    geometry: channel.geometry,
  })),
  globalKeyIds: formula.globalKeyIds,
  localApplications: formula.localApplications,
  compoundKeys: formula.compoundKeys,
  symmetry: formula.symmetry.overall,
  validity: formula.validity,
});

export const compileMagicFormulaV2 = (parsed: ParsedMandalaV2): MagicFormulaV2 => {
  const keys = applyDormantScopes(parsed);
  const center = parsed.castingCircle?.center ?? parsed.sigils[0]?.center ?? { x: 50, y: 50 };
  const circles = [
    ...(parsed.castingCircle ? [parsed.castingCircle] : []),
    ...(parsed.sigilContainment ? [parsed.sigilContainment] : []),
    ...parsed.keyScopeCircles,
  ];
  const symmetry = calculateMandalaSymmetryScoreV2({
    keys,
    circles,
    channels: parsed.channels,
    center,
    strokeCleanliness: getStrokeCleanliness(parsed),
  });
  const globalKeyIds = [
    ...new Set(
      keys
        .filter((key) => key.scope === "global")
        .map((key) => key.keyId),
    ),
  ] as readonly MagicKeyId[];
  const localApplications = parsed.channels
    .filter((channel) => channel.kind === "key_to_sigil" || channel.kind === "key_to_containment")
    .flatMap((channel) => {
      const keyId = [channel.fromId, channel.toId].find((id) => id.startsWith("key:"));
      const appliesToId = [channel.fromId, channel.toId].find((id) => !id.startsWith("key:"));
      return keyId && appliesToId ? [{ keyInstanceId: keyId, appliesToId, channelId: channel.id }] : [];
    });
  const compoundKeys = parsed.channels
    .filter((channel) => channel.kind === "key_to_key")
    .map((channel) => ({
      fromKeyInstanceId: channel.fromId,
      toKeyInstanceId: channel.toId,
      channelId: channel.id,
    }));
  const incompleteFormula = {
    version: 2 as const,
    castingCircle: parsed.castingCircle,
    sigilContainment: parsed.sigilContainment,
    keyScopeCircles: parsed.keyScopeCircles,
    sigils: parsed.sigils,
    keys,
    channels: parsed.channels,
    globalKeyIds,
    localApplications,
    compoundKeys,
    symmetry,
    validity: "partial" as FormulaValidity,
    issues: [] as readonly FormulaIssueV2[],
    formulaHash: "",
    visualHash: "",
    name: "",
    visual: {
      elementColor: "#d8b56a",
      accentColor: "#ffe6a6",
      motif: "mandala",
      rank: "rough" as const,
      glow: 0.3,
      cleanliness: symmetry.strokeCleanliness,
      orbitalChannelCount: 0,
      instability: 1 - symmetry.overall,
    },
    sourceTemplateIds: sourceTemplateIds(parsed),
  };
  const issues = collectIssues(incompleteFormula);
  const validity = validityFromIssues(issues, parsed);
  const formulaForVisual = { ...incompleteFormula, issues, validity };
  const visual = synthesizeSpellVisualV2(formulaForVisual);
  const formulaHash = createHash("formula_v2", compileShape(formulaForVisual));
  const visualHash = createHash("visual_v2", {
    formulaHash,
    visual,
    channels: parsed.channels.map((channel) => [channel.kind, channel.geometry, channel.quality]),
  });
  const formula: MagicFormulaV2 = {
    ...formulaForVisual,
    formulaHash,
    visualHash,
    visual,
    name: "",
  };

  return {
    ...formula,
    name: resolveSpellNameV2(formula),
  };
};
