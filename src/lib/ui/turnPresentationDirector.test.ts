import { describe, expect, it } from "vitest";

import { readableTurnPresentationTimings } from "@/lib/ui/turnPresentationDirector";

describe("turn presentation timing", () => {
  it("keeps player and enemy feedback readable between turns", () => {
    expect(readableTurnPresentationTimings.resultFeedbackDuration).toBeGreaterThanOrEqual(4000);
    expect(readableTurnPresentationTimings.playerCastPhaseAdvanceDelay).toBeGreaterThanOrEqual(3000);
    expect(readableTurnPresentationTimings.enemyResultDelay).toBeGreaterThanOrEqual(3500);
    expect(readableTurnPresentationTimings.defeatResultDelay).toBeGreaterThanOrEqual(2000);
  });
});
