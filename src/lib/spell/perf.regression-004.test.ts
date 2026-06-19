import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Regression: Fase 4 — lazy ML bundle + manualChunks
describe("bundle performance regression", () => {
  it("splits onnxruntime and ML recognition into dedicated vite chunks", () => {
    const viteSource = readFileSync(resolve(process.cwd(), "vite.config.ts"), "utf8");
    expect(viteSource).toContain("manualChunks");
    expect(viteSource).toContain("onnxruntime-web");
    expect(viteSource).toContain("ml-recognition");
  });

  it("lazy-loads probabilistic recognition on first fused cast", () => {
    const recognizerSource = readFileSync(
      resolve(process.cwd(), "src/lib/recognizerV2/componentRecognizerV2.ts"),
      "utf8",
    );
    expect(recognizerSource).toContain('import("@/lib/recognizer/ml/probabilisticRecognizer")');
    expect(recognizerSource).not.toMatch(
      /^import\s*\{[^}]*recognizeGlyphRegionsProbabilistically[^}]*\}\s*from\s*"@\/lib\/recognizer\/ml\/probabilisticRecognizer";/m,
    );
  });

  it("exposes ML runtime subscription for canvas loading feedback", () => {
    const runtimeSource = readFileSync(
      resolve(process.cwd(), "src/lib/recognizer/ml/modelRuntime.ts"),
      "utf8",
    );
    expect(runtimeSource).toContain("subscribeGlyphModelRuntimeState");

    const appSource = readFileSync(resolve(process.cwd(), "src/App.tsx"), "utf8");
    expect(appSource).toContain("subscribeGlyphModelRuntimeState");
    expect(appSource).toContain("mlLoading=");
    expect(appSource).not.toContain("preloadGlyphModel");
  });
});