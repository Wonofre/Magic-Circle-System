import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Regression: P0 playtest — enemy acted multiple times after a single player failure
// Found by /qa + playtest on 2026-06-05
describe("enemy turn flow regression", () => {
  it("guards cast and enemy turn effects against duplicate scheduling", () => {
    const source = readFileSync(resolve(process.cwd(), "src/App.tsx"), "utf8");

    expect(source).toContain("castPhaseTokenRef");
    expect(source).toContain("enemyTurnTokenRef");
    expect(source).toContain("enemyTurnResolvedRef");
    expect(source).toContain("resolveEnemyTurn");
    expect(source).toContain("clearPendingEnemyTimeouts");
    expect(source).not.toMatch(/}, \[gamePhase, castResult, enemy\.hp/);
  });

  it("resets enemy turn guard when advancing to the next drawing turn", () => {
    const source = readFileSync(resolve(process.cwd(), "src/App.tsx"), "utf8");
    expect(source).toContain("enemyTurnResolvedRef.current = null");
    expect(source).toMatch(/advanceToNextDrawingTurn[\s\S]*enemyTurnResolvedRef\.current = null/);
  });
});