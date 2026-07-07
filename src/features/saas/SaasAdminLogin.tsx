import React, { useState } from "react";
import { Crown, AlertTriangle, RefreshCw } from "lucide-react";
import { StaffMember } from "../shared/types";

interface SaasAdminLoginProps {
  currentStaff: StaffMember | null;
  setCurrentStaff: (staff: StaffMember | null) => void;
  setCurrentSessionId: (sessId: string | null) => void;
  setActiveTab: (tab: string) => void;
  setShowAdminPanel: (show: boolean) => void;
}

export default function SaasAdminLogin({
  currentStaff,
  setCurrentStaff,
  setCurrentSessionId,
  setActiveTab,
  setShowAdminPanel
}: SaasAdminLoginProps) {
  // SaaS Owner Multi-Factor Authentication State
  const [mfaRequire, setMfaRequire] = useState<{ pin: string; secret: string; testToken: string } | null>(null);
  const [mfaCode, setMfaCode] = useState<string>("");
  const [mfaError, setMfaError] = useState<string>("");

  const isSaaSSubdomain = () => {
    const hostname = window.location.hostname;
    const searchParams = new URLSearchParams(window.location.search);
    const hasSaasParam = searchParams.get("subdomain") === "saas" || searchParams.get("subdomain") === "admin";
    
    return (
      hostname.startsWith("saas.") || 
      hostname.startsWith("admin.") || 
      hostname.includes("saas-admin") ||
      hasSaasParam
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-100 font-sans">
      <div className="w-full max-w-md bg-slate-900 rounded-3xl border border-slate-800 p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-pink-500/10 rounded-full blur-2xl" />
        <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-indigo-500/10 rounded-full blur-2xl" />

        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 bg-gradient-to-tr from-pink-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-pink-500/20 mb-4">
            <Crown className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white">
            {mfaRequire ? "MFA Verification" : "Super-Admin Console"}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {mfaRequire ? "Google Authenticator Style Second Factor" : "SaaS Owner Authentication Required"}
          </p>
        </div>

        {mfaRequire ? (
          <form onSubmit={async (e) => {
            e.preventDefault();
            try {
              const res = await fetch("/api/saas-admin/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pin: mfaRequire.pin, totp: mfaCode })
              });
              const data = await res.json();
              if (data.success && data.user?.role === "SaaS Owner") {
                localStorage.setItem("veggiepos_current_session_id", data.session.sessionId);
                localStorage.setItem("veggiepos_current_staff", JSON.stringify(data.user));
                setCurrentSessionId(data.session.sessionId);
                setCurrentStaff(data.user);
                setActiveTab("saas-admin");
                setMfaRequire(null);
                setMfaCode("");
                setMfaError("");
                alert("Access Granted. Welcome, SaaS Owner!");
              } else {
                setMfaError(data.message || "Invalid Verification Code. Access Denied.");
              }
            } catch (err: any) {
              setMfaError(err.message || "Connection error.");
            }
          }} className="space-y-5">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase font-mono text-slate-400 tracking-wider block text-center">
                Enter 6-Digit Authenticator Code
              </label>
              <input
                type="text"
                maxLength={6}
                required
                value={mfaCode}
                onChange={(e) => {
                  setMfaCode(e.target.value.replace(/\D/g, ""));
                  setMfaError("");
                }}
                placeholder="000000"
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3 px-4 text-center text-xl tracking-[0.8em] font-mono text-white focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all"
              />
              {mfaError && (
                <p className="text-red-500 text-[11px] font-semibold text-center mt-1">
                  {mfaError}
                </p>
              )}
            </div>

            {/* QR Code and Manual Setup Key Box */}
            <div className="bg-slate-950/65 rounded-2xl p-4 border border-slate-800 space-y-3">
              <div className="text-[10px] font-bold uppercase font-mono text-slate-400 tracking-wider">
                Google Authenticator Setup
              </div>
              
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <div className="bg-white p-1.5 rounded-xl flex items-center justify-center shrink-0">
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=otpauth%3A%2F%2Ftotp%2FVeggiePOS%3ASaaS-Owner%3Fsecret%3D${mfaRequire.secret}%26issuer%3DVeggiePOS`} 
                    alt="TOTP QR Code" 
                    className="w-[100px] h-[100px]"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="space-y-1 text-left">
                  <p className="text-[11px] text-slate-400 leading-normal">
                    Scan this QR code with Google Authenticator or enter the key manually:
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="bg-slate-900 px-2 py-1 rounded text-pink-400 text-[10px] font-mono font-bold select-all break-all block">
                      {mfaRequire.secret}
                    </code>
                  </div>
                </div>
              </div>
            </div>

            {/* Test Assistance Box */}
            <div className="bg-indigo-950/25 border border-indigo-900/50 rounded-2xl p-4 flex flex-col items-center gap-2">
              <span className="text-[10px] font-bold uppercase font-mono text-indigo-300 tracking-wider">
                Testing Assistant
              </span>
              <div className="flex items-center justify-between w-full">
                <span className="text-[11px] text-slate-400 font-mono">Current Live OTP:</span>
                <code className="text-sm font-bold text-indigo-400 font-mono tracking-wider">
                  {mfaRequire.testToken}
                </code>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMfaCode(mfaRequire.testToken);
                  setMfaError("");
                }}
                className="w-full py-1.5 bg-indigo-900/40 hover:bg-indigo-900/60 border border-indigo-700/30 text-indigo-200 rounded-xl text-[10px] font-bold transition duration-150 active:scale-95 cursor-pointer"
              >
                Auto-Fill Current OTP Code
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setMfaRequire(null);
                  setMfaCode("");
                  setMfaError("");
                }}
                className="py-3 bg-transparent hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 rounded-2xl text-xs font-semibold transition cursor-pointer"
              >
                Back to PIN
              </button>
              <button
                type="submit"
                className="py-3 bg-gradient-to-r from-pink-600 to-indigo-600 hover:from-pink-700 hover:to-indigo-700 text-white rounded-2xl text-xs font-bold transition shadow-md shadow-pink-500/10 cursor-pointer"
              >
                Verify & Login
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={async (e) => {
            e.preventDefault();
            const inputPin = (e.currentTarget.elements.namedItem("adminPin") as HTMLInputElement).value;
            try {
              const res = await fetch("/api/saas-admin/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pin: inputPin })
              });
              const data = await res.json();
              if (data.success) {
                if (data.require2FA) {
                  setMfaRequire({
                    pin: inputPin,
                    secret: data.totpSecret,
                    testToken: data.testToken
                  });
                  setMfaCode("");
                  setMfaError("");
                } else if (data.user?.role === "SaaS Owner") {
                  localStorage.setItem("veggiepos_current_session_id", data.session.sessionId);
                  localStorage.setItem("veggiepos_current_staff", JSON.stringify(data.user));
                  setCurrentSessionId(data.session.sessionId);
                  setCurrentStaff(data.user);
                  setActiveTab("saas-admin");
                  alert("Access Granted. Welcome, SaaS Owner!");
                } else {
                  alert(data.message || "Invalid response. Access Denied.");
                }
              } else {
                alert(data.message || "Invalid Super-Admin PIN. Access Denied.");
              }
            } catch (err: any) {
              alert(err.message || "Connection error.");
            }
          }} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase font-mono text-slate-400 tracking-wider">Enter Admin PIN passcode</label>
              <input
                name="adminPin"
                type="password"
                maxLength={5}
                required
                placeholder="•••••"
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3 px-4 text-center text-xl tracking-[1.5em] font-mono text-white focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3.5 bg-gradient-to-r from-pink-600 to-indigo-600 hover:from-pink-700 hover:to-indigo-700 text-white rounded-2xl text-xs font-bold transition-all shadow-md shadow-pink-500/10 cursor-pointer"
            >
              Unlock SaaS Dashboard
            </button>

            {!isSaaSSubdomain() && (
              <button
                type="button"
                onClick={() => {
                  setShowAdminPanel(false);
                  window.history.pushState({}, "", "/");
                }}
                className="w-full py-2.5 bg-transparent hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-2xl text-xs font-semibold transition cursor-pointer"
              >
                Cancel & Return
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
