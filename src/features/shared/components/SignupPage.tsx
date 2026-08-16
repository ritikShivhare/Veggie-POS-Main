import React, { useState, useEffect } from "react";
import {
  Building,
  Users,
  Phone,
  Mail,
  Lock,
  ShieldCheck,
  Check,
  ArrowRight,
  AlertTriangle,
  RefreshCw,
  X,
  ChevronLeft,
  Eye,
  EyeOff,
  Sparkles,
  Key
} from "lucide-react";
import { RestaurantTenant, StaffMember } from "../types";

interface SignupPageProps {
  onBack: () => void;
  onSignupSuccess: (data: {
    tenant: RestaurantTenant;
    staff: StaffMember;
    sessionId: string;
  }) => void;
  initialData?: {
    businessName: string;
    ownerName: string;
    ownerPhone: string;
    email: string;
    region: string;
    pin: string;
  } | null;
}

export default function SignupPage({ onBack, onSignupSuccess, initialData }: SignupPageProps) {
  // Phase of Signup: "form" | "verify" | "success"
  const [phase, setPhase] = useState<"form" | "verify" | "success">("form");

  // Form Field States
  const [businessName, setBusinessName] = useState(initialData?.businessName || "");
  const [ownerName, setOwnerName] = useState(initialData?.ownerName || "");
  const [ownerPhone, setOwnerPhone] = useState(initialData?.ownerPhone || "");
  const [email, setEmail] = useState(initialData?.email || "");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState(initialData?.pin || "");
  const [region, setRegion] = useState(initialData?.region || "North India / Delhi");
  
  // Layout and security UI states
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Verification states
  const [pendingToken, setPendingToken] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [devOtpCode, setDevOtpCode] = useState("");
  const [sentEmail, setSentEmail] = useState("");
  const [generatedTenantId, setGeneratedTenantId] = useState("");

  const otpInputRef = React.useRef<HTMLInputElement>(null);

  // Auto-focus OTP input on entering verify phase
  useEffect(() => {
    if (phase === "verify" && otpInputRef.current) {
      otpInputRef.current.focus();
    }
  }, [phase]);

  // Zero-Tap / Low-Tap Auto Verification when 6 digits entered
  useEffect(() => {
    if (phase === "verify" && verificationCode.trim().length === 6 && !isLoading) {
      handleVerifySubmitWithCode(verificationCode.trim());
    }
  }, [verificationCode, phase]);

  useEffect(() => {
    if (initialData) {
      const autoRegister = async () => {
        setIsLoading(true);
        setError("");
        try {
          const res = await fetch("/api/auth/signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              businessName: initialData.businessName,
              ownerName: initialData.ownerName,
              ownerPhone: initialData.ownerPhone,
              email: initialData.email,
              pin: initialData.pin,
              region: initialData.region
            })
          });

          const data = await res.json();
          if (!res.ok || !data.success) {
            throw new Error(data.error || data.message || "Failed to submit registration request.");
          }

          setPendingToken(data.pendingToken);
          setSentEmail(data.email);
          setGeneratedTenantId(data.tenantId);
          if (data.devOtp) setDevOtpCode(data.devOtp);
          setPhase("verify");
        } catch (err: any) {
          setError(err.message || "Something went wrong. Please check your network and try again.");
          setPhase("form");
        } finally {
          setIsLoading(false);
        }
      };
      autoRegister();
    }
  }, [initialData]);

  // Validation before submitting initial registration details
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!businessName.trim()) return setError("Please enter your restaurant business name.");
    if (!ownerName.trim()) return setError("Please enter the owner's full name.");
    if (!email.trim()) return setError("Please enter a valid owner email address.");
    if (!password || password.length < 6) return setError("Password must be at least 6 characters.");
    if (!pin || pin.length !== 5 || !/^\d+$/.test(pin)) return setError("Passcode PIN must be exactly 5 digits.");

    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName,
          ownerName,
          ownerPhone,
          email,
          pin,
          region
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || data.message || "Failed to submit registration request.");
      }

      setPendingToken(data.pendingToken);
      setSentEmail(data.email);
      setGeneratedTenantId(data.tenantId);
      if (data.devOtp) setDevOtpCode(data.devOtp);
      setPhase("verify");
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please check your network and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Reusable submit and verify code function for low-tap automation
  const handleVerifySubmitWithCode = async (codeToVerify: string) => {
    setError("");

    if (!codeToVerify || codeToVerify.trim().length !== 6) {
      return setError("Please enter the 6-digit verification code sent to your email.");
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pendingToken,
          verificationCode: codeToVerify.trim()
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || "The code entered is invalid or expired.");
      }

      // Success! Move to success phase and trigger registration handler
      setPhase("success");
      setTimeout(() => {
        onSignupSuccess({
          tenant: data.tenant,
          staff: data.user,
          sessionId: data.session.sessionId
        });
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Incorrect verification code. Please check and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleVerifySubmitWithCode(verificationCode);
  };

  // Resend Verification Code handler
  const handleResendCode = async () => {
    setError("");
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName,
          ownerName,
          ownerPhone,
          email,
          pin,
          region
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to resend code.");
      }
      setPendingToken(data.pendingToken);
      if (data.devOtp) setDevOtpCode(data.devOtp);
      alert(`A fresh verification code has been dispatched to ${email}!`);
    } catch (err: any) {
      setError(err.message || "Failed to resend verification code.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between py-12 px-4 sm:px-6 lg:px-8 font-sans selection:bg-pink-500 selection:text-white">
      {/* Background elegant details */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-pink-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top logo header */}
      <header className="w-full max-w-md mx-auto text-center flex flex-col items-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
          <span>Veggie</span>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-rose-400 to-amber-400">POS</span>
        </h1>
        <p className="text-xs text-slate-400 mt-2">Next-Gen Multi-Tenant Smart Restaurant POS Hub</p>
      </header>

      {/* Main card stage */}
      <main className="w-full max-w-md mx-auto my-8">
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-6 md:p-8 shadow-2xl backdrop-blur-md relative overflow-hidden">
          
          {phase === "form" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-white">Create Your Account</h2>
                  <p className="text-[10px] text-slate-400 mt-0.5">Register a brand-new restaurant tenant</p>
                </div>
                <button
                  onClick={onBack}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition flex items-center gap-1 text-[10px] font-bold font-mono uppercase tracking-wider"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
              </div>

              {error && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs font-medium flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleRegisterSubmit} className="space-y-4 text-left">
                {/* Business details */}
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold font-mono">Business / Store Name</label>
                  <div className="relative">
                    <Building className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Royal Veggie Bistro"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-9 pr-3 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition"
                    />
                  </div>
                </div>

                {/* Owner profile */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold font-mono">Owner Full Name</label>
                    <div className="relative">
                      <Users className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                      <input
                        type="text"
                        required
                        placeholder="e.g. Rahul Sharma"
                        value={ownerName}
                        onChange={(e) => setOwnerName(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-9 pr-3 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold font-mono">Phone Number</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                      <input
                        type="tel"
                        placeholder="e.g. 9876543210"
                        value={ownerPhone}
                        onChange={(e) => setOwnerPhone(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-9 pr-3 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition"
                      />
                    </div>
                  </div>
                </div>

                {/* Email address */}
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold font-mono">Email ID (Verification Required)</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                    <input
                      type="email"
                      required
                      placeholder="e.g. owner@veggie.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-9 pr-3 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition"
                    />
                  </div>
                </div>

                {/* Password & Pin config */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold font-mono">Account Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        placeholder="Min 6 characters"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-9 pr-8 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300 focus:outline-none"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold font-mono">5-Digit Terminal PIN</label>
                      <button
                        type="button"
                        onClick={() => setPin("55555")}
                        className="text-[9px] text-pink-400 hover:text-pink-300 font-bold bg-pink-500/10 hover:bg-pink-500/20 px-1.5 py-0.5 rounded transition cursor-pointer"
                      >
                        ⚡ Use 55555
                      </button>
                    </div>
                    <div className="relative">
                      <Key className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                      <input
                        type="password"
                        required
                        maxLength={5}
                        placeholder="e.g. 55555"
                        value={pin}
                        onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-9 pr-3 text-xs font-bold tracking-widest text-slate-100 placeholder-slate-600 focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition"
                      />
                    </div>
                  </div>
                </div>

                {/* Region */}
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold font-mono">Operating Region</label>
                  <select
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-slate-100 focus:outline-none focus:border-pink-500 appearance-none cursor-pointer font-medium"
                  >
                    <option value="North India / Delhi">North India / Delhi</option>
                    <option value="South India / Bengaluru">South India / Bengaluru</option>
                    <option value="West India / Mumbai">West India / Mumbai</option>
                    <option value="East India / Kolkata">East India / Kolkata</option>
                    <option value="Central India">Central India</option>
                  </select>
                  {/* Quick Region Pills for 1-Tap Selection */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[
                      { label: "Delhi NCR", val: "North India / Delhi" },
                      { label: "Bengaluru", val: "South India / Bengaluru" },
                      { label: "Mumbai", val: "West India / Mumbai" },
                      { label: "Kolkata", val: "East India / Kolkata" }
                    ].map((pill) => (
                      <button
                        key={pill.val}
                        type="button"
                        onClick={() => setRegion(pill.val)}
                        className={`text-[9px] font-bold px-2 py-0.5 rounded-full transition border cursor-pointer ${
                          region === pill.val
                            ? "bg-pink-500/20 border-pink-500 text-pink-300"
                            : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
                        }`}
                      >
                        {pill.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Register submit */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full mt-4 py-3 bg-pink-600 hover:bg-pink-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-pink-500/10 active:scale-98 disabled:opacity-50 transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Requesting Verification Code...</span>
                    </>
                  ) : (
                    <>
                      <span>Submit & Request Verification Code</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {phase === "verify" && (
            <div className="space-y-6">
              <div className="text-center border-b border-slate-800 pb-4">
                <h2 className="text-lg font-bold text-white">Verify Your Email</h2>
                <p className="text-[10px] text-slate-400 mt-1">
                  We sent a 6-digit verification code to <span className="font-semibold text-slate-200">{sentEmail}</span>
                </p>
              </div>

              {error && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs font-medium flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {devOtpCode && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-300 text-xs space-y-2">
                  <div className="flex items-center justify-between font-bold">
                    <span className="flex items-center gap-1.5 text-amber-400 text-[11px]">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      Zero-Cost Instant OTP Helper:
                    </span>
                    <span className="font-mono text-sm font-extrabold tracking-widest text-amber-200 bg-amber-950/90 px-2 py-0.5 rounded-lg border border-amber-500/40">
                      {devOtpCode}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-amber-400/90 pt-0.5 border-t border-amber-500/20">
                    <span>Zero-Cost Active</span>
                    <button
                      type="button"
                      onClick={() => {
                        setVerificationCode(devOtpCode);
                        handleVerifySubmitWithCode(devOtpCode);
                      }}
                      className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold rounded-lg text-[10px] uppercase tracking-wider transition cursor-pointer shadow-sm flex items-center gap-1"
                    >
                      ⚡ Auto-Fill & Verify Now
                    </button>
                  </div>
                </div>
              )}

              <form onSubmit={handleVerifySubmit} className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold font-mono text-left block">
                      6-Digit Verification Code
                    </label>
                    <span className="text-[9px] text-emerald-400 font-mono font-medium">
                      ⚡ Auto-submits on 6th digit
                    </span>
                  </div>
                  <input
                    ref={otpInputRef}
                    type="text"
                    maxLength={6}
                    required
                    placeholder="• • • • • •"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ""))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3.5 px-3 text-center text-xl tracking-widest font-mono font-extrabold focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 text-slate-100 transition placeholder-slate-700"
                  />
                </div>

                <div className="flex justify-between items-center text-[10px] font-bold font-mono uppercase tracking-wider text-slate-400 px-1">
                  <button
                    type="button"
                    onClick={() => setPhase("form")}
                    className="hover:text-white transition flex items-center gap-1 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Change Details</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleResendCode}
                    className="hover:text-pink-400 text-pink-500 transition cursor-pointer"
                  >
                    Resend Code
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full mt-2 py-3 bg-pink-600 hover:bg-pink-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-pink-500/10 active:scale-98 disabled:opacity-50 transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <span>Verify & Initialize Restaurant</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {phase === "success" && (
            <div className="py-6 space-y-4 text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 animate-bounce">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-white">Email Verified!</h2>
                <p className="text-xs text-slate-400">Your restaurant account is fully verified.</p>
              </div>
              <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-850 text-left space-y-2">
                <div className="flex justify-between items-center border-b border-slate-800 pb-2 text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                  <span>Assigned Terminal ID</span>
                  <span className="font-bold text-slate-200">{generatedTenantId}</span>
                </div>
                <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                  <span>Assigned Account Role</span>
                  <span className="font-bold text-emerald-400">Owner Admin</span>
                </div>
              </div>
              <div className="text-[11px] text-slate-400 italic mt-4 flex items-center justify-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-pink-500" />
                <span>Redirecting to operations terminal...</span>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Footer details */}
      <footer className="w-full max-w-md mx-auto text-center text-[10px] text-slate-500 font-mono">
        <p>Tenant Space: AWS Mumbai S3 Sandbox Node</p>
        <p className="mt-1">© 2026 VeggiePOS SaaS Ltd. All rights reserved.</p>
      </footer>
    </div>
  );
}
