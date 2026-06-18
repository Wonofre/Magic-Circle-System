import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("CodexBook integration", () => {
  it("App uses a single grimorio button instead of separate guide and codex buttons", () => {
    const source = readFileSync(resolve(process.cwd(), "src/App.tsx"), "utf8");
    expect(source).toContain("CodexBook");
    expect(source).not.toContain("setShowGuide");
    expect(source).not.toMatch(/\bshowCodex\b/);
    expect(source).not.toContain("CodexPanel");
    expect(source).not.toContain("GuidePanel");
    expect(source).not.toContain("HelpCircle");
    expect(source).not.toContain("preloadGlyphModel");
  });

  it("BattleSceneShell uses MandalaSummaryPanel instead of debug ML panel", () => {
    const source = readFileSync(resolve(process.cwd(), "src/components/BattleSceneShell.tsx"), "utf8");
    expect(source).toContain("MandalaSummaryPanel");
    expect(source).not.toContain("MandalaDebugPanelV2");
  });
});