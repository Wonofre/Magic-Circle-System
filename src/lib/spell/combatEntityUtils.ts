import type { BattlefieldEffect, Entity, StatusEffect } from "@/types/magic";

export const damagingStatusTypes = new Set<StatusEffect["type"]>(["burn", "poisoned", "bleeding", "frozen"]);
export const controlStatusTypes = new Set<StatusEffect["type"]>(["stun", "slow", "frozen", "rooted", "confused", "blinded"]);

export const mergeStatusEffects = (
  current: readonly StatusEffect[],
  incoming: readonly StatusEffect[],
): StatusEffect[] => {
  const merged = new Map<StatusEffect["type"], StatusEffect>();

  [...current, ...incoming].forEach((status) => {
    const previous = merged.get(status.type);
    merged.set(status.type, previous
      ? {
          type: status.type,
          duration: Math.max(previous.duration, status.duration),
          potency: Math.max(previous.potency, status.potency),
        }
      : { ...status });
  });

  return [...merged.values()];
};

export const tickEntityStatuses = (entity: Entity): Entity => {
  let hp = entity.hp;
  const nextStatuses: StatusEffect[] = [];

  entity.status.forEach((status) => {
    if (damagingStatusTypes.has(status.type)) {
      hp = Math.max(0, hp - Math.max(1, Math.round(status.potency)));
    }
    if (status.type === "regeneration") {
      hp = Math.min(entity.maxHp, hp + Math.max(1, Math.round(status.potency)));
    }
    if (status.duration > 1) {
      nextStatuses.push({ ...status, duration: status.duration - 1 });
    }
  });

  return { ...entity, hp, status: nextStatuses };
};

export const tickBattlefieldEffects = (effects: readonly BattlefieldEffect[]): BattlefieldEffect[] =>
  effects
    .map((effect) => ({ ...effect, duration: effect.duration - 1 }))
    .filter((effect) => effect.duration > 0);

export const dispelStatuses = (statuses: readonly StatusEffect[], power: number): StatusEffect[] => {
  if (power <= 0) return [...statuses];
  let remaining = power;
  const kept: StatusEffect[] = [];

  for (const status of statuses) {
    const cost = Math.max(1, status.potency);
    if (remaining >= cost) {
      remaining -= cost;
    } else {
      kept.push(status);
    }
  }

  return kept;
};

export const statusEffectLabel = (status: StatusEffect): string =>
  `${status.type} ${status.duration}t`;

export const scaleStatusEffectsByFactor = (
  statuses: readonly StatusEffect[],
  factor: number,
): StatusEffect[] =>
  statuses.map((status) => ({
    ...status,
    potency: Math.max(1, Math.round(status.potency * factor)),
  }));

export const scaleBattlefieldEffectByFactor = (
  effect: BattlefieldEffect | undefined,
  factor: number,
): BattlefieldEffect | undefined =>
  effect
    ? {
        ...effect,
        potency: Math.max(1, Math.round(effect.potency * factor)),
      }
    : undefined;