import React, { useState } from "react";
import { RestaurantTenant } from "../shared/types";
import {
  Store,
  ArrowRight,
  ShieldCheck,
  Building,
  CheckCircle2,
  Sparkles,
  Camera,
  AlertCircle,
  Lock,
  ArrowLeft
} from "lucide-react";
import QrScannerModal from "./components/QrScannerModal";

interface StoreLoginViewProps {
  tenants: RestaurantTenant[];
  onConnectStore: (code: string) => Promise<{ success: boolean; tenant?: RestaurantTenant; error?: string }>;
  onSelectTenant: (tenant: RestaurantTenant) => void;
  onOpenSignup: () => void;
  onBackToWebsite: () => void;
}

export default function StoreLoginView({
  tenants,
  onConnectStore,
  onSelectTenant,
  onOpenSignup,
  onBackToWebsite
}: StoreLoginViewProps) {
  const [storeCodeInput, setStoreCodeInput] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showQrModal, setShowQrModal] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent, directCode?: string) => {
    if (e) e.preventDefault();
    const code = (directCode || storeCodeInput).trim();
    if (!code) {
      setError("Please enter your Store Code or Restaurant Name.");
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      const res = await onConnectStore(code);
      if (!res.success) {
        setError(res.error || `Could not find an active store matching "${code}". Check your store code or register a new store.`);
      }
    } catch (err: any) {
      setError(err.message || "Failed to connect to store. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FBF9F5] text-[#1C1E1B] flex flex-col justify-between font-sans selection:bg-[#6E8F45]/20 selection:text-[#1C1E1B]">
      
      {/* Top Header Strip */}
      <header className="border-b border-[#EAE5DA] bg-[#FBF9F5]/90 backdrop-blur-md px-4 sm:px-8 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <button
            onClick={onBackToWebsite}
            className="flex items-center gap-2 text-xs font-bold text-[#5A6056] hover:text-[#181A18] transition cursor-pointer"
            id="store-login-back-to-site-btn"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Veggie POS Website</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono font-bold text-[#567234] bg-[#EBF2E4] border border-[#D5E3C8] px-2.5 py-1 rounded-full flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>TERMINAL GATEWAY</span>
            </span>
          </div>
        </div>
      </header>

      {/* Main Connect Card */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 my-6">
        <div className="w-full max-w-md bg-[#F4F0E8] border border-[#EAE5DA] rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
          
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-[#181A18] text-[#FBF9F5] flex items-center justify-center font-serif text-2xl font-bold mx-auto border border-[#2E332D] shadow-sm">
              V
            </div>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#181A18]">
              Connect Store Terminal
            </h1>
            <p className="text-xs text-[#5A6056] leading-relaxed max-w-sm mx-auto">
              Enter your Store Code to link this tablet or terminal. Once connected, this device will open directly to your Staff PIN keypad.
            </p>
          </div>

          {error && (
            <div className="p-3.5 bg-[#FDF2F2] border border-[#F8D7DA] rounded-2xl text-xs text-[#9B1C1C] flex items-start gap-2.5 animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold">{error}</p>
                <p className="text-[11px] text-[#9B1C1C]/80">
                  Tip: Use demo store <button type="button" onClick={() => handleSubmit(undefined as any, "veg-main-001")} className="underline font-bold">veg-main-001</button> or register a new store.
                </p>
              </div>
            </div>
          )}

          {/* Connection Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-mono font-bold text-[#181A18] uppercase tracking-wider flex items-center justify-between">
                <span>Store ID or Restaurant Code</span>
                <span className="text-[10px] text-[#787F74] normal-case">e.g. veg-main-001</span>
              </label>
              
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#787F74]">
                  <Store className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  placeholder="Enter Store Code or Outlet Name"
                  value={storeCodeInput}
                  onChange={(e) => {
                    setStoreCodeInput(e.target.value);
                    setError("");
                  }}
                  className="w-full pl-10 pr-4 py-3 bg-[#FBF9F5] border border-[#EAE5DA] rounded-xl text-xs text-[#181A18] font-mono focus:outline-hidden focus:border-[#6E8F45] focus:ring-1 focus:ring-[#6E8F45] placeholder:text-[#A6AEA0]"
                  id="store-code-input-field"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 py-3.5 bg-[#181A18] hover:bg-[#6E8F45] text-[#FBF9F5] rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
                id="store-login-connect-submit-btn"
              >
                {isLoading ? (
                  <span>Connecting Outlet...</span>
                ) : (
                  <>
                    <span>Link Store Terminal</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowQrModal(true)}
                className="p-3.5 bg-[#FBF9F5] hover:bg-[#EAE5DA] text-[#181A18] rounded-xl border border-[#EAE5DA] transition cursor-pointer flex items-center justify-center"
                title="Scan Terminal QR Code"
                id="store-login-scan-qr-btn"
              >
                <Camera className="w-4 h-4 text-[#6E8F45]" />
              </button>
            </div>
          </form>

          {/* Quick Demo Outlets */}
          <div className="pt-4 border-t border-[#EAE5DA] space-y-2">
            <p className="text-[10px] font-mono uppercase text-[#787F74] font-bold text-center">
              Available Demo Outlets:
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => handleSubmit(undefined as any, "veg-main-001")}
                className="p-2.5 bg-[#FBF9F5] hover:bg-[#EAE5DA] border border-[#EAE5DA] rounded-xl text-left transition cursor-pointer"
              >
                <p className="font-bold text-[#181A18] truncate">Main Veggie Bistro</p>
                <p className="text-[10px] font-mono text-[#567234]">veg-main-001</p>
              </button>
              <button
                type="button"
                onClick={() => handleSubmit(undefined as any, "veg-reetesh-dhaba")}
                className="p-2.5 bg-[#FBF9F5] hover:bg-[#EAE5DA] border border-[#EAE5DA] rounded-xl text-left transition cursor-pointer"
              >
                <p className="font-bold text-[#181A18] truncate">Reetesh Dhaba</p>
                <p className="text-[10px] font-mono text-[#567234]">veg-reetesh-dhaba</p>
              </button>
            </div>
          </div>

          {/* Register New Store CTA */}
          <div className="pt-2 text-center space-y-2">
            <p className="text-xs text-[#5A6056]">
              Don't have a store code yet?
            </p>
            <button
              type="button"
              onClick={onOpenSignup}
              className="text-xs font-bold text-[#6E8F45] hover:underline cursor-pointer"
              id="store-login-open-signup-btn"
            >
              Register & Setup a New Restaurant Store →
            </button>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#EAE5DA] py-4 text-center text-xs text-[#787F74]">
        <p>Veggie POS • Encrypted Multi-Tenant Terminal Gateway</p>
      </footer>

      {/* QR Scanner Modal */}
      <QrScannerModal
        isOpen={showQrModal}
        onClose={() => setShowQrModal(false)}
        onRestaurantSelected={(selectedTenant) => {
          onSelectTenant(selectedTenant);
          setShowQrModal(false);
        }}
      />

    </div>
  );
}
