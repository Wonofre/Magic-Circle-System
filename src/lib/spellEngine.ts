import type { BattlefieldEffect, Entity, SpellEffect, StatusEffect } from "@/types/magic";
import type { ElementSigilId, MagicFormulaV2 } from "@/types/magicFormulaV2";
import { DEFAULT_ENEMY_INK } from "@/lib/spell/inkSimulator";

export const ELEMENTAL_ADVANTAGE: Record<ElementSigilId, readonly ElementSigilId[]> = {
  IGNIS: ["GELU", "VITA"],
  AQUA: ["IGNIS", "TERRA"],
  TERRA: ["FULMEN", "VENTUS"],
  VENTUS: ["AQUA", "UMBRA"],
  LUX: ["UMBRA", "MENS"],
  UMBRA: ["LUX", "VITA"],
  VITA: ["UMBRA", "SANGUIS"],
  GELU: ["AQUA", "VENTUS"],
  FULMEN: ["AQUA", "VENTUS"],
  SANGUIS: ["VITA", "MENS"],
  MENS: ["IGNIS", "FULMEN"],
};

export function getWeaknessMultiplier(
  attacker: ElementSigilId,
  defenderWeakness: ElementSigilId | null,
): number {
  if (!defenderWeakness) return 1;
  if (attacker === defenderWeakness) return 1.55;
  if (ELEMENTAL_ADVANTAGE[attacker]?.includes(defenderWeakness)) return 1.25;
  return 1;
}

export interface CastResult {
  spellName: string;
  description: string;
  damage: number;
  healing: number;
  shield: number;
  effects: SpellEffect[];
  statusEffects: StatusEffect[];
  fieldEffect?: BattlefieldEffect;
  shieldBypassRatio: number;
  dispelPower: number;
  accuracy: number;
  precision: number;
  isSuccess: boolean;
  feedback: string;
  elementalMultiplier: number;
  inkCost: number;
  inkRemaining?: number;
  inkOverloadChance?: number;
  formula?: MagicFormulaV2;
}

const ENEMY_ARCHETYPES: readonly {
  readonly name: string;
  readonly element: ElementSigilId;
  readonly weakness: ElementSigilId;
  readonly resistance: ElementSigilId;
}[] = [
  { name: "Aprendiz de Cinzas", element: "IGNIS", weakness: "AQUA", resistance: "GELU" },
  { name: "Cartografa da Chuva", element: "AQUA", weakness: "FULMEN", resistance: "IGNIS" },
  { name: "Guardiao Terreo", element: "TERRA", weakness: "VENTUS", resistance: "FULMEN" },
  { name: "Tecela de Sombras", element: "UMBRA", weakness: "LUX", resistance: "MENS" },
  { name: "Oraculista Fulmen", element: "FULMEN", weakness: "TERRA", resistance: "AQUA" },
  { name: "Sentinela Gelu", element: "GELU", weakness: "IGNIS", resistance: "AQUA" },
];

export function generateEnemy(round: number): Entity {
  const archetype = ENEMY_ARCHETYPES[(round - 1) % ENEMY_ARCHETYPES.length];
  const hp = 42 + round * 9;
  const ink = DEFAULT_ENEMY_INK;

  return {
    id: `enemy-${round}`,
    name: `${archetype.name} ${round}`,
    hp,
    maxHp: hp,
    shield: 0,
    ink: ink.ink + Math.min(6, Math.floor(round / 2)),
    maxInk: ink.maxInk + Math.min(6, Math.floor(round / 2)),
    inkRegenPerTurn: ink.inkRegenPerTurn,
    inkPurity: ink.inkPurity,
    inkViscosity: ink.inkViscosity,
    inkVolatility: ink.inkVolatility,
    inkAffinity: archetype.element,
    activeInfusionIds: [],
    element: archetype.element,
    weakness: archetype.weakness,
    resistance: archetype.resistance,
    status: [] as StatusEffect[],
    isPlayer: false,
  };
}
