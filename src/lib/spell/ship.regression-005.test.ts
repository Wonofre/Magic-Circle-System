import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Regression: Fase 5 (ship) — README, CI e GitHub Pages
describe("ship regression", () => {
  it("documents the game instead of the Vite starter template", () => {
    const readme = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
    expect(readme).toContain("Círculo Mágico");
    expect(readme).toContain("npm run dev");
    expect(readme).toContain("Magic-Circle-System");
    expect(readme).not.toContain("This template provides a minimal setup");
  });

  it("configures CI with tests, build, and GitHub Pages deploy", () => {
    const workflow = readFileSync(
      resolve(process.cwd(), ".github/workflows/ci.yml"),
      "utf8",
    );
    expect(workflow).toContain("npm test");
    expect(workflow).toContain("npm run build:pages");
    expect(workflow).toContain("deploy-pages");
    expect(workflow).toContain("upload-pages-artifact");
  });

  it("supports a dedicated pages base path for static hosting", () => {
    const viteSource = readFileSync(resolve(process.cwd(), "vite.config.ts"), "utf8");
    expect(viteSource).toContain("VITE_BASE_PATH");
    expect(readFileSync(resolve(process.cwd(), "public/.nojekyll"), "utf8")).toBe("");
  });
});