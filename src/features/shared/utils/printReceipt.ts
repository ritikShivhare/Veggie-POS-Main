import { getReceiptPaperSize, ReceiptPaperSize } from './receiptPaperSize';

/** Print a copy containing only the chosen bill. Hidden app layout cannot add
 * a second page, and another open receipt cannot be printed accidentally. */
export function buildReceiptPrintDocument(element: HTMLElement, paperSize: ReceiptPaperSize = getReceiptPaperSize()): string {
  const root = element.cloneNode(true) as HTMLElement;
  root.classList.add('receipt-print-root');
  const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
    .map(node => node.outerHTML).join('\n');
  const width = paperSize === '58mm' ? '54mm' : '76mm';
  return `<!doctype html><html><head><meta charset="utf-8"><title>Receipt</title>${styles}
    <style>
      @page { margin: 4mm; }
      html, body { margin: 0 !important; padding: 0 !important; height: auto !important; min-height: 0 !important; overflow: visible !important; background: white !important; }
      body * { visibility: visible !important; }
      .receipt-print-root { position: static !important; display: block !important; width: ${width} !important; max-width: ${width} !important; height: auto !important; min-height: 0 !important; max-height: none !important; overflow: visible !important; margin: 0 !important; padding: 2mm !important; box-sizing: border-box !important; box-shadow: none !important; border: 0 !important; transform: none !important; animation: none !important; }
      .receipt-print-root * { overflow-wrap: anywhere; }
      .no-print { display: none !important; }
    </style></head><body>${root.outerHTML}</body></html>`;
}

let printing = false;
export function printReceipt(selector: string): void {
  if (printing) return;
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) return;
  printing = true;
  document.querySelectorAll('iframe[data-receipt-print]').forEach(frame => frame.remove());
  const frame = document.createElement('iframe');
  frame.dataset.receiptPrint = 'true';
  frame.title = 'Receipt print preview';
  frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:320px;height:1px;border:0';
  const cleanup = () => { frame.remove(); printing = false; };
  frame.onload = async () => {
    const printWindow = frame.contentWindow;
    if (!printWindow) { cleanup(); return; }
    try {
      await printWindow.document.fonts.ready;
      printWindow.addEventListener('afterprint', cleanup, { once: true });
      printWindow.focus();
      printWindow.print();
      // A cancelled mobile print dialog may omit afterprint. Keep the copied
      // bill until the next print, without locking the application controls.
      printing = false;
    } catch { cleanup(); }
  };
  frame.srcdoc = buildReceiptPrintDocument(element);
  document.body.appendChild(frame);
}
