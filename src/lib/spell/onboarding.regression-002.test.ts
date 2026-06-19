import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Regression: P1 playtest — onboarding da primeira magia (2026-06-05)
describe("onboarding regression", () => {
  it("pauses combat only while the grimorio is open, not during canvas tutorial", () => {
    const source = readFileSync(resolve(process.cwd(), "src/App.tsx"), "utf8");
    expect(source).toContain("const isCombatPaused = showCodexBook;");
    expect(source).not.toContain("const isCombatPaused = showCodexBook || tutorialMode;");
  });

  it("defers enemy pressure until the first successful cast in round 1", () => {
    const source = readFileSync(resolve(process.cwd(), "src/App.tsx"), "utf8");
    expect(source).toContain("firstSuccessfulCastRef");
    expect(source).toContain("gracePeriodActive: round === 1 && !firstSuccessfulCastRef.current");
  });

  it("refunds ink for discarded short strokes on the canvas", () => {
    const canvasSource = readFileSync(resolve(process.cwd(), "src/components/GameCanvas.tsx"), "utf8");
    expect(canvasSource).toMatch(/currentStroke\.length < 3.*onInkRefund/s);
  });

  it("offers an explicit start-drawing action in the grimorio tutorial", () => {
    const codexSource = readFileSync(resolve(process.cwd(), "src/components/CodexBook.tsx"), "utf8");
    expect(codexSource).toContain("Comecar a desenhar");
  });
});