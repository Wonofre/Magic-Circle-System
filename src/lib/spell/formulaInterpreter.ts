import { getRuneByTemplateId } from "@/data/magicOntology";
import type { MandalaDocument, MandalaSymbolZone } from "@/types/mandala";
import type { FormulaRune, SpellFormula } from "@/types/spellFormula";

const ROLE_GROUPS = {
  elements: new Set(["element", "derived"]),
  actions: new Set(["action"]),
  forms: new Set(["form", "defense"]),
  targets: new Set(["target"]),
  modifiers: new Set(["connector", "time", "risk", "ink", "source", "container"]),
} as const;

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const zoneWeight = (matched: boolean, zone?: MandalaSymbolZone): number => {
  if (!zone) return 0.95;
  if (matched) return zone === "orbital" ? 1.12 : 1;
  return 0.76;
};

const makeFormulaRune = (symbol: MandalaDocument["symbols"][number]): FormulaRune => {
  const rune = getRuneByTemplateId(symbol.templateId);
  const expectedZoneMatched =
    !symbol.position || rune?.expectedZones.includes(symbol.position.zone) !== false;
  const confidence = clamp(symbol.confidence, 0, 1);
  const defaultPenalty = symbol.isDefault ? 0.82 : 1;
  const weight = confidence * zoneWeight(expectedZoneMatched, symbol.position?.zone) * defaultPenalty;

  return {
    templateId: symbol.templateId,
    name: rune?.name ?? symbol.templateId,
    role: symbol.role,
    isDrawn: symbol.isDrawn,
    isDefault: symbol.isDefault,
    confidence,
    position: symbol.position,
    expectedZoneMatched,
    element: rune?.gameplay?.element,
    kind: rune?.gameplay?.kind,
    status: rune?.gameplay?.status,
    weight: Number(clamp(weight, 0.2, 1.25).toFixed(3)),
  };
};

const countRepeats = (runes: readonly FormulaRune[]): number => {
  const counts = new Map<string, number>();
  for (const rune of runes) {
    counts.set(rune.templateId, (counts.get(rune.templateId) ?? 0) + 1);
  }
  return [...counts.values()].reduce((sum, count) => sum + Math.max(0, count - 1), 0);
};

export const interpretMandalaFormula = (mandala: MandalaDocument): SpellFormula => {
  const allRunes = mandala.symbols.map(makeFormulaRune);
  const elements = allRunes.filter((rune) => ROLE_GROUPS.elements.has(rune.role));
  const actions = allRunes.filter((rune) => ROLE_GROUPS.actions.has(rune.role));
  const forms = allRunes.filter((rune) => ROLE_GROUPS.forms.has(rune.role));
  const targets = allRunes.filter((rune) => ROLE_GROUPS.targets.has(rune.role));
  const modifiers = allRunes.filter((rune) => ROLE_GROUPS.modifiers.has(rune.role));
  const drawnRunes = allRunes.filter((rune) => rune.isDrawn);
  const repeatCount = countRepeats(allRunes);
  const orbitalCount = allRunes.filter((rune) => rune.position?.zone === "orbital").length;
  const misplacedCount = allRunes.filter((rune) => !rune.expectedZoneMatched).length;
  const defaultCount = allRunes.filter((rune) => rune.isDefault).length;
  const averageConfidence =
    allRunes.reduce((sum, rune) => sum + rune.confidence, 0) / Math.max(1, allRunes.length);
  const circleInstability = 100 - mandala.circleQuality.overall;
  const instability = clamp(
    circleInstability * 0.62 +
      (1 - averageConfidence) * 28 +
      misplacedCount * 8 +
      defaultCount * 2.5,
    0,
    100,
  );
  const complexity = clamp(
    drawnRunes.length +
      Math.max(0, elements.length - 1) * 1.5 +
      forms.length +
      modifiers.filter((rune) => rune.role === "risk" || rune.role === "ink").length * 1.25,
    1,
    20,
  );
  const amplification = Number(
    clamp(1 + repeatCount * 0.12 + orbitalCount * 0.08 + (mandala.circleQuality.overall - 70) / 250, 0.65, 1.85)
      .toFixed(3),
  );

  return {
    version: 1,
    formulaHash: mandala.formulaHash,
    castHash: mandala.castHash,
    formulaReading: mandala.formulaReading,
    elements,
    actions,
    forms,
    targets,
    modifiers,
    allRunes,
    circleQuality: mandala.circleQuality,
    complexity: Number(complexity.toFixed(2)),
    amplification,
    instability: Math.round(instability),
  };
};
