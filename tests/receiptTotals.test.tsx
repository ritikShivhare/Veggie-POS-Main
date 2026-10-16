import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ReceiptTotals from "../src/features/shared/components/ReceiptTotals";

for (const variant of ["dashboard", "thermal"] as const) {
  describe(`${variant} receipt totals`, () => {
    const render = (order: { subtotal?: number; tax?: number; discount?: number; total: number }) =>
      renderToStaticMarkup(<ReceiptTotals order={order} variant={variant} />).replace(/<[^>]+>/g, "");
    const currency = variant === "thermal" ? "INR " : "₹";

    it("preserves the saved zero GST and discount from the reported ₹323 bill", () => {
      const text = render({ subtotal: 340, tax: 0, discount: 17, total: 323 });
      expect(text).not.toMatch(/GST|Tax|16\.15/);
      expect(text).toContain(`Subtotal${currency}340.00`);
      expect(text).toContain(`Loyalty/Discount-${currency}17.00`);
      expect(text).toContain(`Grand Total${currency}323.00`);
    });

    it("prints the saved positive tax and its actual rate instead of hardcoding 5%", () => {
      const text = render({ subtotal: 100, tax: 12, discount: 5, total: 107 });
      expect(text).toContain(`GST (12%)${currency}12.00`);
      expect(text).toContain(`Grand Total${currency}107.00`);
      expect(text).not.toContain("GST (5%)");
    });

    it("does not invent tax for an older order with missing tax or subtotal", () => {
      const text = render({ discount: 17, total: 323 });
      expect(text).not.toContain("GST");
      expect(text).toContain(`Subtotal${currency}340.00`);
    });

    it("preserves explicit zero amounts and omits a zero discount", () => {
      const text = render({ subtotal: 0, tax: 0, discount: 0, total: 0 });
      expect(text).toContain(`Subtotal${currency}0.00`);
      expect(text).not.toMatch(/GST|Discount/);
    });
  });
}
