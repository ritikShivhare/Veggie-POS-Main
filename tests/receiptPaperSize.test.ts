import {describe,it,expect} from "vitest";
import {getReceiptPaperSize,saveReceiptPaperSize,RECEIPT_PAPER_SIZE_KEY} from "../src/features/shared/utils/receiptPaperSize";

describe("Receipt paper width device preference",()=>{
  it("defaults to 80mm without storage",()=>{
    expect(getReceiptPaperSize()).toBe("80mm");
  });
  it("validates supported sizes",()=>{
    expect(()=>saveReceiptPaperSize("A4" as any)).toThrow("Unsupported receipt paper size");
  });
  it("has a stable device-only storage key",()=>{
    expect(RECEIPT_PAPER_SIZE_KEY).toBe("aatmyam_receipt_paper_size");
  });
});
