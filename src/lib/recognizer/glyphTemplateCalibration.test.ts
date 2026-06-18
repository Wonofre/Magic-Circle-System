import { describe, expect, it } from "vitest";

import { activeRuneTemplateIds } from "@/data/magicOntology";
import { auditGlyphTemplateRecognition } from "@/lib/recognizer/glyphTemplateCalibration";

describe("glyph template calibration", () => {
  it("recognizes every active glyph one by one across controlled drawing variants", () => {
    const summary = auditGlyphTemplateRecognition(activeRuneTemplateIds);

    expect(
      summary.failures.map((failure) => ({
        templateId: failure.templateId,
        variantId: failure.variantId,
        recognizedTemplateId: failure.recognizedTemplateId,
        runnerUpTemplateId: failure.runnerUpTemplateId,
        confidence: Number(failure.confidence.toFixed(3)),
        margin: Number(failure.semanticMargin.toFixed(3)),
        outcome: failure.outcome,
        topologyValid: failure.topologyValid,
      })),
    ).toEqual([]);
    expect(summary.minimumConfidence).toBeGreaterThanOrEqual(0.7);
    expect(summary.minimumSemanticMargin).toBeGreaterThanOrEqual(0.12);
  }, 60000);
});
