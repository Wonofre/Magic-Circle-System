import { getCatalogKey, getCatalogSigil } from "@/data/magicCatalogV2";
import type { KeyInstanceV2, MagicFormulaV2, MagicKeyId } from "@/types/magicFormulaV2";

const FORM_NAME: Partial<Record<MagicKeyId, string>> = {
  PROJECTILE: "Projetil",
  FIELD: "Campo",
  TRAP: "Armadilha",
  BUBBLE: "Bolha",
  SHIELD: "Escudo",
  DISPEL: "Dissipacao",
  COUNTER: "Anulacao",
};

const MODIFIER_NAME: Partial<Record<MagicKeyId, string>> = {
  SPIRAL: "Espiral",
  PIERCE: "Perfurante",
  SUSTAIN: "Sustentado",
  TICK: "Pulsante",
  AMPLIFY: "Amplificado",
  DIFFUSE: "Difuso",
};

const EPITHET_BY_SCORE = [
  { min: 0.9, label: "Perfeita" },
  { min: 0.78, label: "Simetrica" },
  { min: 0.62, label: "Estavel" },
  { min: 0.42, label: "Irregular" },
] as const;

const keyPriority = (key: KeyInstanceV2): number => {
  if (key.kind === "form" || key.kind === "defense_form") return 0;
  if (key.kind === "action") return 1;
  if (key.kind === "modifier") return 2;
  return 3;
};

const primaryShape = (keys: readonly KeyInstanceV2[]): KeyInstanceV2 | undefined =>
  [...keys].sort((a, b) => keyPriority(a) - keyPriority(b) || b.confidence - a.confidence)[0];

const modifierText = (keys: readonly KeyInstanceV2[], primary?: KeyInstanceV2): string => {
  const modifiers = keys
    .filter((key) => key.id !== primary?.id && key.keyId !== primary?.keyId)
    .map((key) => MODIFIER_NAME[key.keyId] ?? getCatalogKey(key.keyId).name)
    .filter((name, index, values) => values.indexOf(name) === index)
    .slice(0, 3);

  return modifiers.join(" ");
};

const epithet = (formula: MagicFormulaV2): string => {
  if (formula.validity === "invalid") return "Fraturada";
  return EPITHET_BY_SCORE.find((entry) => formula.symmetry.overall >= entry.min)?.label ?? "Bruta";
};

export const resolveSpellNameV2 = (formula: MagicFormulaV2): string => {
  const sigil = formula.sigils[0];
  const elementName = sigil ? getCatalogSigil(sigil.sigilId).name : "Arcana";
  const primary = primaryShape(formula.keys);
  const shape = primary
    ? FORM_NAME[primary.keyId] ?? getCatalogKey(primary.keyId).name
    : "Mandala";
  const modifiers = modifierText(formula.keys, primary);
  const quality = epithet(formula);

  return `${shape}${modifiers ? ` ${modifiers}` : ""} de ${elementName} ${quality}`;
};
