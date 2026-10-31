import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const dashboard = readFileSync(new URL("../src/features/shared/components/Dashboard.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");

describe("Historical paid-order receipt printing", () => {
  it("marks the historical receipt modal and its actual print body", () => {
    expect(dashboard).toContain('className="historical-receipt-modal fixed');
    expect(dashboard).toContain('className="historical-receipt-print-body flex-1');
  });

  it("has a dedicated print rule for the historical receipt without printing dashboard tiles", () => {
    expect(css).toContain('body:has(.historical-receipt-modal) .printable-thermal-receipt');
    expect(css).toContain('body:has(.historical-receipt-modal) .historical-receipt-modal .historical-receipt-print-body *');
    expect(css).toContain('.historical-receipt-modal > div > :not(.historical-receipt-print-body)');
  });
});
