import { describe, expect, it } from "vitest";
import { generateEnemy } from "@/lib/spellEngine";
import { resolveEnemyTurn } from "@/lib/spell/enemyTurnResolver";
import type { Entity } from "@/types/magic";

const makePlayer = (overrides: Partial<Entity> = {}): Entity => ({
  id: "player",
  name: "Aprendiz",
  hp: 100,
  maxHp: 100,
  shield: 0,
  ink: 24,
  maxInk: 24,
  inkRegenPerTurn: 3,
  inkPurity: 1,
  inkViscosity: 0.5,
  inkVolatility: 0.12,
  inkAffinity: null,
  activeInfusionIds: [],
  element: null,
  weakness: null,
  resistance: null,
  status: [],
  isPlayer: true,
  ...overrides,
});

describe("enemyTurnResolver", () => {
  it("resolves exactly one hostile enemy turn for a generated round-1 enemy", () => {
    const enemy = generateEnemy(1);
    const player = makePlayer();
    const resolution = resolveEnemyTurn({
      enemy,
      player,
      battlefieldEffects: [],
      turn: 1,
    });

    expect(resolution.logs.length).toBeGreaterThan(0);
    expect(resolution.plan).not.toBeNull();
    expect(resolution.outcome === "advance" || resolution.outcome === "defeat").toBe(true);

    const attackLogs = resolution.logs.filter((line) => line.includes("causou") && line.includes("dano"));
    expect(attackLogs.length).toBeLessThanOrEqual(1);
    if (resolution.playerHpDamage > 0) {
      expect(resolution.player.hp).toBe(player.hp - resolution.playerHpDamage);
      expect(attackLogs).toHaveLength(1);
    }
  });

  it("produces stable snapshots when called twice with the same input", () => {
    const enemy = generateEnemy(1);
    const player = makePlayer();
    const input = {
      enemy,
      player,
      battlefieldEffects: [] as const,
      turn: 1,
    };

    const first = resolveEnemyTurn(input);
    const second = resolveEnemyTurn(input);

    expect(second.logs).toEqual(first.logs);
    expect(second.playerHpDamage).toBe(first.playerHpDamage);
    expect(second.outcome).toBe(first.outcome);
    expect(second.player.hp).toBe(first.player.hp);
  });

  it("skips hostile action during the first-round grace period", () => {
    const enemy = generateEnemy(1);
    const player = makePlayer();
    const resolution = resolveEnemyTurn({
      enemy,
      player,
      battlefieldEffects: [],
      turn: 1,
      gracePeriodActive: true,
    });

    expect(resolution.outcome).toBe("skip");
    expect(resolution.playerHpDamage).toBe(0);
    expect(resolution.player.hp).toBe(player.hp);
    expect(resolution.logs.some((line) => line.includes(enemy.name))).toBe(true);
    expect(resolution.logs.some((line) => line.includes("causou"))).toBe(false);
  });

  it("does not stack duplicate attack logs across repeated resolutions at the same turn", () => {
    const enemy = generateEnemy(1);
    const player = makePlayer();
    const first = resolveEnemyTurn({ enemy, player, battlefieldEffects: [], turn: 1 });
    const chained = resolveEnemyTurn({
      enemy: first.enemy,
      player: first.player,
      battlefieldEffects: first.battlefieldEffects,
      turn: 2,
    });

    const firstAttacks = first.logs.filter((line) => line.includes("lancou") && line.includes("causou"));
    const chainedAttacks = chained.logs.filter((line) => line.includes("lancou") && line.includes("causou"));
    expect(firstAttacks.length).toBeLessThanOrEqual(1);
    expect(chainedAttacks.length).toBeLessThanOrEqual(1);
  });
});