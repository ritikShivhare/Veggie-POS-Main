import React from "react";

interface ReceiptTotalsProps {
  order: { subtotal?: number; tax?: number; discount?: number; total: number };
  variant?: "dashboard" | "thermal";
}

export default function ReceiptTotals({ order, variant = "dashboard" }: ReceiptTotalsProps) {
  // Historical receipts use saved amounts, never the current restaurant tax settings.
  const tax = order.tax ?? 0;
  const discount = order.discount ?? 0;
  const subtotal = order.subtotal ?? (order.total - tax + discount);
  const rate = subtotal > 0 ? Number(((tax / subtotal) * 100).toFixed(2)) : null;
  const prefix = variant === "thermal" ? "INR " : "₹";
  const money = (amount: number) => `${prefix}${amount.toFixed(2)}`;

  return (
    <div className={`space-y-1 ${variant === "thermal" ? "py-2 border-b border-dashed border-slate-400 text-[10px]" : "border-t border-dashed border-slate-300 pt-3 text-[11px]"}`}>
      <div className="flex justify-between text-slate-600"><span>Subtotal</span><span className="font-mono">{money(subtotal)}</span></div>
      {tax > 0 && <div className="flex justify-between text-slate-600"><span>{rate === null ? "GST" : `GST (${rate}%)`}</span><span className="font-mono">{money(tax)}</span></div>}
      {discount > 0 && <div className="flex justify-between text-emerald-700 font-semibold"><span>Loyalty/Discount</span><span className="font-mono">-{money(discount)}</span></div>}
      <div className="flex justify-between text-sm font-black text-slate-900 border-t border-slate-200 pt-1.5 mt-1.5"><span>Grand Total</span><span className="font-mono">{money(order.total)}</span></div>
    </div>
  );
}
