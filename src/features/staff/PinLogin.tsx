import React, { useState } from "react";
import { StaffMember } from "../shared/types";
import { Lock, User, Check, AlertCircle } from "lucide-react";

interface PinLoginProps {
  staffList: StaffMember[];
  onLoginSuccess: (staff: StaffMember, sessionId: string) => void;
  restaurantName: string;
  tenantId: string;
  onBackToLanding?: () => void;
}

export default function PinLogin({ staffList, onLoginSuccess, restaurantName, tenantId, onBackToLanding }: PinLoginProps) {
  const [pin, setPin] = useState<string>("");
  const [error, setError] = useState<string>("");

  const handleKeyPress = (num: string) => {
    setError("");
    if (pin.length < 4) {
      const newPin = pin + num;
      setPin(newPin);
      
      // Auto-validate if 4 digits are reached using server-side auth
      if (newPin.length === 4) {
        fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin: newPin, tenantId })
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
          const matchingStaff = staffList.find((s) => s.pin === newPin);
          if (matchingStaff) {
            onLoginSuccess(matchingStaff, `sess-local-${Date.now()}`);
            setPin("");
          } else {
            setError("Incorrect PIN. Please try again.");
            setPin("");
          }
        });
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
            Enter 4-Digit Passcode
          </h2>

          {/* Password Dot Indicators */}
          <div className="flex space-x-4 mb-5">
            {[0, 1, 2, 3].map((index) => (
              <div
                key={index}
                className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-150 ${
                  pin.length > index
                    ? "bg-blue-600 border-blue-600 scale-110 shadow-sm"
                    : "border-slate-300 bg-white"
                }`}
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
              onClick={() => setPin("")}
              className="h-12 bg-slate-100 hover:bg-slate-200 text-xs text-slate-500 hover:text-slate-700 font-bold rounded-xl flex items-center justify-center transition border border-slate-200/40"
              id="keypad-clear"
            >
              Clear
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

      <div className="mt-8 text-center text-slate-400 text-[11px] font-medium max-w-sm">
        <p className="leading-relaxed">
          PIN: Owner <code className="bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-600 font-mono font-bold">1111</code> | Manager <code className="bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-600 font-mono font-bold">2222</code> | Staff <code className="bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-600 font-mono font-bold">3333</code>
        </p>
      </div>
    </div>
  );
}
