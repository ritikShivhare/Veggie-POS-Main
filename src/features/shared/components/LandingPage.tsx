import React, { useState } from "react";
import { RestaurantTenant, StaffMember, StaffRole } from "../types";
import {
  LayoutDashboard,
  ChefHat,
  Boxes,
  Clock,
  FileText,
  DollarSign,
  Users,
  ShieldCheck,
  TrendingUp,
  ArrowRight,
  Lock,
  Building,
  Mail,
  Phone,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Eye,
  EyeOff,
  X
} from "lucide-react";

interface LandingPageProps {
  tenants: RestaurantTenant[];
  staffList: StaffMember[];
  activeTenant: RestaurantTenant;
  onSelectTenant: (tenant: RestaurantTenant) => void;
  onRegisterBusiness: (data: {
    businessName: string;
    ownerName: string;
    ownerPhone: string;
    email: string;
    region: string;
    pin: string;
  }) => void;
  onLoginBusiness: (data: {
    businessName: string;
    email: string;
    pin: string;
  }) => void;
  onOpenStaffTerminal: () => void;
}

export default function LandingPage({
  tenants,
  staffList,
  activeTenant,
  onSelectTenant,
  onRegisterBusiness,
  onLoginBusiness,
  onOpenStaffTerminal
}: LandingPageProps) {
  const [activeFormTab, setActiveFormTab] = useState<"register" | "login">("register");
  const [showConsoleModal, setShowConsoleModal] = useState(false);

  // Registration Form States
  const [regBusinessName, setRegBusinessName] = useState("");
  const [regOwnerName, setRegOwnerName] = useState("");
  const [regOwnerPhone, setRegOwnerPhone] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regRegion, setRegRegion] = useState("North India / Delhi");
  const [regPin, setRegPin] = useState("");
  const [regError, setRegError] = useState("");
  const [showRegPassword, setShowRegPassword] = useState(false);

  // Login Form States
  const [loginBusinessName, setLoginBusinessName] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginPin, setLoginPin] = useState("");
  const [loginError, setLoginError] = useState("");

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setRegError("");

    if (!regBusinessName.trim()) return setRegError("Business Name is required.");
    if (!regOwnerName.trim()) return setRegError("Owner Full Name is required.");
    if (!regOwnerPhone.trim()) return setRegError("Owner Phone Number is required.");
    if (!regEmail.trim()) return setRegError("Email ID is required.");
    if (regPassword.length < 6) return setRegError("Password must be at least 6 characters.");
    if (regPin.length !== 4 || isNaN(Number(regPin))) {
      return setRegError("PIN passcode must be exactly 4 numeric digits.");
    }

    onRegisterBusiness({
      businessName: regBusinessName,
      ownerName: regOwnerName,
      ownerPhone: regOwnerPhone,
      email: regEmail,
      region: regRegion,
      pin: regPin
    });
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");

    if (!loginBusinessName.trim()) return setLoginError("Business Name is required.");
    if (!loginEmail.trim()) return setLoginError("Email ID is required.");
    if (loginPin.length !== 4 || isNaN(Number(loginPin))) {
      return setLoginError("PIN must be exactly 4 numeric digits.");
    }

    onLoginBusiness({
      businessName: loginBusinessName,
      email: loginEmail,
      pin: loginPin
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-pink-100 selection:text-pink-700">
      
      {/* 1. TOP HERO NAVIGATION */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-pink-500 to-rose-500 flex items-center justify-center text-white text-lg font-black shadow-lg shadow-rose-500/10">
            V
          </div>
          <div className="flex flex-col">
            <h1 className="text-base font-extrabold text-slate-800 tracking-tight leading-none">
              VEGGIE<span className="text-pink-600 font-extrabold">POS</span>
            </h1>
            <p className="text-[8px] uppercase tracking-wider text-slate-400 mt-0.5 font-mono font-bold">
              EASY BILLING & STAFF APP
            </p>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-8 text-xs font-semibold text-slate-500">
          <a href="#features" className="hover:text-slate-800 transition duration-150">Features</a>
          <a href="#cost-control" className="hover:text-slate-800 transition duration-150">Save Money</a>
          <a href="#workforce" className="hover:text-slate-800 transition duration-150">Staff Hours</a>
          <a href="#security" className="hover:text-slate-800 transition duration-150">Private & Safe</a>
        </nav>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowConsoleModal(true)}
            className="px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-xl text-xs font-bold shadow-md shadow-pink-500/10 transition duration-150 cursor-pointer"
          >
            Owner Panel
          </button>
        </div>
      </header>

      {/* 2. CENTERED HERO SECTION */}
      <section className="max-w-7xl mx-auto px-6 py-16 md:py-24 text-center flex flex-col items-center justify-center">
        <div className="max-w-3xl space-y-6 flex flex-col items-center">
          <div className="inline-flex items-center gap-2 bg-pink-50 text-pink-600 px-3 py-1.5 rounded-full text-[11px] font-bold tracking-wide uppercase">
            <ShieldCheck className="w-4 h-4 text-pink-500" />
            <span>Your Own Private Billing Screens</span>
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-slate-800 tracking-tight leading-[1.1] max-w-3xl">
            The Cleanest Restaurant Tool to <span className="text-pink-600">Avoid Food Waste</span> & Help Staff
          </h1>

          <p className="text-slate-500 text-sm md:text-base leading-relaxed max-w-2xl">
            Designed for all types of restaurants, cafes, and kitchens. VeggiePOS makes billing fast, tracks food items automatically, counts staff hours, and helps you save money.
          </p>

          {/* Quick Features Checklist */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 text-xs font-medium text-slate-600 max-w-xl text-left">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
              <span>Kitchen screens that update instantly</span>
            </div>
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
              <span>Subtracts ingredients from your stock automatically</span>
            </div>
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
              <span>Staff sign-in with simple PIN locks</span>
            </div>
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
              <span>Simple, automatic advisor to help save money</span>
            </div>
          </div>

          {/* Call to Action */}
          <div className="pt-8 flex items-center justify-center w-full">
            <button
              onClick={() => setShowConsoleModal(true)}
              className="px-6 py-3.5 bg-pink-600 hover:bg-pink-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-pink-500/20 hover:shadow-pink-500/30 transition duration-150 cursor-pointer flex items-center gap-2"
            >
              <span>Open Owner Panel</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* OWNER CONSOLE OVERLAY MODAL */}
      {showConsoleModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          {/* Backdrop dismiss */}
          <div className="absolute inset-0" onClick={() => setShowConsoleModal(false)} />

          <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-2xl z-10 animate-in fade-in zoom-in-95 duration-200 my-8">
            {/* Close modal button */}
            <button
              onClick={() => setShowConsoleModal(false)}
              className="absolute right-4 top-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Form Tabs */}
            <div className="flex border-b border-slate-100 mb-6 mt-2">
              <button
                onClick={() => {
                  setActiveFormTab("register");
                  setRegError("");
                }}
                className={`flex-1 pb-3 text-center text-xs font-bold border-b-2 transition duration-150 cursor-pointer ${
                  activeFormTab === "register"
                    ? "border-pink-500 text-pink-600"
                    : "border-transparent text-slate-400 hover:text-slate-600"
                }`}
              >
                Register Restaurant
              </button>
              <button
                onClick={() => {
                  setActiveFormTab("login");
                  setLoginError("");
                }}
                className={`flex-1 pb-3 text-center text-xs font-bold border-b-2 transition duration-150 cursor-pointer ${
                  activeFormTab === "login"
                    ? "border-pink-500 text-pink-600"
                    : "border-transparent text-slate-400 hover:text-slate-600"
                }`}
              >
                Owner Login
              </button>
            </div>

            {/* 2A. REGISTER BUSINESS FORM */}
            {activeFormTab === "register" ? (
              <form onSubmit={(e) => { handleRegisterSubmit(e); setShowConsoleModal(false); }} className="space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Register Your Restaurant</h3>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Set up your restaurant store. Your staff can sign in to this store name using their PIN code.
                  </p>
                </div>

                {regError && (
                  <div className="p-3 bg-rose-50 border border-rose-100 text-rose-600 rounded-lg text-xs font-medium flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{regError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold font-mono">Business Name</label>
                    <div className="relative">
                      <Building className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="e.g. Royal Veggie Bistro"
                        value={regBusinessName}
                        onChange={(e) => setRegBusinessName(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-3 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-pink-500 text-slate-800"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold font-mono">Owner Full Name</label>
                    <div className="relative">
                      <Users className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="e.g. Rahul Sharma"
                        value={regOwnerName}
                        onChange={(e) => setRegOwnerName(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-3 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-pink-500 text-slate-800"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold font-mono">Owner Phone Number</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                      <input
                        type="tel"
                        placeholder="e.g. 9876543210"
                        value={regOwnerPhone}
                        onChange={(e) => setRegOwnerPhone(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-3 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-pink-500 text-slate-800"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold font-mono">Email ID</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                      <input
                        type="email"
                        placeholder="e.g. owner@veggie.com"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-3 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-pink-500 text-slate-800"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold font-mono">Region</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <select
                      value={regRegion}
                      onChange={(e) => setRegRegion(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-3 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-pink-500 appearance-none cursor-pointer text-slate-800 font-medium"
                    >
                      <option value="North India / Delhi">North India / Delhi</option>
                      <option value="South India / Bengaluru">South India / Bengaluru</option>
                      <option value="West India / Mumbai">West India / Mumbai</option>
                      <option value="East India / Kolkata">East India / Kolkata</option>
                      <option value="Central India">Central India</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold font-mono">Admin Password</label>
                    <div className="relative">
                      <input
                        type={showRegPassword ? "text" : "password"}
                        placeholder="At least 6 characters"
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-pink-500 text-slate-800"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegPassword(!showRegPassword)}
                        className="absolute right-3 top-2 text-slate-400 hover:text-slate-600 focus:outline-none"
                      >
                        {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold font-mono">4-Digit PIN Code</label>
                      <div className="relative group">
                        <HelpCircle className="w-3.5 h-3.5 text-slate-400 cursor-pointer hover:text-slate-600" />
                        <div className="absolute right-0 bottom-full mb-1.5 hidden group-hover:block bg-slate-800 text-white text-[9px] p-2 rounded shadow-lg whitespace-nowrap z-50">
                          PIN used to log in to the billing screen
                        </div>
                      </div>
                    </div>
                    <input
                      type="password"
                      maxLength={4}
                      placeholder="e.g. 1111"
                      value={regPin}
                      onChange={(e) => setRegPin(e.target.value.replace(/\D/g, ""))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs tracking-widest text-center font-mono font-bold focus:bg-white focus:outline-none focus:ring-1 focus:ring-pink-500 text-slate-800"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-pink-600 hover:bg-pink-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-pink-500/10 active:scale-95 transition duration-150 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span>Register & Open My Billing Screen</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            ) : (
              // 2B. OWNER LOGIN FORM
              <form onSubmit={(e) => { handleLoginSubmit(e); setShowConsoleModal(false); }} className="space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Owner Log In</h3>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Log in to manage food items, staff shifts, menu pricing, and see simple cost reports.
                  </p>
                </div>

                {loginError && (
                  <div className="p-3 bg-rose-50 border border-rose-100 text-rose-600 rounded-lg text-xs font-medium flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{loginError}</span>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold font-mono">Business Name</label>
                  <div className="relative">
                    <Building className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="e.g. Royal Veggie Bistro"
                      value={loginBusinessName}
                      onChange={(e) => setLoginBusinessName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-3 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-pink-500 text-slate-800"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold font-mono">Owner Email ID</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                      type="email"
                      placeholder="e.g. owner@veggie.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-3 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-pink-500 text-slate-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold font-mono">Password</label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-pink-500 text-slate-800"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold font-mono">4-Digit PIN Code</label>
                    <input
                      type="password"
                      maxLength={4}
                      placeholder="e.g. 1111"
                      value={loginPin}
                      onChange={(e) => setLoginPin(e.target.value.replace(/\D/g, ""))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs tracking-widest text-center font-mono font-bold focus:bg-white focus:outline-none focus:ring-1 focus:ring-pink-500 text-slate-800"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-pink-600 hover:bg-pink-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-pink-500/10 active:scale-95 transition duration-150 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span>Unlock & Log In</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* 3. CORE FEATURES SECTION */}
      <section id="features" className="bg-white border-y border-slate-100 py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto space-y-3 mb-16">
            <h2 className="text-[11px] uppercase tracking-widest text-pink-600 font-extrabold font-mono">Easy Restaurant Tools</h2>
            <h3 className="text-3xl font-extrabold text-slate-800 tracking-tight">
              Everything in One Place. Simple & Easy.
            </h3>
            <p className="text-slate-500 text-xs md:text-sm">
              No confusing systems. When an order is placed, everything else (stock count, staff hours, sales) updates instantly so everyone is on the same page.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            
            {/* FEATURE 1 */}
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 transition hover:translate-y-[-4px] duration-300">
              <div className="w-10 h-10 rounded-xl bg-pink-100/80 text-pink-600 flex items-center justify-center mb-5 shadow-sm">
                <LayoutDashboard className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-extrabold text-slate-800">Daily Summary Screen</h4>
              <p className="text-xs text-slate-500 mt-2.5 leading-relaxed">
                See how much money you made today, how customers paid (UPI or cash), and what food items are running low. Also see your most popular dishes instantly.
              </p>
            </div>

            {/* FEATURE 2 */}
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 transition hover:translate-y-[-4px] duration-300">
              <div className="w-10 h-10 rounded-xl bg-pink-100/80 text-pink-600 flex items-center justify-center mb-5 shadow-sm">
                <ChefHat className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-extrabold text-slate-800">Fast Billing Screen</h4>
              <p className="text-xs text-slate-500 mt-2.5 leading-relaxed">
                Add items to the cart, choose table numbers, type in customer numbers to give discounts, and send orders straight to the kitchen screen instantly.
              </p>
            </div>

            {/* FEATURE 3 */}
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 transition hover:translate-y-[-4px] duration-300">
              <div className="w-10 h-10 rounded-xl bg-pink-100/80 text-pink-600 flex items-center justify-center mb-5 shadow-sm">
                <Boxes className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-extrabold text-slate-800">Automatic Ingredient Tracking</h4>
              <p className="text-xs text-slate-500 mt-2.5 leading-relaxed">
                Connect your dishes to your kitchen stock. When you sell 1 Paneer Butter Masala, the system automatically subtracts paneer, butter, and tomatoes from your inventory and warns you when you run low.
              </p>
            </div>

            {/* FEATURE 4 */}
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 transition hover:translate-y-[-4px] duration-300">
              <div className="w-10 h-10 rounded-xl bg-pink-100/80 text-pink-600 flex items-center justify-center mb-5 shadow-sm">
                <Clock className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-extrabold text-slate-800">Staff Hours & Simple Lock</h4>
              <p className="text-xs text-slate-500 mt-2.5 leading-relaxed">
                Keep things safe by giving each staff member a 4-digit PIN. Lock and unlock the billing screen instantly as staff members change shifts.
              </p>
            </div>

            {/* FEATURE 5 */}
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 transition hover:translate-y-[-4px] duration-300">
              <div className="w-10 h-10 rounded-xl bg-pink-100/80 text-pink-600 flex items-center justify-center mb-5 shadow-sm">
                <FileText className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-extrabold text-slate-800">Smart Cost-Saving Advisor</h4>
              <p className="text-xs text-slate-500 mt-2.5 leading-relaxed">
                Get helpful tips on how to save money on vegetables and ingredients. The system looks at your daily sales to show you where you can cut down on waste.
              </p>
            </div>

            {/* FEATURE 6 */}
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 transition hover:translate-y-[-4px] duration-300">
              <div className="w-10 h-10 rounded-xl bg-pink-100/80 text-pink-600 flex items-center justify-center mb-5 shadow-sm">
                <Users className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-extrabold text-slate-800">Customer Records & Discounts</h4>
              <p className="text-xs text-slate-500 mt-2.5 leading-relaxed">
                Save customer phone numbers at checkout to give them loyalty points. The system will automatically apply discounts for regular customers during billing.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* 4. SAVING MONEY SECTION */}
      <section id="cost-control" className="py-16 md:py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full text-[10px] font-bold tracking-wide uppercase">
              <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
              <span>Increase Your Profits by 12% - 18%</span>
            </div>

            <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">
              Stop Food Waste & Avoid Over-Buying Food Items
            </h2>

            <p className="text-slate-500 text-xs md:text-sm leading-relaxed">
              Losing track of food items is the biggest reason why restaurants lose money. VeggiePOS helps you save money by tracking your kitchen stock continuously:
            </p>

            <div className="space-y-4 pt-2">
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-lg bg-pink-100 text-pink-600 flex items-center justify-center shrink-0 font-bold text-xs">1</div>
                <div>
                  <h4 className="text-xs font-bold text-slate-700">Exact Portion Tracking</h4>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Every order of Paneer Butter Masala subtracts exactly 200 grams of paneer. This prevents staff from giving too much food or using extra items without you knowing.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-lg bg-pink-100 text-pink-600 flex items-center justify-center shrink-0 font-bold text-xs">2</div>
                <div>
                  <h4 className="text-xs font-bold text-slate-700">Stop Orders When Items Run Out</h4>
                  <p className="text-[11px] text-slate-500 mt-1">
                    You can choose to stop taking orders for a dish when its ingredients are fully gone. The app will block sales automatically, helping you restock on time.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-lg bg-pink-100 text-pink-600 flex items-center justify-center shrink-0 font-bold text-xs">3</div>
                <div>
                  <h4 className="text-xs font-bold text-slate-700">Record Food Purchase Costs</h4>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Write down the cost of every bag of onions or block of butter you buy. Know exactly where your money went and see if suppliers change their prices.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Visual Margin Simulation Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-lg space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">Simple Example of How You Save Money</h4>
            <div className="space-y-3.5">
              <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-center justify-between">
                <div>
                  <h5 className="text-xs font-extrabold text-rose-700">Paneer is running low</h5>
                  <p className="text-[10px] text-rose-500 mt-0.5">Stock is at 1,200g (Min required: 2,000g)</p>
                </div>
                <span className="text-[11px] bg-rose-600 text-white font-bold px-2.5 py-1 rounded">Time to buy more</span>
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center justify-between">
                <div>
                  <h5 className="text-xs font-extrabold text-emerald-700">Kitchen Usage Status</h5>
                  <p className="text-[10px] text-emerald-500 mt-0.5">Deduction efficiency at 99.8% today</p>
                </div>
                <span className="text-[11px] bg-emerald-600 text-white font-bold px-2.5 py-1 rounded">No extra waste</span>
              </div>

              <div className="pt-3 border-t border-slate-100">
                <h5 className="text-xs font-extrabold text-slate-800">Estimated Monthly Savings</h5>
                <p className="text-[10px] text-slate-500 mt-0.5">Based on your daily ingredients tracking</p>
                
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl text-center">
                    <p className="text-[10px] text-slate-400 uppercase font-mono">Less Waste</p>
                    <p className="text-base font-black text-pink-600 mt-1">32.4% Less</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl text-center">
                    <p className="text-[10px] text-slate-400 uppercase font-mono">More Profit</p>
                    <p className="text-base font-black text-emerald-600 mt-1">+14.6%</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* 5. WORKFORCE & STAFF MANAGEMENT SECTION */}
      <section id="workforce" className="py-16 md:py-24 bg-white border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          <div className="lg:col-span-5 order-last lg:order-first">
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 shadow-md space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h4 className="text-xs font-bold text-slate-800">Who is Working Now</h4>
                <span className="text-[10px] bg-emerald-50 text-emerald-600 font-bold px-2 py-0.5 rounded border border-emerald-100">2 Staff Active</span>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between p-2.5 bg-white border border-slate-150 rounded-xl">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded bg-pink-100 flex items-center justify-center text-xs text-pink-600 font-bold">R</div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">Rahul Sharma</p>
                      <p className="text-[9px] text-slate-400 uppercase font-mono font-bold font-semibold">Owner • Working</p>
                    </div>
                  </div>
                  <span className="text-[9px] bg-pink-50 text-pink-600 border border-pink-100 px-2 py-0.5 rounded font-bold">Active 4.2h</span>
                </div>

                <div className="flex items-center justify-between p-2.5 bg-white border border-slate-150 rounded-xl">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded bg-indigo-100 flex items-center justify-center text-xs text-indigo-600 font-bold">A</div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">Amit Kumar</p>
                      <p className="text-[9px] text-slate-400 uppercase font-mono font-bold font-semibold">Manager • Working</p>
                    </div>
                  </div>
                  <span className="text-[9px] bg-pink-50 text-pink-600 border border-pink-100 px-2 py-0.5 rounded font-bold">Active 2.8h</span>
                </div>

                <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-dashed border-slate-200 rounded-xl">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded bg-slate-200 flex items-center justify-center text-xs text-slate-500 font-bold">M</div>
                    <div>
                      <p className="text-xs font-bold text-slate-400">Mohan Lal</p>
                      <p className="text-[9px] text-slate-350 uppercase font-mono font-bold font-semibold">Staff • Off Duty</p>
                    </div>
                  </div>
                  <span className="text-[9px] bg-slate-100 text-slate-400 border border-slate-200/50 px-2 py-0.5 rounded font-bold">Off Duty</span>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-full text-[10px] font-bold tracking-wide uppercase">
              <Users className="w-3.5 h-3.5 text-indigo-600" />
              <span>Staff Shifts & Roles</span>
            </div>

            <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">
              Easily Manage Your Staff
            </h2>

            <p className="text-slate-500 text-xs md:text-sm leading-relaxed">
              You don't need diaries or chat groups to track your staff. VeggiePOS helps you manage employee hours and permissions directly inside the app:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-2">
                <h5 className="text-xs font-extrabold text-slate-800">Simple PIN Clock-In</h5>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Employees type their own 4-digit PIN code on the screen to clock in or clock out. The app calculates their working hours automatically.
                </p>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-2">
                <h5 className="text-xs font-extrabold text-slate-800">Staff Permissions</h5>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Keep things safe by giving roles. Cashiers can only do billing, managers can change item list prices, and only the owner can see cost reports and change system settings.
                </p>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* 6. SECURITY */}
      <section id="security" className="py-16 md:py-24 bg-slate-50 border-t border-slate-200 text-slate-800">
        <div className="max-w-7xl mx-auto px-6 text-center space-y-12">
          
          <div className="max-w-2xl mx-auto space-y-3">
            <h2 className="text-[11px] uppercase tracking-widest text-pink-600 font-extrabold font-mono">Keeping Your Data Safe</h2>
            <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              How We Keep Your Information Safe
            </h3>
            <p className="text-slate-600 text-xs md:text-sm">
              We know you want to keep your sales and numbers private. We made sure that every restaurant's records are completely hidden from others:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
            
            <div className="bg-white border border-slate-200/85 p-6 rounded-2xl space-y-3 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-pink-500/10 text-pink-600 flex items-center justify-center font-bold">
                🔒
              </div>
              <h4 className="text-sm font-bold text-slate-900">Private Store ID</h4>
              <p className="text-xs text-slate-650 leading-relaxed">
                Every business gets their own private code (e.g. <code className="bg-slate-100 text-pink-600 px-1 py-0.5 rounded font-mono">veg-main-001</code>). No one else can see or change your restaurant's numbers.
              </p>
            </div>

            <div className="bg-white border border-slate-200/85 p-6 rounded-2xl space-y-3 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-pink-500/10 text-pink-600 flex items-center justify-center font-bold">
                🔑
              </div>
              <h4 className="text-sm font-bold text-slate-900">Lock Screen</h4>
              <p className="text-xs text-slate-650 leading-relaxed">
                The screen locks automatically and asks for a 4-digit PIN code. Only employees you register can open it.
              </p>
            </div>

            <div className="bg-white border border-slate-200/85 p-6 rounded-2xl space-y-3 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-pink-500/10 text-pink-600 flex items-center justify-center font-bold">
                🖥️
              </div>
              <h4 className="text-sm font-bold text-slate-900">Safe Storage</h4>
              <p className="text-xs text-slate-650 leading-relaxed">
                Your menu, sales history, ingredients, and customer lists are stored safely. Everything updates in real time on all your screens.
              </p>
            </div>

          </div>

          {/* Call to action */}
          <div className="pt-6">
            <button
              onClick={() => setShowConsoleModal(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-pink-600 hover:bg-pink-700 text-white rounded-xl text-xs font-bold transition duration-150 cursor-pointer shadow-lg shadow-pink-500/20"
            >
              <span>Set Up Your Safe Restaurant Account Now</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

        </div>
      </section>



      {/* 7. FOOTER */}
      <footer className="bg-slate-950 text-slate-500 py-12 px-6 border-t border-slate-800">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-gradient-to-tr from-pink-500 to-rose-500 flex items-center justify-center text-white text-xs font-bold font-mono">
              V
            </div>
            <p className="text-xs font-bold text-slate-400">VeggiePOS App</p>
          </div>
          <p className="text-[11px] text-slate-600">
            Designed for all types of restaurants, cafes, and bakeries. Built with safe and private data storage.
          </p>
        </div>
      </footer>

    </div>
  );
}
