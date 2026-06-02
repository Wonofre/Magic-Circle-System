import type { SigilType, SignType } from "@/types/magic";
import type { SpellCardKind, SpellCardTarget } from "@/types/spellCard";
import type { FormulaRune, SpellEffectArea, SpellEffectProfile, SpellFormula } from "@/types/spellFormula";

const FORM_TO_SIGN: Readonly<Record<string, SignType>> = {
  FORM_PROJECTILE: "direction",
  FORM_BEAM: "column",
  FORM_RAIN: "rain",
  FORM_AURA: "heal_sign",
  FORM_CHAIN: "chain",
  FORM_WAVE: "dispersion",
  DEFENSE_SHIELD: "shield_sign",
};

const FORM_TO_AREA: Readonly<Record<string, SpellEffectArea>> = {
  FORM_PROJECTILE: "single",
  FORM_BEAM: "line",
  FORM_RAIN: "area",
  FORM_AURA: "self",
  FORM_CHAIN: "single",
  FORM_WAVE: "cone",
  DEFENSE_SHIELD: "self",
};

const getPrimary = (runes: readonly FormulaRune[]): FormulaRune | undefined =>
  [...runes].sort((a, b) => b.weight - a.weight)[0];

const getPrimaryForm = (formula: SpellFormula): FormulaRune | undefined =>
  formula.forms.find((rune) => rune.templateId === "DEFENSE_SHIELD") ??
  getPrimary(formula.forms);

const getTarget = (kind: SpellCardKind, form: FormulaRune | undefined, formula: SpellFormula): SpellCardTarget => {
  if (kind === "defense" || kind === "support") return "self";
  if (formula.targets.some((rune) => rune.templateId === "TARGET_SELF")) return "self";
  if (form?.templateId === "FORM_RAIN" || form?.templateId === "FORM_WAVE") return "area";
  return "default_enemy";
};

const getArea = (target: SpellCardTarget, form: FormulaRune | undefined): SpellEffectArea => {
  if (target === "self") return "self";
  return FORM_TO_AREA[form?.templateId ?? "FORM_PROJECTILE"] ?? "single";
};

const getFormSign = (form: FormulaRune | undefined): SignType =>
  FORM_TO_SIGN[form?.templateId ?? "FORM_PROJECTILE"] ?? "direction";

const inferKind = (
  formula: SpellFormula,
  element: FormulaRune | undefined,
  form: FormulaRune | undefined,
): SpellCardKind => {
  if (form?.templateId === "DEFENSE_SHIELD") return "defense";
  if (formula.actions.some((rune) => rune.templateId === "ACTION_RESTORE")) return "support";
  if (form?.templateId === "FORM_AURA" && (element?.templateId === "ELEMENT_VITA" || element?.kind === "support")) {
    return "support";
  }
  if (
    form?.templateId === "FORM_CHAIN" ||
    element?.kind === "control" ||
    formula.actions.some((rune) => rune.templateId === "ACTION_SEAL")
  ) {
    return "control";
  }
  return element?.kind === "defense" ? "defense" : "attack";
};

const fallbackElement = (element: FormulaRune | undefined): SigilType | undefined =>
  element?.element ?? (element?.templateId === "ELEMENT_MENS" ? "shadow" : undefined);

const getSummary = (
  kind: SpellCardKind,
  area: SpellEffectArea,
  form: FormulaRune | undefined,
  element: FormulaRune | undefined,
  status: string | undefined,
): string => {
  const shape = form?.name ?? "Projetil";
  const force = element?.name ?? "arcana";
  const statusText = status ? ` com ${status}` : "";
  if (kind === "defense") return `${shape} defensivo de ${force}${statusText}.`;
  if (kind === "support") return `${shape} de suporte de ${force}${statusText}.`;
  if (kind === "control") return `${shape} de controle de ${force} em ${area}${statusText}.`;
  return `${shape} ofensivo de ${force} em ${area}${statusText}.`;
};

export const synthesizeSpellEffectProfile = (formula: SpellFormula): SpellEffectProfile => {
  const element = getPrimary(formula.elements);
  const form = getPrimaryForm(formula);
  const kind = inferKind(formula, element, form);
  const target = getTarget(kind, form, formula);
  const area = getArea(target, form);
  const status = form?.templateId === "FORM_CHAIN"
    ? element?.status ?? "stun"
    : form?.templateId === "FORM_WAVE"
      ? element?.status ?? "slow"
      : element?.status;
  const areaDamageScale = area === "area" ? 0.78 : area === "cone" ? 0.86 : area === "line" ? 0.94 : 1;

  return {
    element: fallbackElement(element),
    form: getFormSign(form),
    area,
    target,
    status,
    damageScale: kind === "attack" ? areaDamageScale : kind === "control" ? 0.58 * areaDamageScale : 0,
    healingScale: kind === "support" ? (area === "self" ? 0.74 : 0.52) : 0,
    shieldScale: kind === "defense" ? 0.88 : 0,
    controlScale: kind === "control" ? 1 : status ? 0.35 : 0,
    summary: getSummary(kind, area, form, element, status),
  };
};

export const inferSpellKindFromEffect = (profile: SpellEffectProfile): SpellCardKind => {
  if (profile.shieldScale > 0) return "defense";
  if (profile.healingScale > 0) return "support";
  if (profile.controlScale >= 0.75) return "control";
  return "attack";
};
