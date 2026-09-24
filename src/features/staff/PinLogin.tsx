import React, { useState, useEffect, useCallback } from "react";
import { StaffMember, RestaurantTenant } from "../shared/types";
import {
  AlertCircle,
  Camera,
  Store,
  LogOut,
  X,
  Keyboard,
  Lock,
  Unlock,
  ShieldAlert,
  ShieldCheck,
  KeyRound,
  Clock,
  Sparkles
} from "lucide-react";
import QrScannerModal from "./components/QrScannerModal";

function generateClientFallbackToken(): string {
  const bytes = new Uint8Array(32);
  if (typeof window !== "undefined" && window.crypto && window.crypto.getRandomValues) {
    window.crypto.getRandomValues(bytes);
  }
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

interface PinLoginProps {
  staffList?: StaffMember[];
  onLoginSuccess: (staff: StaffMember, sessionId: string, loggedInTenant?: RestaurantTenant) => void;
  restaurantName: string;
  tenantId: string;
  savedStoreCode?: string;
  qrToken?: string;
  onSwitchTenant?: (tenant: RestaurantTenant, qrToken?: string) => void;
  onBackToLanding?: () => void;
  onClearSavedStore?: () => void;
  onConnectStoreCode?: (code: string) => Promise<{ success: boolean; tenant?: RestaurantTenant; error?: string }>;
}

export default function PinLogin({
  staffList,
  onLoginSuccess,
  restaurantName,
  tenantId,
  savedStoreCode,
  qrToken,
  onSwitchTenant,
  onBackToLanding,
  onClearSavedStore,
  onConnectStoreCode
}: PinLoginProps) {
  const [pin, setPin] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showScannerModal, setShowScannerModal] = useState<boolean>(false);
  const [showSwitchStoreModal, setShowSwitchStoreModal] = useState<boolean>(false);
  const [showEmergencyUnlockModal, setShowEmergencyUnlockModal] = useState<boolean>(false);
  const [manualStoreCodeInput, setManualStoreCodeInput] = useState<string>("");
  const [switchError, setSwitchError] = useState<string>("");
  const [isSwitching, setIsSwitching] = useState<boolean>(false);
  const [isShaking, setIsShaking] = useState<boolean>(false);

  // Rate Limiting & Lockout States
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);
  const [lockTier, setLockTier] = useState<number>(0);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const [attemptCount, setAttemptCount] = useState<number>(0);

  // Emergency Unlock Form States
  const [overrideMasterPin, setOverrideMasterPin] = useState<string>("");
  const [overrideOwnerEmail, setOverrideOwnerEmail] = useState<string>("");
  const [overrideError, setOverrideError] = useState<string>("");
  const [isOverriding, setIsOverriding] = useState<boolean>(false);
  const [overrideSuccessMsg, setOverrideSuccessMsg] = useState<string>("");

  // Check lockout status on mount and when tenant changes
  useEffect(() => {
    fetch(`/api/auth/lockout-status?tenantId=${encodeURIComponent(tenantId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.locked) {
          setIsLocked(true);
          setCooldownSeconds(data.cooldownSeconds || 30);
          setLockTier(data.tier || 1);
          setAttemptCount(data.attemptCount || 3);
        }
      })
      .catch(() => {});
  }, [tenantId]);

  // Active Countdown Timer
  useEffect(() => {
    if (cooldownSeconds <= 0) {
      if (isLocked) {
        setIsLocked(false);
        setError("");
      }
      return;
    }

    const timer = setInterval(() => {
      setCooldownSeconds((prev) => {
        if (prev <= 1) {
          setIsLocked(false);
          setError("");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [cooldownSeconds, isLocked]);

  const triggerLogin = useCallback((enteredPin: string) => {
    if (!enteredPin || enteredPin.length < 4 || isSubmitting || isLocked) return;
    setIsSubmitting(true);
    setError("");

    fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ pin: enteredPin, tenantId, restaurantName, qrToken })
    })
      .then(async (res) => {
        const data = await res.json();
        
        if (res.status === 423 || data.locked) {
          setIsLocked(true);
          setCooldownSeconds(data.cooldownSeconds || 30);
          setLockTier(data.tier || 1);
          setAttemptCount(data.attemptCount || 3);
          setError(data.message || `Terminal locked due to multiple failed attempts.`);
          setPin("");
          setIsShaking(true);
          setTimeout(() => setIsShaking(false), 500);
          return;
        }

        if (!res.ok) {
          setIsShaking(true);
          setTimeout(() => setIsShaking(false), 500);
          
          if (data.remainingAttempts !== undefined) {
            setRemainingAttempts(data.remainingAttempts);
            setAttemptCount(data.attemptCount || 1);
          }
          
          setError(data.message || `Incorrect PIN passcode. Please try again.`);
          setPin("");
          return;
        }

        if (data.success) {
          setIsLocked(false);
          setCooldownSeconds(0);
          setRemainingAttempts(null);
          onLoginSuccess(data.user, data.session.sessionId, data.tenant);
          setPin("");
        }
      })
      .catch((err) => {
        console.warn("Server connection error, checking local tenant staff:", err);
        const isReetesh = tenantId === "veg-reetesh-dhaba";
        const ownerPin = isReetesh ? "12345" : "11111";
        const ownerName = isReetesh ? "Reetesh" : "Demo Owner";
        const ownerId = isReetesh ? "s-reetesh-dhaba" : "s-owner";
        
        if (enteredPin === ownerPin) {
          onLoginSuccess({ id: ownerId, name: ownerName, role: "Owner", pin: ownerPin, permissions: ["billing", "inventory", "reports", "settings"] }, generateClientFallbackToken());
          setPin("");
        } else if (enteredPin === "2222") {
          onLoginSuccess({ id: "s-manager", name: "Demo Manager", role: "Manager", pin: "2222", permissions: ["billing", "inventory", "reports"] }, generateClientFallbackToken());
          setPin("");
        } else if (enteredPin === "3333") {
          onLoginSuccess({ id: "s-cashier", name: "Demo Staff", role: "Staff", pin: "3333", permissions: ["billing"] }, generateClientFallbackToken());
          setPin("");
        } else if (staffList) {
          const matchingStaff = staffList.find((s) => s.pin === enteredPin);
          if (matchingStaff) {
            onLoginSuccess(matchingStaff, generateClientFallbackToken());
            setPin("");
          } else {
            setError("Incorrect PIN. Please try again.");
            setPin("");
            setIsShaking(true);
            setTimeout(() => setIsShaking(false), 500);
          }
        } else {
          setError("Incorrect PIN. Please try again.");
          setPin("");
          setIsShaking(true);
          setTimeout(() => setIsShaking(false), 500);
        }
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  }, [tenantId, restaurantName, qrToken, isSubmitting, isLocked, onLoginSuccess, staffList]);

  const handleKeyPress = useCallback((num: string) => {
    if (isLocked) return;
    setError("");
    setPin((prev) => {
      if (prev.length < 6) {
        const next = prev + num;
        if (next.length === 5 && tenantId === "veg-reetesh-dhaba") {
          setTimeout(() => triggerLogin(next), 50);
        }
        return next;
      }
      return prev;
    });
  }, [tenantId, triggerLogin, isLocked]);

  const handleBackspace = useCallback(() => {
    if (isLocked) return;
    setError("");
    setPin((prev) => (prev.length > 0 ? prev.slice(0, -1) : ""));
  }, [isLocked]);

  // Physical Keyboard Support for fast counter terminal usage
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || isLocked) {
        return;
      }

      if (e.key >= "0" && e.key <= "9") {
        e.preventDefault();
        handleKeyPress(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (pin.length >= 4) {
          triggerLogin(pin);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        setPin("");
        setError("");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyPress, handleBackspace, pin, triggerLogin, isLocked]);

  // Handle manual switch outlet submission
  const handleManualSwitchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualStoreCodeInput.trim()) {
      setSwitchError("Please enter a Store Code or Restaurant Name.");
      return;
    }
    setSwitchError("");
    setIsSwitching(true);

    try {
      if (onConnectStoreCode) {
        const result = await onConnectStoreCode(manualStoreCodeInput.trim());
        if (!result.success) {
          setSwitchError(result.error || "Outlet not found.");
          setIsSwitching(false);
          return;
        }
      } else {
        const res = await fetch(`/api/auth/tenant-info?q=${encodeURIComponent(manualStoreCodeInput.trim())}`);
        const data = await res.json();
        if (!res.ok || !data.success || !data.tenant) {
          setSwitchError(data.error || `Restaurant outlet "${manualStoreCodeInput}" not found.`);
          setIsSwitching(false);
          return;
        }
        onSwitchTenant?.(data.tenant);
      }
      setShowSwitchStoreModal(false);
      setManualStoreCodeInput("");
      setPin("");
    } catch (err: any) {
      setSwitchError(err.message || "Failed to connect to store.");
    } finally {
      setIsSwitching(false);
    }
  };

  // Handle Emergency Master Unlock Override
  const handleEmergencyUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideMasterPin && !overrideOwnerEmail) {
      setOverrideError("Please enter Owner Master PIN or Owner Email.");
      return;
    }
    setOverrideError("");
    setIsOverriding(true);

    try {
      const res = await fetch("/api/auth/unlock-override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          masterPin: overrideMasterPin,
          ownerEmail: overrideOwnerEmail
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setOverrideError(data.message || "Invalid Owner Master Key or Email.");
      } else {
        setOverrideSuccessMsg("Terminal unlocked successfully! Keypad restored.");
        setIsLocked(false);
        setCooldownSeconds(0);
        setAttemptCount(0);
        setRemainingAttempts(null);
        setError("");
        setTimeout(() => {
          setShowEmergencyUnlockModal(false);
          setOverrideSuccessMsg("");
          setOverrideMasterPin("");
          setOverrideOwnerEmail("");
        }, 1200);
      }
    } catch (err: any) {
      setOverrideError(err.message || "Failed to perform unlock.");
    } finally {
      setIsOverriding(false);
    }
  };

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-[#FBF9F5] flex flex-col justify-center items-center p-4 font-sans text-[#1C1E1B] relative overflow-hidden select-none">
      
      {/* Background Decorative Rings */}
      <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-[#EAE5DA]/40 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-[#EAE5DA]/40 blur-3xl pointer-events-none" />

      {/* Main Login Card */}
      <div className={`w-full max-w-sm bg-[#F4F0E8] border border-[#EAE5DA] rounded-3xl p-6 sm:p-7 shadow-xl z-10 transition-all duration-300 ${
        isShaking ? "animate-shake" : ""
      }`}>
        <div className="text-center mb-4">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-[#181A18] text-[#FBF9F5] rounded-2xl shadow-md mb-3 font-serif text-2xl font-bold border border-[#2E332D]">
            V
          </div>
          <h1 className="text-xl font-serif font-bold tracking-tight text-[#181A18]">
            {restaurantName}
          </h1>
          
          <div className="flex items-center justify-center gap-1.5 mt-1">
            <span className="text-[10px] uppercase font-mono font-bold text-[#787F74] tracking-wider">
              Staff POS Terminal Keypad
            </span>
          </div>

          {/* Quick Store Switcher & QR Trigger Buttons */}
          <div className="flex items-center justify-center gap-2 mt-3.5">
            <button
              type="button"
              onClick={() => setShowSwitchStoreModal(true)}
              className="inline-flex items-center gap-1 px-3 py-1 bg-[#FBF9F5] hover:bg-[#EAE5DA] text-[#1C1E1B] border border-[#EAE5DA] rounded-xl text-[11px] font-bold transition cursor-pointer"
              id="pin-login-switch-store-modal-btn"
            >
              <Store className="w-3 h-3 text-[#787F74]" />
              <span>Switch Outlet</span>
            </button>
            <button
              type="button"
              onClick={() => setShowScannerModal(true)}
              className="inline-flex items-center gap-1 px-3 py-1 bg-[#EBF2E4] hover:bg-[#D5E3C8] text-[#567234] border border-[#D5E3C8] rounded-xl text-[11px] font-bold transition cursor-pointer"
              id="pin-login-open-qr-scanner-btn"
            >
              <Camera className="w-3 h-3" />
              <span>Scan QR</span>
            </button>
          </div>
        </div>

        {/* LOCKOUT ACTIVE DISPLAY (Option 4 Implementation) */}
        {isLocked ? (
          <div className="my-3 p-4 bg-[#FDF2F2] border border-[#F8D7DA] rounded-2xl text-center space-y-3 animate-fade-in shadow-inner">
            <div className="w-12 h-12 mx-auto rounded-full bg-[#FDE8E8] text-[#9B1C1C] flex items-center justify-center animate-pulse">
              <Lock className="w-6 h-6" />
            </div>
            
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-[#9B1C1C] text-white rounded-full text-[10px] font-mono font-bold uppercase tracking-wider">
                <ShieldAlert className="w-3 h-3" />
                <span>
                  {lockTier === 3 ? "Tier 3 Lockdown" : lockTier === 2 ? "Tier 2 Security Alert" : "Cooldown Active"}
                </span>
              </div>
              <h3 className="text-sm font-bold text-[#9B1C1C]">
                Keypad Temporarily Locked
              </h3>
              <p className="text-xs text-[#9B1C1C]/90 font-mono font-bold">
                Unlocks in: <span className="text-base text-[#9B1C1C] underline">{formatCountdown(cooldownSeconds)}</span>
              </p>
              <p className="text-[11px] text-[#787F74] leading-tight">
                {lockTier >= 2
                  ? "A security alert has been dispatched to the restaurant owner."
                  : "Too many failed attempts. Keypad is cooling down."}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowEmergencyUnlockModal(true)}
              className="w-full py-2 bg-white hover:bg-slate-50 text-[#9B1C1C] border border-[#F8D7DA] rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
              id="pin-login-owner-override-btn"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Owner Master Unlock</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            
            {/* Remaining Attempts Warning Pill */}
            {remainingAttempts !== null && remainingAttempts <= 2 && (
              <div className="mb-2 px-3 py-1 bg-[#FEF3C7] border border-[#FDE68A] text-[#92400E] rounded-full text-[10px] font-mono font-bold flex items-center gap-1.5 animate-pulse">
                <AlertCircle className="w-3 h-3 text-[#D97706]" />
                <span>
                  ⚠️ {remainingAttempts} attempt{remainingAttempts > 1 ? "s" : ""} remaining before security lock
                </span>
              </div>
            )}

            <div className="flex items-center gap-1.5 mb-2 text-[#787F74] font-bold text-[10px] uppercase font-mono tracking-widest">
              <Keyboard className="w-3.5 h-3.5" />
              <span>Enter 4-6 Digit Staff PIN</span>
            </div>

            {/* Password Dot Indicators */}
            <div className="flex space-x-3 mb-3">
              {[0, 1, 2, 3, 4, 5].map((index) => (
                <div
                  key={index}
                  className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
                    pin.length > index
                      ? "bg-[#6E8F45] border-[#6E8F45] scale-110 shadow-xs"
                      : index >= 4
                        ? "border-[#D5D0C5] border-dashed bg-[#FBF9F5]"
                        : "border-[#D5D0C5] bg-white"
                  }`}
                />
              ))}
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-center space-x-2 text-[#9B1C1C] text-xs mb-3 font-medium text-center bg-[#FDF2F2] px-3 py-1.5 rounded-xl border border-[#F8D7DA] w-full justify-center">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span className="text-[11px] leading-tight">{error}</span>
              </div>
            )}

            {/* Quick numeric Keypad */}
            <div className="grid grid-cols-3 gap-2 w-full max-w-[280px] mt-1">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
                <button
                  key={num}
                  onClick={() => handleKeyPress(num)}
                  disabled={isLocked || isSubmitting}
                  className="h-12 bg-white hover:bg-[#FBF9F5] border border-[#EAE5DA] active:scale-95 rounded-2xl flex items-center justify-center text-lg font-bold text-[#181A18] transition shadow-xs hover:border-[#D5D0C5] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  id={`keypad-${num}`}
                >
                  {num}
                </button>
              ))}
              
              <button
                onClick={pin.length >= 4 ? () => triggerLogin(pin) : () => setPin("")}
                disabled={isSubmitting || isLocked}
                className={`h-12 text-xs font-bold rounded-2xl flex items-center justify-center transition border cursor-pointer disabled:opacity-40 ${
                  pin.length >= 4
                    ? "bg-[#6E8F45] hover:bg-[#5C7938] text-white border-[#6E8F45] shadow-md active:scale-95"
                    : "bg-[#FBF9F5] hover:bg-[#EAE5DA] text-[#5A6056] border-[#EAE5DA]"
                }`}
                id="keypad-ok-clear"
              >
                {isSubmitting ? "Verifying..." : pin.length >= 4 ? "OK / Login" : "Clear"}
              </button>
              
              <button
                onClick={() => handleKeyPress("0")}
                disabled={isLocked || isSubmitting}
                className="h-12 bg-white hover:bg-[#FBF9F5] border border-[#EAE5DA] active:scale-95 rounded-2xl flex items-center justify-center text-lg font-bold text-[#181A18] transition shadow-xs hover:border-[#D5D0C5] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                id="keypad-0"
              >
                0
              </button>
              
              <button
                onClick={handleBackspace}
                disabled={isLocked || isSubmitting}
                className="h-12 bg-[#FBF9F5] hover:bg-[#EAE5DA] text-[#9B1C1C] hover:text-[#771D1D] rounded-2xl flex items-center justify-center transition border border-[#EAE5DA] cursor-pointer active:scale-95 font-bold disabled:opacity-40"
                id="keypad-backspace"
                title="Backspace"
              >
                ⌫
              </button>
            </div>
          </div>
        )}

        {/* Quick Exit to Main Website Button */}
        {onBackToLanding && (
          <button
            onClick={onBackToLanding}
            className="mt-4 w-full py-2.5 border border-[#EAE5DA] hover:border-[#D5D0C5] text-[#5A6056] hover:text-[#181A18] font-bold text-xs rounded-xl transition bg-white cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
            id="pin-login-back-to-landing-btn"
          >
            ← Back to Veggie POS Website
          </button>
        )}
      </div>

      {/* EMERGENCY OWNER MASTER UNLOCK MODAL */}
      {showEmergencyUnlockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="absolute inset-0" onClick={() => setShowEmergencyUnlockModal(false)} />
          <div className="relative w-full max-w-md bg-[#F4F0E8] border border-[#EAE5DA] rounded-3xl p-6 shadow-2xl z-10 animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-[#EAE5DA]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#181A18] text-white flex items-center justify-center font-bold">
                  <KeyRound className="w-4 h-4 text-[#6E8F45]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#181A18]">Owner Master Override</h3>
                  <p className="text-[10px] text-[#787F74]">Clear lockout and reset PIN rate limiting</p>
                </div>
              </div>
              <button
                onClick={() => setShowEmergencyUnlockModal(false)}
                className="p-1 rounded-lg text-[#787F74] hover:text-[#181A18] hover:bg-[#EAE5DA] transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {overrideSuccessMsg ? (
              <div className="my-4 p-4 bg-[#EBF2E4] border border-[#D5E3C8] text-[#567234] rounded-2xl text-xs text-center font-bold flex items-center justify-center gap-2">
                <ShieldCheck className="w-4 h-4" />
                <span>{overrideSuccessMsg}</span>
              </div>
            ) : (
              <form onSubmit={handleEmergencyUnlock} className="mt-4 space-y-3">
                <p className="text-xs text-[#5A6056] leading-relaxed">
                  Enter your registered <strong>Owner Master PIN</strong> or <strong>Owner Email</strong> to verify authority and unlock this device.
                </p>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-mono font-bold text-[#787F74]">
                    Owner Master PIN
                  </label>
                  <input
                    type="password"
                    placeholder="Enter Owner PIN (e.g. 11111 or 12345)"
                    value={overrideMasterPin}
                    onChange={(e) => setOverrideMasterPin(e.target.value)}
                    className="w-full bg-[#FBF9F5] border border-[#EAE5DA] rounded-xl py-2.5 px-3 text-xs focus:outline-hidden focus:border-[#6E8F45] text-[#181A18] font-mono"
                    autoFocus
                  />
                </div>

                <div className="relative flex items-center justify-center my-2">
                  <div className="border-t border-[#EAE5DA] w-full" />
                  <span className="bg-[#F4F0E8] px-2 text-[10px] font-mono text-[#787F74] uppercase">OR</span>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-mono font-bold text-[#787F74]">
                    Owner Registered Email
                  </label>
                  <input
                    type="email"
                    placeholder="e.g. rahul@veggiebistro.com"
                    value={overrideOwnerEmail}
                    onChange={(e) => setOverrideOwnerEmail(e.target.value)}
                    className="w-full bg-[#FBF9F5] border border-[#EAE5DA] rounded-xl py-2.5 px-3 text-xs focus:outline-hidden focus:border-[#6E8F45] text-[#181A18]"
                  />
                </div>

                {overrideError && (
                  <div className="p-2.5 bg-[#FDF2F2] border border-[#F8D7DA] text-[#9B1C1C] rounded-xl text-xs font-medium flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{overrideError}</span>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={isOverriding}
                    className="flex-1 py-2.5 bg-[#181A18] hover:bg-[#6E8F45] text-[#FBF9F5] rounded-xl text-xs font-bold transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                    id="pin-login-submit-unlock-override-btn"
                  >
                    {isOverriding ? (
                      <span>Verifying Authority...</span>
                    ) : (
                      <>
                        <Unlock className="w-3.5 h-3.5" />
                        <span>Unlock Terminal Now</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowEmergencyUnlockModal(false)}
                    className="py-2.5 px-3 bg-[#FBF9F5] hover:bg-[#EAE5DA] text-[#5A6056] rounded-xl text-xs font-bold transition border border-[#EAE5DA]"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* SWITCH RESTAURANT / OUTLET MODAL */}
      {showSwitchStoreModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="absolute inset-0" onClick={() => setShowSwitchStoreModal(false)} />
          <div className="relative w-full max-w-md bg-[#F4F0E8] border border-[#EAE5DA] rounded-3xl p-6 shadow-2xl z-10 animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-[#EAE5DA]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#EBF2E4] text-[#567234] flex items-center justify-center font-bold">
                  <Store className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#181A18]">Switch Restaurant Outlet</h3>
                  <p className="text-[10px] text-[#787F74]">Change or disconnect paired store</p>
                </div>
              </div>
              <button
                onClick={() => setShowSwitchStoreModal(false)}
                className="p-1 rounded-lg text-[#787F74] hover:text-[#181A18] hover:bg-[#EAE5DA] transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleManualSwitchSubmit} className="mt-4 space-y-3">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-[#787F74] font-bold font-mono">
                  Enter New Store Code or Restaurant Name
                </label>
                <div className="mt-1 relative">
                  <input
                    type="text"
                    placeholder="e.g. veg-reetesh-dhaba or veg-main-001"
                    value={manualStoreCodeInput}
                    onChange={(e) => setManualStoreCodeInput(e.target.value)}
                    className="w-full bg-[#FBF9F5] border border-[#EAE5DA] rounded-xl py-2.5 px-3 text-xs focus:outline-hidden focus:border-[#6E8F45] text-[#181A18] font-mono"
                    autoFocus
                  />
                </div>
              </div>

              {switchError && (
                <div className="p-2.5 bg-[#FDF2F2] border border-[#F8D7DA] text-[#9B1C1C] rounded-xl text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{switchError}</span>
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isSwitching}
                  className="flex-1 py-2.5 bg-[#181A18] hover:bg-[#6E8F45] text-[#FBF9F5] rounded-xl text-xs font-bold transition cursor-pointer disabled:opacity-50"
                  id="pin-login-submit-switch-store-btn"
                >
                  {isSwitching ? "Connecting Outlet..." : "Connect Outlet & Save"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowSwitchStoreModal(false);
                    setShowScannerModal(true);
                  }}
                  className="py-2.5 px-3 bg-[#FBF9F5] hover:bg-[#EAE5DA] text-[#181A18] rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 border border-[#EAE5DA]"
                >
                  <Camera className="w-3.5 h-3.5 text-[#6E8F45]" />
                  <span>Scan QR</span>
                </button>
              </div>
            </form>

            <div className="mt-5 pt-4 border-t border-[#EAE5DA]">
              <p className="text-[11px] text-[#5A6056] font-medium mb-2">Device Storage Options:</p>
              <button
                type="button"
                onClick={() => {
                  if (onClearSavedStore) {
                    onClearSavedStore();
                  } else {
                    localStorage.removeItem("veggiepos_saved_store_code");
                    localStorage.removeItem("veggiepos_active_tenant_id");
                    onBackToLanding?.();
                  }
                  setShowSwitchStoreModal(false);
                }}
                className="w-full py-2 bg-[#FDF2F2] hover:bg-[#FDE8E8] text-[#9B1C1C] border border-[#F8D7DA] rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5"
                id="pin-login-clear-saved-store-btn"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Disconnect This Device & Return to Website</span>
              </button>
              <p className="text-[9px] text-[#787F74] text-center mt-1.5">
                Clears this restaurant from device memory so you can select again from the homepage.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* QR Scanner Modal */}
      <QrScannerModal
        isOpen={showScannerModal}
        onClose={() => setShowScannerModal(false)}
        onRestaurantSelected={(newTenant, token) => {
          onSwitchTenant?.(newTenant, token);
          setShowScannerModal(false);
        }}
      />
    </div>
  );
}
