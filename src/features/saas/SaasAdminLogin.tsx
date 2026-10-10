import React, { useState, useEffect } from "react";
import { Crown, AlertTriangle, RefreshCw, Mail, ArrowLeft } from "lucide-react";
import { StaffMember } from "../shared/types";
import { ApiClient } from "../shared/services/api";

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
  // SaaS Owner Email OTP Authentication State
  const [otpRequire, setOtpRequire] = useState<{
    password?: string;
    challengeToken?: string;
    email?: string;
  } | null>(null);

  const [otpCode, setOtpCode] = useState<string>("");
  const [otpError, setOtpError] = useState<string>("");
  const [otpSuccessMessage, setOtpSuccessMessage] = useState<string>("");
  const [loginError, setLoginError] = useState<string>("");
  const [passwordInput, setPasswordInput] = useState<string>("");
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [resendCooldown, setResendCooldown] = useState<number>(0);
  const [isResending, setIsResending] = useState<boolean>(false);

  // Timer for Resend Code cooldown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

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

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = otpCode.trim();
    if (!cleanCode || cleanCode.length < 6) {
      setOtpError("Please enter the 6-digit verification code.");
      return;
    }

    setOtpError("");
    setOtpSuccessMessage("");
    setIsLoggingIn(true);

    try {
      const res = await fetch("/api/saas-admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          otp: cleanCode,
          challengeToken: otpRequire?.challengeToken,
          password: otpRequire?.password
        })
      });
      const data = await res.json();

      if (data.success && data.user?.role === "SaaS Owner") {
        try {
          localStorage.removeItem("veggiepos_current_session_id");
        } catch (e) {}
        localStorage.setItem("veggiepos_current_staff", JSON.stringify(data.user));
        ApiClient.setSessionId(data.session.sessionId);
        setCurrentSessionId(data.session.sessionId);
        setCurrentStaff(data.user);
        setActiveTab("saas-admin");
      } else {
        setOtpError(data.message || "Invalid verification code.");
      }
    } catch (err: any) {
      setOtpError(err.message || "Connection error. Please try again.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || isResending || !otpRequire?.challengeToken) return;
    setIsResending(true);
    setOtpError("");
    setOtpSuccessMessage("");

    try {
      const res = await fetch("/api/saas-admin/resend-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ challengeToken: otpRequire.challengeToken })
      });
      const data = await res.json();

      if (data.success) {
        setResendCooldown(15);
        setOtpSuccessMessage(data.message || "Verification code sent to your email.");
      } else {
        setOtpError(data.message || "Unable to send verification email. Please try again.");
      }
    } catch (err: any) {
      setOtpError("Network error while resending code.");
    } finally {
      setIsResending(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoggingIn(true);
    setLoginError("");
    setOtpError("");
    try {
      const res = await fetch("/api/saas-admin/google-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: "shivritik53@gmail.com",
          name: "SaaS Owner"
        })
      });
      const data = await res.json();

      if (data.success && data.user?.role === "SaaS Owner") {
        try {
          localStorage.removeItem("veggiepos_current_session_id");
        } catch (e) {}
        localStorage.setItem("veggiepos_current_staff", JSON.stringify(data.user));
        ApiClient.setSessionId(data.session.sessionId);
        setCurrentSessionId(data.session.sessionId);
        setCurrentStaff(data.user);
        setActiveTab("saas-admin");
      } else {
        const errMsg = data.message || "Google Authentication failed.";
        if (otpRequire) setOtpError(errMsg);
        else setLoginError(errMsg);
      }
    } catch (err: any) {
      const errMsg = err.message || "Network error during Google Authentication.";
      if (otpRequire) setOtpError(errMsg);
      else setLoginError(errMsg);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordInput.trim()) {
      setLoginError("Super-Admin password is required.");
      return;
    }
    setLoginError("");
    setIsLoggingIn(true);

    try {
      const res = await fetch("/api/saas-admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password: passwordInput.trim() })
      });
      const data = await res.json();

      if (data.success) {
        if (data.requireOtp || data.require2FA) {
          setOtpRequire({
            challengeToken: data.challengeToken,
            email: data.email || "shivritik53@gmail.com",
            password: passwordInput.trim()
          });
          setOtpCode("");
          setOtpError("");
          setOtpSuccessMessage("");
          setResendCooldown(15);
        } else if (data.user?.role === "SaaS Owner") {
          try {
            localStorage.removeItem("veggiepos_current_session_id");
          } catch (e) {}
          localStorage.setItem("veggiepos_current_staff", JSON.stringify(data.user));
          ApiClient.setSessionId(data.session.sessionId);
          setCurrentSessionId(data.session.sessionId);
          setCurrentStaff(data.user);
          setActiveTab("saas-admin");
        } else {
          setLoginError(data.message || "Invalid response. Access Denied.");
        }
      } else {
        setLoginError(data.message || "Incorrect Super-Admin Password.");
      }
    } catch (err: any) {
      setLoginError(err.message || "Connection error. Please check your network.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-100 font-sans">
      <div className="w-full max-w-md bg-slate-900 rounded-3xl border border-slate-800 p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-pink-500/10 rounded-full blur-2xl" />
        <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-indigo-500/10 rounded-full blur-2xl" />

        <div className="flex flex-col items-center mb-6 text-center">
          <div className="w-16 h-16 bg-gradient-to-tr from-pink-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-pink-500/20 mb-4">
            {otpRequire ? <Mail className="w-8 h-8 text-white" /> : <Crown className="w-8 h-8 text-white" />}
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white">
            {otpRequire ? "Email OTP Verification" : "Super-Admin Console"}
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-xs">
            {otpRequire
              ? `Verification code sent to ${otpRequire.email || "shivritik53@gmail.com"}`
              : "SaaS Owner Authentication Required"}
          </p>
        </div>

        {otpRequire ? (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-mono font-bold text-slate-400 block text-center">
                Enter 6-Digit Email Code
              </label>
              <input
                type="text"
                maxLength={6}
                autoFocus
                required
                disabled={isLoggingIn}
                value={otpCode}
                onChange={(e) => {
                  setOtpCode(e.target.value.replace(/\D/g, ""));
                  setOtpError("");
                  setOtpSuccessMessage("");
                }}
                placeholder="000000"
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3 px-4 text-center text-xl tracking-[0.8em] font-mono text-white focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all"
              />

              {otpError && (
                <div className="p-2.5 bg-rose-950/50 border border-rose-800/60 rounded-xl flex items-center justify-center gap-1.5 mt-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <p className="text-rose-400 text-xs font-semibold text-center">
                    {otpError}
                  </p>
                </div>
              )}

              {otpSuccessMessage && (
                <p className="text-emerald-400 text-xs font-semibold text-center mt-2">
                  {otpSuccessMessage}
                </p>
              )}
            </div>

            {/* Primary Action Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                disabled={isLoggingIn}
                onClick={() => {
                  setOtpRequire(null);
                  setOtpCode("");
                  setOtpError("");
                  setOtpSuccessMessage("");
                }}
                className="py-3 bg-transparent hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 rounded-2xl text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Password</span>
              </button>
              <button
                type="submit"
                disabled={isLoggingIn || otpCode.length < 6}
                className="py-3 bg-gradient-to-r from-pink-600 to-indigo-600 hover:from-pink-700 hover:to-indigo-700 text-white rounded-2xl text-xs font-bold transition shadow-md shadow-pink-500/10 cursor-pointer disabled:opacity-50"
              >
                {isLoggingIn ? "Verifying..." : "Verify & Login"}
              </button>
            </div>

            {/* Resend Verification Code Button */}
            <div className="pt-2 border-t border-slate-800/80">
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={resendCooldown > 0 || isResending}
                className="w-full py-2.5 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-pink-400 hover:text-pink-300 disabled:text-slate-500 disabled:border-slate-800 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-2"
                id="saas-admin-resend-otp-btn"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isResending ? "animate-spin" : ""}`} />
                <span>
                  {resendCooldown > 0
                    ? `Resend Code in ${resendCooldown}s`
                    : isResending
                    ? "Sending Code..."
                    : "Resend Verification Code"}
                </span>
              </button>
            </div>

            {/* Google Authentication Fallback in OTP View */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isLoggingIn}
                className="w-full py-2.5 bg-slate-950 hover:bg-slate-800/80 border border-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-medium transition cursor-pointer flex items-center justify-center gap-2"
              >
                <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Or verify instantly with Google</span>
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase font-mono text-slate-400 tracking-wider">
                Enter Super-Admin Password
              </label>
              <input
                name="adminPassword"
                type="password"
                required
                disabled={isLoggingIn}
                value={passwordInput}
                onChange={(e) => {
                  setPasswordInput(e.target.value);
                  setLoginError("");
                }}
                placeholder="••••••••"
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3 px-4 text-center text-lg font-sans text-white focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all"
              />
              {loginError && (
                <div className="p-2.5 bg-rose-950/50 border border-rose-800/60 rounded-xl flex items-center justify-center gap-1.5 mt-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <p className="text-rose-400 text-xs font-semibold text-center">
                    {loginError}
                  </p>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-3.5 bg-gradient-to-r from-pink-600 to-indigo-600 hover:from-pink-700 hover:to-indigo-700 text-white rounded-2xl text-xs font-bold transition-all shadow-md shadow-pink-500/10 cursor-pointer disabled:opacity-50"
            >
              {isLoggingIn ? "Checking Password..." : "Send Verification Code"}
            </button>

            {/* Divider */}
            <div className="relative my-3">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-800" />
              </div>
              <div className="relative flex justify-center text-xs uppercase font-mono">
                <span className="bg-slate-900 px-2 text-slate-500 text-[10px]">Or continue with</span>
              </div>
            </div>

            {/* Google Authentication Button */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isLoggingIn}
              className="w-full py-3 bg-white hover:bg-slate-100 text-slate-900 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-2.5 shadow-sm cursor-pointer disabled:opacity-50"
              id="saas-admin-google-auth-btn"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Sign in with Google</span>
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
