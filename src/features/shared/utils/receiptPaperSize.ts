/** Device-local browser print layout; does not modify restaurant billing data. */
export type ReceiptPaperSize = "58mm" | "80mm";
export const RECEIPT_PAPER_SIZE_KEY = "aatmyam_receipt_paper_size";
export function getReceiptPaperSize(): ReceiptPaperSize {
  try { return localStorage.getItem(RECEIPT_PAPER_SIZE_KEY) === "58mm" ? "58mm" : "80mm"; }
  catch { return "80mm"; }
}
export function saveReceiptPaperSize(size: ReceiptPaperSize): void {
  if (size !== "58mm" && size !== "80mm") throw new Error("Unsupported receipt paper size");
  localStorage.setItem(RECEIPT_PAPER_SIZE_KEY, size);
  window.dispatchEvent(new Event("aatmyam:receipt-paper-size"));
}
