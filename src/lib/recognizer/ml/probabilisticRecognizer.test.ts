import { beforeEach, describe, expect, it, vi } from "vitest";

const { runGlyphModelMock } = vi.hoisted(() => ({
  runGlyphModelMock: vi.fn(),
}));

vi.mock("@/lib/recognizer/ml/modelRuntime", () => ({
  getGlyphModelRuntimeState: () => ({
    status: "ready",
    provider: "wasm",
    metadata: { modelVersion: "test-model" },
  }),
  runGlyphModel: runGlyphModelMock,
}));

import { getGlyphById } from "@/data/glyphTemplates";
import { recognizeMandalaComponentsV2Probabilistically } from "@/lib/recognizerV2/componentRecognizerV2";

describe("probabilistic component recognition", () => {
  beforeEach(() => {
    runGlyphModelMock.mockReset();
  });

  it("can select a structurally valid top-2 candidate over an invalid top-1", async () => {
    runGlyphModelMock.mockResolvedValue({
      provider: "wasm",
      modelVersion: "test-model",
      candidates: [
        {
          templateId: "ELEMENT_TERRA",
          rank: 1,
          confidence: 0.94,
          semanticMargin: 0.08,
          confidenceThreshold: 0.8,
          semanticMarginThreshold: 0.035,
          passesConfidenceThreshold: true,
          passesSemanticMarginThreshold: true,
          source: "onnx_wasm",
          acceptedByClassThreshold: true,
        },
        {
          templateId: "ELEMENT_AQUA",
          rank: 2,
          confidence: 0.86,
          semanticMargin: 0.18,
          confidenceThreshold: 0.8,
          semanticMarginThreshold: 0.035,
          passesConfidenceThreshold: true,
          passesSemanticMarginThreshold: true,
          source: "onnx_wasm",
          acceptedByClassThreshold: true,
        },
      ],
    });
    const template = getGlyphById("ELEMENT_AQUA");
    expect(template).toBeDefined();
    const strokes = template!.strokes.map((stroke, index) => ({
      id: `aqua:${index}`,
      semanticGroupId: "aqua-test",
      points: stroke.map(([x, y]) => ({ x, y })),
    }));

    const result = await recognizeMandalaComponentsV2Probabilistically(strokes);
    const selectedIds = result.recognitions.map(
      (recognition) => recognition.semantic.candidate?.template.id,
    );

    expect(selectedIds).toContain("ELEMENT_AQUA");
    expect(
      result.recognitions.find(
        (recognition) => recognition.semantic.candidate?.template.id === "ELEMENT_AQUA",
      )?.semantic.minSemanticMargin,
    ).toBe(0.035);
  });
});
