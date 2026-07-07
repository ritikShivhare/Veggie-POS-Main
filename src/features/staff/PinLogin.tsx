import React, { useState, useEffect } from "react";
import { StaffMember } from "../shared/types";
import { Lock, User, Check, AlertCircle } from "lucide-react";
import { ApiClient } from "../shared/services/api";

interface PinLoginProps {
  staffList?: StaffMember[];
  onLoginSuccess: (staff: StaffMember, sessionId: string) => void;
  restaurantName: string;
  tenantId: string;
  onBackToLanding?: () => void;
}

export default function PinLogin({ staffList, onLoginSuccess, restaurantName, tenantId, onBackToLanding }: PinLoginProps) {
  const [pin, setPin] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [activeProfiles, setActiveProfiles] = useState<any[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState<boolean>(true);

  useEffect(() => {
    setLoadingProfiles(true);
    ApiClient.getStaffDirectory(tenantId)
      .then((res) => {
        if (res.success && res.staff) {
          setActiveProfiles(res.staff);
        }
      })
      .catch((err) => {
        console.warn("Failed to load active profiles:", err);
      })
      .finally(() => {
        setLoadingProfiles(false);
      });
  }, [tenantId]);

  const triggerLogin = (enteredPin: string) => {
    fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: enteredPin, tenantId })
    })
    .then(async (res) => {
      if (res.status === 423) {
        const data = await res.json();
        setError(data.message);
        setPin("");
        return;
      }
      if (!res.ok) {
        const data = await res.json();
        if (data.locked) {
          setError(`Too many failures. Account locked!`);
        } else {
          setError(`Incorrect passcode. ${data.remainingAttempts} attempts remaining.`);
        }
        setPin("");
        return;
      }
      const result = await res.json();
      if (result.success) {
        onLoginSuccess(result.user, result.session.sessionId);
        setPin("");
      }
    })
    .catch((err) => {
      console.warn("Server connection failed, running in-memory demo validation:", err);
      // Hardcoded fallback for demo and offline scenarios
      const isReetesh = tenantId === "veg-reetesh-dhaba";
      const ownerPin = isReetesh ? "12345" : "11111";
      const ownerName = isReetesh ? "Reetesh" : "Demo Owner";
      const ownerId = isReetesh ? "s-reetesh-dhaba" : "s-owner";
      
      if (enteredPin === ownerPin) {
        onLoginSuccess({ id: ownerId, name: ownerName, role: "Owner", pin: ownerPin, permissions: ["billing", "inventory", "reports", "settings"] }, `sess-local-${Date.now()}`);
        setPin("");
      } else if (enteredPin === "2222") {
        onLoginSuccess({ id: "s-manager", name: "Demo Manager", role: "Manager", pin: "2222", permissions: ["billing", "inventory", "reports"] }, `sess-local-${Date.now()}`);
        setPin("");
      } else if (enteredPin === "3333") {
        onLoginSuccess({ id: "s-cashier", name: "Demo Staff", role: "Staff", pin: "3333", permissions: ["billing"] }, `sess-local-${Date.now()}`);
        setPin("");
      } else if (staffList) {
        // Fallback search in provided list if any exists
        const matchingStaff = staffList.find((s) => s.pin === enteredPin);
        if (matchingStaff) {
          onLoginSuccess(matchingStaff, `sess-local-${Date.now()}`);
          setPin("");
        } else {
          setError("Incorrect PIN. Please try again.");
          setPin("");
        }
      } else {
        setError("Incorrect PIN. Please try again.");
        setPin("");
      }
    });
  };

  const handleKeyPress = (num: string) => {
    setError("");
    if (pin.length < 5) {
      const newPin = pin + num;
      setPin(newPin);
      
      // Auto-validate for 5 digits (Owner PIN length)
      if (newPin.length === 5) {
        triggerLogin(newPin);
      }
    }
  };

  const handleBackspace = () => {
    if (pin.length > 0) {
      setPin(pin.slice(0, -1));
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col justify-center items-center p-4 font-sans text-slate-800 relative overflow-hidden">
      {/* Main Login Card */}
      <div className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl p-6 shadow-lg z-10 animate-fade-in">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-600 rounded-xl shadow-md mb-3 text-white font-extrabold text-xl">
            🥗
          </div>
          <h1 className="text-xl font-display font-extrabold tracking-tight text-slate-800">
            {restaurantName}
          </h1>
          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mt-1">VeggiePOS Terminal Suite</p>
        </div>

        <div className="flex flex-col items-center">
          <h2 className="text-center text-slate-400 font-bold mb-4 text-[10px] uppercase tracking-widest">
            Enter PIN
          </h2>

          {/* Password Dot Indicators */}
          <div className="flex space-x-4 mb-5">
            {[0, 1, 2, 3, 4].map((index) => (
              <div
                key={index}
                className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-150 ${
                  pin.length > index
                    ? "bg-blue-600 border-blue-600 scale-110 shadow-sm"
                    : index === 4
                      ? "border-amber-300 border-dashed bg-amber-50/10"
                      : "border-slate-300 bg-white"
                }`}
                title={index === 4 ? "Owner PIN 5th digit" : undefined}
              />
            ))}
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-center space-x-2 text-rose-600 text-xs mb-4 animate-pulse font-medium text-center">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Quick numeric Keypad */}
          <div className="grid grid-cols-3 gap-2 w-full max-w-[280px] mt-2">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
              <button
                key={num}
                onClick={() => handleKeyPress(num)}
                className="h-12 bg-white hover:bg-slate-50 border border-slate-200 active:scale-95 rounded-xl flex items-center justify-center text-lg font-bold text-slate-800 transition shadow-sm"
                id={`keypad-${num}`}
              >
                {num}
              </button>
            ))}
            
            <button
              onClick={pin.length >= 4 ? () => triggerLogin(pin) : () => setPin("")}
              className={`h-12 text-xs font-bold rounded-xl flex items-center justify-center transition border ${
                pin.length >= 4
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 shadow-md shadow-emerald-500/15 cursor-pointer"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 border-slate-200/40"
              }`}
              id="keypad-ok-clear"
            >
              {pin.length >= 4 ? "OK / Login" : "Clear"}
            </button>
            
            <button
              onClick={() => handleKeyPress("0")}
              className="h-12 bg-white hover:bg-slate-50 border border-slate-200 active:scale-95 rounded-xl flex items-center justify-center text-lg font-bold text-slate-800 transition shadow-sm"
              id={`keypad-0`}
            >
              0
            </button>
            
            <button
              onClick={handleBackspace}
              className="h-12 bg-slate-100 hover:bg-slate-200 text-rose-600 hover:text-rose-700 rounded-xl flex items-center justify-center transition border border-slate-200/40"
              id="keypad-backspace"
            >
              ⌫
            </button>
          </div>

          {onBackToLanding && (
            <button
              onClick={onBackToLanding}
              className="mt-4 w-full py-2.5 border border-slate-200 hover:border-slate-350 text-slate-500 hover:text-slate-800 font-bold text-xs rounded-xl transition bg-white cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
              id="pin-login-back-to-landing-btn"
            >
              ← Back to Main Website
            </button>
          )}
        </div>
      </div>

      {/* Active Profiles Section */}
      {activeProfiles.length > 0 && (
        <div className="mt-6 w-full max-w-sm text-center z-10 animate-fade-in">
          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-3">Active Terminal Profiles</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {activeProfiles.map((p) => (
              <div
                key={p.id}
                className="flex items-center space-x-2 bg-white border border-slate-200 px-2.5 py-1.5 rounded-xl text-xs font-semibold shadow-sm hover:border-blue-500/50 transition duration-150 cursor-pointer"
                onClick={() => setError("")}
              >
                <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[10px] border border-slate-200 text-slate-500 font-bold shrink-0">
                  {p.name ? p.name.charAt(0) : "S"}
                </div>
                <div className="text-left">
                  <p className="text-slate-700 font-bold leading-none">{p.name}</p>
                  <p className="text-[9px] text-slate-400 font-medium leading-none mt-0.5">{p.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 text-center text-slate-400 text-[11px] font-medium max-w-sm">
        <p className="leading-relaxed space-x-1">
          <span>Quick Fill PIN:</span>
          <button
            onClick={() => {
              const p = tenantId === "veg-reetesh-dhaba" ? "12345" : "11111";
              setPin(p);
              triggerLogin(p);
            }}
            className="bg-white hover:bg-pink-50 border border-slate-200 px-1.5 py-0.5 rounded text-slate-600 font-mono font-bold active:scale-95 transition cursor-pointer inline-block"
          >
            Owner ({tenantId === "veg-reetesh-dhaba" ? "12345" : "11111"})
          </button>
          <span>|</span>
          <button
            onClick={() => {
              setPin("2222");
              triggerLogin("2222");
            }}
            className="bg-white hover:bg-pink-50 border border-slate-200 px-1.5 py-0.5 rounded text-slate-600 font-mono font-bold active:scale-95 transition cursor-pointer inline-block"
          >
            Manager (2222)
          </button>
          <span>|</span>
          <button
            onClick={() => {
              setPin("3333");
              triggerLogin("3333");
            }}
            className="bg-white hover:bg-pink-50 border border-slate-200 px-1.5 py-0.5 rounded text-slate-600 font-mono font-bold active:scale-95 transition cursor-pointer inline-block"
          >
            Staff (3333)
          </button>
        </p>
      </div>
    </div>
  );
}
