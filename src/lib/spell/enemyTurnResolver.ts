import {
  calculateFinalCastPrecision,
  resolveSpellCardCast,
} from "@/lib/spell/combatResolver";
import {
  controlStatusTypes,
  dispelStatuses,
  mergeStatusEffects,
  scaleBattlefieldEffectByFactor,
  scaleStatusEffectsByFactor,
  statusEffectLabel,
} from "@/lib/spell/combatEntityUtils";
import { chooseEnemySpellPlan, type EnemySpellPlan } from "@/lib/spell/enemySpellAI";
import {
  calculateSpellCardInkCost,
  getInkReservoir,
  simulateInkSpend,
  spendInk,
} from "@/lib/spell/inkSimulator";
import { compileSpellFromStrokesSync } from "@/lib/spell/spellCompiler";
import type { BattlefieldEffect, Entity } from "@/types/magic";

export type EnemyTurnOutcomeKind = "advance" | "defeat" | "skip";

export interface EnemyTurnResolution {
  readonly logs: readonly string[];
  readonly plan: EnemySpellPlan | null;
  readonly enemy: Entity;
  readonly player: Entity;
  readonly battlefieldEffects: readonly BattlefieldEffect[];
  readonly outcome: EnemyTurnOutcomeKind;
  readonly playerHpDamage: number;
}

export interface ResolveEnemyTurnInput {
  readonly enemy: Entity;
  readonly player: Entity;
  readonly battlefieldEffects: readonly BattlefieldEffect[];
  readonly turn: number;
}

const upsertBattlefieldEffect = (
  effects: readonly BattlefieldEffect[],
  nextEffect: BattlefieldEffect,
): BattlefieldEffect[] => [
  nextEffect,
  ...effects.filter((effect) => effect.id !== nextEffect.id),
].slice(0, 4);

export const resolveEnemyTurn = ({
  enemy,
  player,
  battlefieldEffects,
  turn,
}: ResolveEnemyTurnInput): EnemyTurnResolution => {
  const logs: string[] = [];
  let nextEnemy = enemy;
  let nextPlayer = player;
  let nextBattlefieldEffects = [...battlefieldEffects];

  const controlPenalty = enemy.status.some((status) => controlStatusTypes.has(status.type)) ? 0.65 : 1;
  const fieldPressure = battlefieldEffects.some((effect) =>
    effect.type === "storm_charge" || effect.type === "trap_zone" || effect.type === "frozen_ground",
  )
    ? 0.9
    : 1;

  const plan = chooseEnemySpellPlan(enemy, player, { turn });
  logs.push(`${plan.spellName}: ${plan.effectText}`);

  const compiledEnemySpell = compileSpellFromStrokesSync(plan.strokes);
  if (!compiledEnemySpell.ok) {
    const feedback = compiledEnemySpell.failure.diegeticFailure?.playerFeedback
      ?? compiledEnemySpell.failure.message;
    logs.push(`${enemy.name} perdeu a formula: ${feedback}`);
    return {
      logs,
      plan,
      enemy: nextEnemy,
      player: nextPlayer,
      battlefieldEffects: nextBattlefieldEffects,
      outcome: "advance",
      playerHpDamage: 0,
    };
  }

  const enemyCard = compiledEnemySpell.card;
  const enemyPrecision = calculateFinalCastPrecision(enemyCard);
  const inkBreakdown = calculateSpellCardInkCost({ card: enemyCard });
  const inkSimulation = simulateInkSpend(getInkReservoir(enemy), inkBreakdown);

  if (!inkSimulation.ok) {
    logs.push(`${enemy.name} ficou sem tinta: precisa de ${inkSimulation.cost}, possui ${enemy.ink}.`);
    return {
      logs,
      plan,
      enemy: nextEnemy,
      player: nextPlayer,
      battlefieldEffects: nextBattlefieldEffects,
      outcome: "advance",
      playerHpDamage: 0,
    };
  }

  const enemyCast = resolveSpellCardCast({
    card: enemyCard,
    precision: enemyPrecision,
    opponent: player,
    inkCost: inkSimulation.cost,
    inkRemaining: inkSimulation.remainingInk,
    inkOverloadChance: inkSimulation.overloadChance,
    inkCostBreakdown: inkBreakdown,
  });

  const affectsEnemyCaster = enemyCast.effects.some((effect) => effect.area === "self");
  const hostileFactor = controlPenalty * fieldPressure;
  const supportFactor = controlPenalty;
  const resolvedDamage = affectsEnemyCaster ? 0 : Math.round(enemyCast.damage * hostileFactor);
  const healing = affectsEnemyCaster ? Math.round(enemyCast.healing * supportFactor) : 0;
  const shield = affectsEnemyCaster ? Math.round(enemyCast.shield * supportFactor) : 0;
  const statusEffects = scaleStatusEffectsByFactor(
    enemyCast.statusEffects,
    affectsEnemyCaster ? supportFactor : hostileFactor,
  );
  const fieldEffect = scaleBattlefieldEffectByFactor(enemyCast.fieldEffect, hostileFactor);

  if (controlPenalty < 1) {
    logs.push(`${enemy.name} teve a conjuracao enfraquecida por status.`);
  }

  if (!enemyCast.isSuccess) {
    nextEnemy = spendInk(enemy, inkSimulation.cost);
    logs.push(`${enemy.name} estabilizou ${enemyCard.name}, mas a formula nao encontrou efeito jogavel.`);
    return {
      logs,
      plan,
      enemy: nextEnemy,
      player: nextPlayer,
      battlefieldEffects: nextBattlefieldEffects,
      outcome: "advance",
      playerHpDamage: 0,
    };
  }

  if (affectsEnemyCaster) {
    const spent = spendInk(enemy, inkSimulation.cost);
    nextEnemy = {
      ...spent,
      hp: Math.min(spent.maxHp, spent.hp + healing),
      shield: spent.shield + shield,
      status: statusEffects.length > 0 || enemyCast.dispelPower > 0
        ? mergeStatusEffects(dispelStatuses(spent.status, enemyCast.dispelPower), statusEffects)
        : spent.status,
    };
    if (healing > 0) logs.push(`${enemy.name} recuperou ${healing} de vida com ${enemyCard.name}.`);
    if (shield > 0) logs.push(`${enemy.name} ergueu ${shield} de escudo com ${enemyCard.name}.`);
    if (statusEffects.length > 0) {
      logs.push(`${enemy.name} ganhou efeito: ${statusEffects.map(statusEffectLabel).join(", ")}.`);
    }
    if (fieldEffect) {
      nextBattlefieldEffects = upsertBattlefieldEffect(nextBattlefieldEffects, fieldEffect);
      logs.push(`Campo ${fieldEffect.type} estabilizado por ${fieldEffect.duration} turnos.`);
    }
    return {
      logs,
      plan,
      enemy: nextEnemy,
      player: nextPlayer,
      battlefieldEffects: nextBattlefieldEffects,
      outcome: "advance",
      playerHpDamage: 0,
    };
  }

  nextEnemy = spendInk(enemy, inkSimulation.cost);
  if (fieldEffect) {
    nextBattlefieldEffects = upsertBattlefieldEffect(nextBattlefieldEffects, fieldEffect);
    logs.push(`Campo ${fieldEffect.type} estabilizado por ${fieldEffect.duration} turnos.`);
  }
  if (statusEffects.length > 0) {
    logs.push(`Voce recebeu efeito: ${statusEffects.map(statusEffectLabel).join(", ")}.`);
  }

  const shieldBypass = Math.round(resolvedDamage * enemyCast.shieldBypassRatio);
  const shieldableDamage = Math.max(0, resolvedDamage - shieldBypass);
  const shieldAbsorb = Math.min(shieldableDamage, player.shield);
  const hpDamage = shieldBypass + shieldableDamage - shieldAbsorb;
  const newHp = Math.max(0, player.hp - hpDamage);

  nextPlayer = {
    ...player,
    hp: newHp,
    shield: Math.max(0, player.shield - shieldAbsorb),
    status: mergeStatusEffects(dispelStatuses(player.status, enemyCast.dispelPower), statusEffects),
  };

  if (player.shield > 0 && shieldAbsorb > 0) {
    logs.push(`Seu escudo absorveu ${shieldAbsorb} de dano!`);
  }

  if (newHp <= 0) {
    logs.push("Voce foi derrotada...");
    return {
      logs,
      plan,
      enemy: nextEnemy,
      player: nextPlayer,
      battlefieldEffects: nextBattlefieldEffects,
      outcome: "defeat",
      playerHpDamage: hpDamage,
    };
  }

  logs.push(`${enemy.name} lancou ${enemyCard.name} e causou ${hpDamage} de dano!`);
  return {
    logs,
    plan,
    enemy: nextEnemy,
    player: nextPlayer,
    battlefieldEffects: nextBattlefieldEffects,
    outcome: "advance",
    playerHpDamage: hpDamage,
  };
};