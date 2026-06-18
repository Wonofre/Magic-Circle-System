import { defaultKnownRuneTemplateIds } from "@/data/magicOntology";
import type { CodexSpellEntry, GrimoireLoadout } from "@/types/codex";
import type { SpellCard } from "@/types/spellCard";
import type { SemanticRiskLevel } from "@/types/recognition";

const CODEX_STORAGE_KEY = "magic-circle-codex-v2";

export const defaultGrimoireLoadout: GrimoireLoadout = {
  knownGlyphIds: defaultKnownRuneTemplateIds,
  discoveredGlyphIds: [],
  masteredGlyphIds: [],
  allowedRecipeIds: [
    "projectile_visual_formula",
    "field_visual_formula",
    "shield_visual_formula",
    "improvised_formula_v2",
  ],
  allowedInkInfusionIds: [],
  maxRiskLevel: "medium",
};

const RISK_RANK: Record<SemanticRiskLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

const clampScore = (value: number): number => Math.max(0, Math.min(100, Math.round(value)));

const masteryFromStats = (castCount: number, bestPrecision: number): CodexSpellEntry["mastery"] => {
  if (castCount >= 5 && bestPrecision >= 88) return "mastered";
  if (castCount >= 2 || bestPrecision >= 72) return "practiced";
  return "discovered";
};

const getEntryCodexTemplateIds = (entry: CodexSpellEntry): readonly string[] =>
  entry.codexTemplateIds ?? entry.drawnTemplateIds ?? entry.componentTemplateIds;

const withoutLegacyTarget = <T extends object>(value: T): T => {
  const cleaned = { ...value } as T & Record<string, unknown>;
  delete cleaned.target;
  return cleaned;
};

export const getAllowedGlyphIds = (
  loadout: GrimoireLoadout = defaultGrimoireLoadout,
  entries: readonly CodexSpellEntry[] = [],
): ReadonlySet<string> => {
  const ids = new Set<string>([
    ...loadout.knownGlyphIds,
    ...loadout.discoveredGlyphIds,
    ...loadout.masteredGlyphIds,
  ]);

  for (const entry of entries) {
    const shouldUnlock =
      entry.mastery === "discovered" ||
      entry.mastery === "practiced" ||
      entry.mastery === "mastered";
    if (!shouldUnlock) continue;
    getEntryCodexTemplateIds(entry).forEach((id) => ids.add(id));
  }

  return ids;
};

export const getSpellCardRiskLevel = (card: SpellCard): SemanticRiskLevel => {
  if (
    card.formula.validity === "invalid" ||
    card.formula.symmetry.overall < 0.34 ||
    card.formula.channels.some((channel) => channel.crossesCastingCircle)
  ) {
    return "high";
  }

  if (
    card.formula.validity === "partial" ||
    card.formula.symmetry.overall < 0.58 ||
    card.formula.issues.some((entry) => entry.severity === "warning") ||
    card.recognitionOutcome === "cast_weak" ||
    card.recognitionOutcome === "partial"
  ) {
    return "medium";
  }

  return "low";
};

export interface SpellCardLoadoutValidation {
  readonly ok: boolean;
  readonly missingGlyphIds: readonly string[];
  readonly recipeAllowed: boolean;
  readonly riskAllowed: boolean;
  readonly riskLevel: SemanticRiskLevel;
  readonly message: string;
}

export const validateSpellCardForLoadout = (
  card: SpellCard,
  loadout: GrimoireLoadout = defaultGrimoireLoadout,
  entries: readonly CodexSpellEntry[] = [],
): SpellCardLoadoutValidation => {
  const allowedGlyphIds = getAllowedGlyphIds(loadout, entries);
  const missingGlyphIds = card.codexTemplateIds.filter((id) => !allowedGlyphIds.has(id));
  const recipeAllowed = loadout.allowedRecipeIds.includes(card.recipeId);
  const riskLevel = getSpellCardRiskLevel(card);
  const riskAllowed = RISK_RANK[riskLevel] <= RISK_RANK[loadout.maxRiskLevel];

  if (missingGlyphIds.length > 0) {
    return {
      ok: false,
      missingGlyphIds,
      recipeAllowed,
      riskAllowed,
      riskLevel,
      message: `O Codex ainda nao conhece ${missingGlyphIds.length} glifo(s) desta formula.`,
    };
  }

  if (!riskAllowed) {
    return {
      ok: false,
      missingGlyphIds,
      recipeAllowed,
      riskAllowed,
      riskLevel,
      message: "O risco visual da formula excede o limite atual do Codex.",
    };
  }

  return {
    ok: true,
    missingGlyphIds,
    recipeAllowed,
    riskAllowed,
    riskLevel,
    message: "Formula v2 permitida pelo Codex.",
  };
};

export const loadCodexEntries = (): readonly CodexSpellEntry[] => {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(CODEX_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed)
        ? parsed.map((entry) => withoutLegacyTarget(entry as CodexSpellEntry))
        : [];
    }
    return [];
  } catch {
    return [];
  }
};

export const saveCodexEntries = (entries: readonly CodexSpellEntry[]): void => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CODEX_STORAGE_KEY, JSON.stringify(entries));
};

const upsertCodexEntry = (
  entries: readonly CodexSpellEntry[],
  nextEntry: CodexSpellEntry,
): readonly CodexSpellEntry[] => {
  const existing = entries.find((entry) => entry.spellHash === nextEntry.spellHash);

  if (!existing) {
    return [nextEntry, ...entries];
  }

  const bestPrecision = Math.max(existing.bestPrecision, nextEntry.bestPrecision);
  const castCount = existing.castCount + 1;
  const merged: CodexSpellEntry = {
    ...withoutLegacyTarget(existing),
    name: nextEntry.name,
    kind: nextEntry.kind,
    codexTemplateIds: nextEntry.codexTemplateIds ?? existing.codexTemplateIds,
    drawnTemplateIds: nextEntry.drawnTemplateIds ?? existing.drawnTemplateIds,
    defaultedTemplateIds: nextEntry.defaultedTemplateIds ?? existing.defaultedTemplateIds,
    componentTemplateIds: nextEntry.componentTemplateIds,
    formulaHash: nextEntry.formulaHash ?? existing.formulaHash,
    visualHash: nextEntry.visualHash ?? existing.visualHash,
    formulaV2: nextEntry.formulaV2 ?? existing.formulaV2,
    effectSummary: nextEntry.effectSummary,
    bestPrecision,
    bestStability: Math.max(existing.bestStability, nextEntry.bestStability),
    bestPotency: Math.max(existing.bestPotency, nextEntry.bestPotency),
    inkCost: Math.min(existing.inkCost, nextEntry.inkCost),
    lastCastAt: nextEntry.lastCastAt,
    castCount,
    mastery: masteryFromStats(castCount, bestPrecision),
  };

  return [merged, ...entries.filter((entry) => entry.spellHash !== nextEntry.spellHash)];
};

export const recordSpellCardDiscovery = (
  entries: readonly CodexSpellEntry[],
  card: SpellCard,
): readonly CodexSpellEntry[] => {
  const now = new Date().toISOString();
  const bestPrecision = clampScore(card.stability);
  const nextEntry: CodexSpellEntry = {
    spellHash: card.id,
    name: card.name,
    kind: card.kind,
    codexTemplateIds: card.codexTemplateIds,
    drawnTemplateIds: card.drawnTemplateIds,
    defaultedTemplateIds: card.defaultedTemplateIds,
    componentTemplateIds: card.componentTemplateIds,
    formulaHash: card.formula.formulaHash,
    visualHash: card.formula.visualHash,
    formulaV2: card.formulaV2,
    effectSummary: card.effectSummary,
    bestPrecision,
    bestStability: bestPrecision,
    bestPotency: card.potency,
    inkCost: card.inkCost,
    discoveredAt: now,
    lastCastAt: now,
    castCount: 1,
    mastery: masteryFromStats(1, bestPrecision),
  };

  return upsertCodexEntry(entries, nextEntry);
};
