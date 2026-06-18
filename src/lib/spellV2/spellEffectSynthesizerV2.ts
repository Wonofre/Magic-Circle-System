import type { SpellCardKind } from "@/types/spellCard";
import type { SpellEffectProfile } from "@/types/spellFormula";
import type { MagicFormulaV2, MagicKeyId } from "@/types/magicFormulaV2";
import type { BattlefieldEffect, StatusEffect } from "@/types/magic";

const hasKey = (formula: MagicFormulaV2, keyId: MagicKeyId): boolean =>
  formula.keys.some((key) => key.keyId === keyId && key.scope !== "dormant");

export const inferSpellKindFromFormulaV2 = (formula: MagicFormulaV2): SpellCardKind => {
  if (formula.sigils[0]?.sigilId === "VITA") return "support";
  if (hasKey(formula, "SHIELD") || hasKey(formula, "BUBBLE")) return "defense";
  if (hasKey(formula, "DISPEL") || hasKey(formula, "COUNTER")) return "utility";
  if (
    hasKey(formula, "FIELD") ||
    hasKey(formula, "TRAP") ||
    formula.sourceTemplateIds.includes("FORM_CHAIN")
  ) return "control";
  if (hasKey(formula, "PROJECTILE") || hasKey(formula, "PIERCE")) return "attack";
  return "attack";
};

const primaryForm = (formula: MagicFormulaV2): MagicKeyId => {
  const preferred = ["PROJECTILE", "FIELD", "TRAP", "BUBBLE", "SHIELD", "DISPEL", "COUNTER", "SPIRAL", "PIERCE"] as const;
  return preferred.find((keyId) => hasKey(formula, keyId)) ?? formula.keys[0]?.keyId ?? "PROJECTILE";
};

const statusTypeFromHint = (hint: string): StatusEffect["type"] | null => {
  if (hint === "burn") return "burn";
  if (hint === "wet") return "wet";
  if (hint === "stun") return "stun";
  if (hint === "slow") return "slow";
  if (hint === "freeze") return "frozen";
  if (hint === "blind" || hint === "blind_dark") return "blinded";
  if (hint === "reveal") return "revealed";
  if (hint === "bleeding_ticks") return "bleeding";
  if (hint === "confusion" || hint === "vision_distortion") return "confused";
  if (hint === "cleanse_minor") return "regeneration";
  return null;
};

const fieldTypeFromFormula = (formula: MagicFormulaV2): BattlefieldEffect["type"] | null => {
  if (hasKey(formula, "TRAP")) return "trap_zone";
  const sigilId = formula.sigils[0]?.sigilId;
  if (!sigilId && !hasKey(formula, "FIELD")) return null;
  if (sigilId === "IGNIS") return "ignited";
  if (sigilId === "AQUA") return "rain";
  if (sigilId === "TERRA") return "stonewall";
  if (sigilId === "VENTUS") return "gust";
  if (sigilId === "LUX") return "revelation";
  if (sigilId === "UMBRA") return "shadow_veil";
  if (sigilId === "VITA") return "life_surge";
  if (sigilId === "GELU") return "frozen_ground";
  if (sigilId === "FULMEN") return "storm_charge";
  if (sigilId === "SANGUIS") return "blood_mark";
  if (sigilId === "MENS") return "mind_haze";
  return null;
};

const synthesizeStatuses = (formula: MagicFormulaV2, quality: number): readonly StatusEffect[] => {
  const hints = formula.sigils[0]?.futureEffectHints.statuses ?? [];
  const durationBonus = (hasKey(formula, "SUSTAIN") ? 1 : 0) + (hasKey(formula, "TICK") ? 2 : 0);
  const potencyBonus = (hasKey(formula, "AMPLIFY") ? 1 : 0) + (hasKey(formula, "SPIRAL") ? 0.5 : 0);
  const duration = Math.max(1, Math.round(2 + durationBonus + quality * 2));
  const potency = Math.max(1, Math.round(2 + potencyBonus + quality * 4));
  const statuses = hints
    .map(statusTypeFromHint)
    .filter((type): type is StatusEffect["type"] => Boolean(type))
    .map((type): StatusEffect => ({
      type,
      duration: type === "stun" ? 1 : duration,
      potency: type === "wet" || type === "revealed" ? Math.max(1, Math.round(potency * 0.55)) : potency,
    }));

  const createsBinding =
    hasKey(formula, "TRAP") ||
    formula.sourceTemplateIds.includes("ACTION_SEAL") ||
    formula.sourceTemplateIds.includes("FORM_CHAIN");

  if (createsBinding && !statuses.some((status) => status.type === "rooted")) {
    return [...statuses, { type: "rooted", duration: Math.max(1, duration - 1), potency }];
  }

  return statuses;
};

const synthesizeField = (formula: MagicFormulaV2, quality: number): BattlefieldEffect | undefined => {
  const type = fieldTypeFromFormula(formula);
  const shouldCreateField = hasKey(formula, "FIELD") || hasKey(formula, "TRAP") || hasKey(formula, "DIFFUSE");
  if (!type || !shouldCreateField) return undefined;

  return {
    id: `${formula.formulaHash}:field`,
    type,
    element: formula.sigils[0]?.sigilId ?? null,
    duration: Math.max(2, Math.round(2 + quality * 3 + (hasKey(formula, "SUSTAIN") ? 2 : 0))),
    potency: Math.max(1, Math.round(3 + quality * 6 + (hasKey(formula, "AMPLIFY") ? 2 : 0))),
  };
};

export const synthesizeSpellEffectProfileV2 = (formula: MagicFormulaV2): SpellEffectProfile => {
  const kind = inferSpellKindFromFormulaV2(formula);
  const form = primaryForm(formula);
  const area =
    kind === "defense" || kind === "support"
      ? "self"
      : hasKey(formula, "FIELD") || hasKey(formula, "TRAP") || hasKey(formula, "DIFFUSE")
        ? "area"
        : hasKey(formula, "PIERCE")
          ? "line"
          : "single";
  const hints = formula.sigils[0]?.futureEffectHints ?? {};
  const quality = formula.validity === "invalid" ? 0 : formula.symmetry.overall;
  const statusEffects = kind === "defense" ? [] : synthesizeStatuses(formula, quality);
  const fieldEffect = synthesizeField(formula, quality);
  const amplify = hasKey(formula, "AMPLIFY") ? 1.18 : 1;
  const diffuse = hasKey(formula, "DIFFUSE") ? 0.84 : 1;
  const shieldBypassRatio = Math.min(
    0.8,
    (hasKey(formula, "PIERCE") ? 0.35 : 0) +
      (hasKey(formula, "SPIRAL") ? 0.18 : 0) +
      (formula.sigils[0]?.sigilId === "FULMEN" ? 0.08 : 0),
  );
  const dispelPower =
    hasKey(formula, "DISPEL") || hasKey(formula, "COUNTER")
      ? Math.max(3, Math.round(6 + quality * 8 + (hasKey(formula, "AMPLIFY") ? 3 : 0)))
      : 0;
  const healingScale =
    formula.sigils[0]?.sigilId === "VITA"
      ? 0.42 + quality * 0.26 + (hasKey(formula, "SUSTAIN") ? 0.12 : 0)
      : 0;
  const shieldScale = kind === "defense" ? (0.56 + quality * 0.28) * amplify : 0;
  const damageScale =
    kind === "attack"
      ? (0.72 + quality * 0.24) * amplify * diffuse
      : kind === "control"
        ? (0.2 + quality * 0.12) * diffuse
        : 0;
  const controlScale =
    kind === "control"
      ? (0.62 + quality * 0.22) * amplify
      : statusEffects.length > 0 || fieldEffect
        ? 0.28 + quality * 0.2
        : 0;
  const statusSummary = statusEffects.length > 0
    ? ` status ${statusEffects.map((status) => status.type).join("/")}`
    : "";
  const fieldSummary = fieldEffect ? ` campo ${fieldEffect.type}` : "";
  const defenseSummary = shieldBypassRatio > 0 ? ` perfura ${Math.round(shieldBypassRatio * 100)}% do escudo` : "";
  const dispelSummary = dispelPower > 0 ? ` dissipa ${dispelPower}` : "";

  return {
    element: formula.sigils[0]?.sigilId,
    form,
    area,
    futureEffectHints: hints,
    damageScale,
    healingScale,
    shieldScale,
    controlScale,
    statusEffects,
    fieldEffect,
    shieldBypassRatio,
    dispelPower,
    summary: `Formula visual ${formula.visual.rank};${statusSummary}${fieldSummary}${defenseSummary}${dispelSummary}.`,
  };
};
