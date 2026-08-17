import React, { useState, useEffect, useRef } from "react";
import QRCode from "qrcode";
import {
  QrCode,
  RefreshCw,
  Copy,
  Check,
  Printer,
  Download,
  ShieldCheck,
  AlertTriangle,
  X,
  Smartphone,
  ExternalLink,
  Lock,
  Sparkles
} from "lucide-react";
import { RestaurantTenant } from "../../shared/types";
import { toast } from "../../shared/services/toast";

interface StaffQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenant: RestaurantTenant;
  onTenantUpdate?: (updatedTenant: RestaurantTenant) => void;
}

export default function StaffQrModal({
  isOpen,
  onClose,
  tenant,
  onTenantUpdate
}: StaffQrModalProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [isRotating, setIsRotating] = useState<boolean>(false);
  const [showConfirmRotate, setShowConfirmRotate] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [staffQrSecret, setStaffQrSecret] = useState<string>(
    tenant.staffQrSecret || `qr-init-${tenant.tenantId}`
  );
  const [lastRotatedAt, setLastRotatedAt] = useState<string>(
    tenant.staffQrUpdatedAt || tenant.created || new Date().toISOString()
  );

  // Derive base URL and staff login URL
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const staffLoginUrl = `${origin}/?tenant=${encodeURIComponent(
    tenant.tenantId
  )}&token=${encodeURIComponent(staffQrSecret)}`;

  // Generate QR Code on canvas/image whenever secret or tenant changes
  useEffect(() => {
    if (!isOpen) return;

    QRCode.toDataURL(staffLoginUrl, {
      width: 480,
      margin: 2,
      color: {
        dark: "#090d16",
        light: "#ffffff"
      },
      errorCorrectionLevel: "H"
    })
      .then((url) => {
        setQrDataUrl(url);
      })
      .catch((err) => {
        console.error("Failed to generate QR code:", err);
      });
  }, [isOpen, staffLoginUrl, tenant.tenantId, staffQrSecret]);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(staffLoginUrl);
    setCopied(true);
    toast.success("Staff Login URL copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `${tenant.name.replace(/\s+/g, "_")}_Staff_Login_QR.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success("QR Code downloaded successfully!");
  };

  const handlePrintCard = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Please allow popups to print the QR standee.");
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${tenant.name} - Staff Login Standee</title>
          <style>
            @page { size: auto; margin: 15mm; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              text-align: center;
              padding: 24px;
              color: #0f172a;
              background: #fff;
            }
            .card {
              max-width: 420px;
              margin: 0 auto;
              border: 3px solid #0f172a;
              border-radius: 24px;
              padding: 32px 24px;
              box-shadow: 0 4px 20px rgba(0,0,0,0.06);
            }
            .badge {
              display: inline-block;
              background: #ecfdf5;
              color: #047857;
              padding: 6px 16px;
              border-radius: 999px;
              font-size: 13px;
              font-weight: 700;
              border: 1px solid #a7f3d0;
              margin-bottom: 12px;
            }
            h1 {
              font-size: 26px;
              font-weight: 900;
              margin: 0 0 6px 0;
              color: #0f172a;
            }
            p.sub {
              font-size: 13px;
              color: #64748b;
              margin: 0 0 20px 0;
            }
            .qr-wrapper {
              background: #fff;
              padding: 16px;
              border: 2px dashed #cbd5e1;
              border-radius: 20px;
              display: inline-block;
              margin-bottom: 20px;
            }
            .qr-wrapper img {
              width: 260px;
              height: 260px;
              display: block;
            }
            .instructions {
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 16px;
              padding: 16px;
              text-align: left;
              font-size: 13px;
              color: #334155;
              margin-bottom: 20px;
            }
            .instructions ol {
              margin: 0;
              padding-left: 20px;
            }
            .instructions li {
              margin-bottom: 6px;
            }
            .store-code {
              font-family: monospace;
              font-size: 15px;
              font-weight: bold;
              background: #0f172a;
              color: #fff;
              padding: 8px 16px;
              border-radius: 12px;
              display: inline-block;
            }
            .footer {
              font-size: 11px;
              color: #94a3b8;
              margin-top: 16px;
            }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="badge">VeggiePOS • Staff Terminal</div>
            <h1>${tenant.name}</h1>
            <p class="sub">कर्मचारी लॉगिन क्यूआर कोड (Staff Quick Login)</p>
            
            <div class="qr-wrapper">
              <img src="${qrDataUrl}" alt="Staff QR Code" />
            </div>

            <div class="instructions">
              <strong style="display:block; margin-bottom:6px; color:#0f172a;">📱 लॉगिन करने का तरीका (Steps to Login):</strong>
              <ol>
                <li>अपने मोबाइल कैमरे से यह QR Code स्कैन करें।</li>
                <li>अपना <b>4-अंकों का गुप्त PIN</b> दर्ज करें।</li>
                <li>अपनी शिफ्ट शुरू करें (Start Duty / Punch Orders)।</li>
              </ol>
            </div>

            <div>
              <span style="font-size:11px; color:#64748b; display:block; margin-bottom:4px;">मैन्युअल स्टोर कोड (Store Outlet Code):</span>
              <div class="store-code">${tenant.tenantId}</div>
            </div>

            <div class="footer">
              सुरक्षित प्रमाणीकरण • Powered by VeggiePOS Cloud Suite
            </div>
          </div>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Rotate / Change QR Code action
  const handleRotateQrCode = async () => {
    setIsRotating(true);
    try {
      const sessId = localStorage.getItem("veggiepos_current_session_id") || "";
      const currentTenantId = tenant.tenantId;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (sessId) headers["x-session-id"] = sessId;
      if (currentTenantId) headers["x-tenant-id"] = currentTenantId;

      const res = await fetch("/api/auth/tenant/regenerate-qr", {
        method: "POST",
        headers,
        body: JSON.stringify({ tenantId: currentTenantId })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to rotate QR code");
      }

      setStaffQrSecret(data.staffQrSecret);
      setLastRotatedAt(data.staffQrUpdatedAt);

      const updatedTenant = {
        ...tenant,
        staffQrSecret: data.staffQrSecret,
        staffQrUpdatedAt: data.staffQrUpdatedAt
      };

      if (onTenantUpdate) {
        onTenantUpdate(updatedTenant);
      }

      // Update in localStorage
      try {
        const savedStr = localStorage.getItem("veggiepos_tenants");
        if (savedStr) {
          const list: RestaurantTenant[] = JSON.parse(savedStr);
          const updated = list.map((t) =>
            t.tenantId === currentTenantId ? updatedTenant : t
          );
          localStorage.setItem("veggiepos_tenants", JSON.stringify(updated));
        }
      } catch (e) {}

      setShowConfirmRotate(false);
      toast.success("✨ QR Code changed! Old QR codes have been invalidated for security.");
    } catch (err: any) {
      toast.error(err.message || "Failed to change QR code.");
    } finally {
      setIsRotating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-display font-bold text-white leading-tight">
                Staff Login QR Code
              </h2>
              <p className="text-[11px] text-slate-400">
                कर्मचारी लॉगिन क्यूआर कोड • {tenant.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
            id="staff-qr-modal-close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-200">
          
          {/* Main QR Display Card */}
          <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-5 flex flex-col items-center text-center space-y-4">
            <div className="relative group">
              <div className="p-3 bg-white rounded-2xl shadow-xl border-4 border-slate-100 flex items-center justify-center">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="Staff Login QR Code"
                    className="w-52 h-52 sm:w-60 sm:h-60 rounded-lg object-contain"
                  />
                ) : (
                  <div className="w-52 h-52 flex items-center justify-center">
                    <RefreshCw className="w-8 h-8 text-slate-400 animate-spin" />
                  </div>
                )}
              </div>
              <div className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
                <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                <span>कर्मचारी अपने फोन कैमरे से स्कैन करके PIN डालेंगे</span>
              </div>
            </div>

            {/* Store Code Badge */}
            <div className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
              <div className="text-left">
                <span className="text-[10px] uppercase font-mono font-bold text-slate-400 block">
                  Store Code (स्टोर कोड)
                </span>
                <span className="text-sm font-mono font-bold text-emerald-400 select-all">
                  {tenant.tenantId}
                </span>
              </div>
              <button
                onClick={handleCopyLink}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? "Copied!" : "Copy Link"}</span>
              </button>
            </div>
          </div>

          {/* Actions: Print & Download */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handlePrintCard}
              className="py-3 px-4 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/10 transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print Standee / Poster</span>
            </button>
            <button
              onClick={handleDownloadQr}
              className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl border border-slate-700 transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download PNG Image</span>
            </button>
          </div>

          {/* Change / Rotate QR Code Security Section */}
          <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-white">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>QR Security & Rotation (QR कोड बदलना)</span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">
                Updated: {new Date(lastRotatedAt).toLocaleDateString()}
              </span>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              यदि कोई कर्मचारी नौकरी छोड़ देता है या आप पुराना QR कोड बंद करना चाहते हैं, तो <b>"Change QR Code"</b> दबाकर तुरंत नया कोड बना सकते हैं। पुराना QR कोड तुरंत काम करना बंद कर देगा।
            </p>

            {showConfirmRotate ? (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2.5 animate-fadeIn">
                <div className="flex items-start gap-2 text-xs text-amber-300">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                  <span>
                    क्या आप वाकई नया QR कोड बनाना चाहते हैं? पहले से प्रिंट किए गए सभी पुराने QR कोड निष्क्रिय (Invalid) हो जाएंगे।
                  </span>
                </div>
                <div className="flex items-center gap-2 justify-end pt-1">
                  <button
                    onClick={() => setShowConfirmRotate(false)}
                    disabled={isRotating}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRotateQrCode}
                    disabled={isRotating}
                    className="px-4 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 transition flex items-center gap-1.5 cursor-pointer shadow"
                  >
                    {isRotating ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Rotating...</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Yes, Change QR Now</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowConfirmRotate(true)}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-amber-300 hover:text-amber-200 border border-amber-500/20 hover:border-amber-500/40 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
                id="staff-qr-rotate-btn"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Change / Regenerate QR Code (QR बदलें)</span>
              </button>
            )}
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40 flex items-center justify-between text-xs text-slate-500">
          <span>Yashika POS Security Suite</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
