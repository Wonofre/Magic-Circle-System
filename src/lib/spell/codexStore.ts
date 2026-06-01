import { createSpellHash } from "@/lib/recognizer/graphCompiler";
import { activeLegacySigils, activeLegacySigns, defaultKnownRuneTemplateIds } from "@/data/activeRuneCatalog";
import type { SigilType, SignType, Spell } from "@/types/magic";
import type { CodexSpellEntry, GrimoireLoadout } from "@/types/codex";
import type { SpellCard } from "@/types/spellCard";
import type { SemanticRiskLevel } from "@/types/recognition";

const CODEX_STORAGE_KEY = "magic-circle-codex-v1";

const ALL_LEGACY_SIGILS: readonly SigilType[] = [...activeLegacySigils];

const ALL_LEGACY_SIGNS: readonly SignType[] = [...activeLegacySigns];

export const defaultGrimoireLoadout: GrimoireLoadout = {
  knownGlyphIds: defaultKnownRuneTemplateIds,
  discoveredGlyphIds: [],
  masteredGlyphIds: [],
  knownLegacySigils: ALL_LEGACY_SIGILS,
  knownLegacySigns: ALL_LEGACY_SIGNS,
  allowedRecipeIds: [
    "element_emit_projectile_enemy",
    "earth_contain_barrier_self",
    "restore_self_support",
    "improvised_spell_graph",
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

const sortKeys = (values: readonly string[]): readonly string[] => [...values].sort();

const getEntryCodexTemplateIds = (entry: CodexSpellEntry): readonly string[] =>
  entry.codexTemplateIds ?? entry.componentTemplateIds;

export const createLegacySpellHash = (
  sigils: readonly SigilType[],
  signs: readonly SignType[],
): string =>
  createSpellHash(
    JSON.stringify({
      version: 1,
      source: "legacy_magic_system",
      sigils: sortKeys(sigils),
      signs: sortKeys(signs),
    }),
  );

export const isLegacyPatternAllowedByLoadout = (
  sigils: readonly SigilType[],
  signs: readonly SignType[],
  loadout: GrimoireLoadout = defaultGrimoireLoadout,
): boolean => {
  const knownSigils = new Set(loadout.knownLegacySigils);
  const knownSigns = new Set(loadout.knownLegacySigns);

  return sigils.every((sigil) => knownSigils.has(sigil)) &&
    signs.every((sign) => knownSigns.has(sign));
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
    const shouldUnlock = entry.mastery === "discovered" || entry.mastery === "practiced" || entry.mastery === "mastered";
    if (!shouldUnlock) continue;
    getEntryCodexTemplateIds(entry).forEach((id) => ids.add(id));
  }

  return ids;
};

export const getSpellCardRiskLevel = (card: SpellCard): SemanticRiskLevel => {
  if (card.graph.nodes.some((node) => node.semanticRole === "risk" || node.recognitionOutcome === "backfire")) {
    return "high";
  }

  if (
    card.graph.nodes.some((node) =>
      node.semanticRole === "ink" ||
      node.semanticRole === "action" ||
      node.semanticRole === "defense" ||
      node.recognitionOutcome === "cast_weak" ||
      node.recognitionOutcome === "partial",
    )
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

  if (!recipeAllowed) {
    return {
      ok: false,
      missingGlyphIds,
      recipeAllowed,
      riskAllowed,
      riskLevel,
      message: "A receita desta magia nao esta equipada no Codex.",
    };
  }

  if (!riskAllowed) {
    return {
      ok: false,
      missingGlyphIds,
      recipeAllowed,
      riskAllowed,
      riskLevel,
      message: "O risco da formula excede o limite atual do Codex.",
    };
  }

  return {
    ok: true,
    missingGlyphIds,
    recipeAllowed,
    riskAllowed,
    riskLevel,
    message: "Formula permitida pelo Codex.",
  };
};

export const loadCodexEntries = (): readonly CodexSpellEntry[] => {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(CODEX_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
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
    ...existing,
    name: nextEntry.name,
    kind: nextEntry.kind,
    target: nextEntry.target,
    codexTemplateIds: nextEntry.codexTemplateIds ?? existing.codexTemplateIds,
    componentTemplateIds: nextEntry.componentTemplateIds,
    legacySigils: nextEntry.legacySigils ?? existing.legacySigils,
    legacySigns: nextEntry.legacySigns ?? existing.legacySigns,
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

export const recordLegacySpellDiscovery = (
  entries: readonly CodexSpellEntry[],
  spell: Spell,
  precision: number,
  inkCost: number,
): readonly CodexSpellEntry[] => {
  const now = new Date().toISOString();
  const bestPrecision = clampScore(precision);
  const spellHash = createLegacySpellHash(spell.glyphPattern.sigils, spell.glyphPattern.signs);
  const nextEntry: CodexSpellEntry = {
    spellHash,
    name: spell.namePt,
    kind: spell.healing > 0 ? "support" : spell.shield > 0 ? "defense" : "attack",
    target: spell.healing > 0 || spell.shield > 0 ? "self" : "enemy",
    codexTemplateIds: [
      ...spell.glyphPattern.sigils.map((sigil) => `legacy:sigil:${sigil}`),
      ...spell.glyphPattern.signs.map((sign) => `legacy:sign:${sign}`),
    ],
    componentTemplateIds: [
      ...spell.glyphPattern.sigils.map((sigil) => `legacy:sigil:${sigil}`),
      ...spell.glyphPattern.signs.map((sign) => `legacy:sign:${sign}`),
    ],
    legacySigils: spell.glyphPattern.sigils,
    legacySigns: spell.glyphPattern.signs,
    effectSummary: spell.description,
    bestPrecision,
    bestStability: bestPrecision,
    bestPotency: Math.max(spell.damage, spell.healing, spell.shield),
    inkCost,
    discoveredAt: now,
    lastCastAt: now,
    castCount: 1,
    mastery: masteryFromStats(1, bestPrecision),
  };

  return upsertCodexEntry(entries, nextEntry);
};

export const recordSpellCardDiscovery = (
  entries: readonly CodexSpellEntry[],
  card: SpellCard,
): readonly CodexSpellEntry[] => {
  const now = new Date().toISOString();
  const nextEntry: CodexSpellEntry = {
    spellHash: card.id,
    name: card.name,
    kind: card.kind,
    target: card.target,
    codexTemplateIds: card.codexTemplateIds,
    componentTemplateIds: card.codexTemplateIds,
    effectSummary: `${card.kind} spell with ${card.potency} potency.`,
    bestPrecision: card.stability,
    bestStability: card.stability,
    bestPotency: card.potency,
    inkCost: card.inkCost,
    discoveredAt: now,
    lastCastAt: now,
    castCount: 1,
    mastery: masteryFromStats(1, card.stability),
  };

  return upsertCodexEntry(entries, nextEntry);
};
