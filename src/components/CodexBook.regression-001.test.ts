import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Regression: ISSUE-002 — Grimório modal blocked menu actions without obvious dismiss
// Found by /qa on 2026-06-18
// Report: .gstack/qa-reports/qa-report-localhost-2026-06-18.md
describe("CodexBook regression", () => {
  it("closes on Escape so the menu stays usable", () => {
    const source = readFileSync(resolve(process.cwd(), "src/components/CodexBook.tsx"), "utf8");
    expect(source).toContain('event.key === "Escape"');
    expect(source).toContain("onClose()");
  });
});