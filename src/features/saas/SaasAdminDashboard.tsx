import React, { useState, useEffect } from "react";
import { RestaurantTenant, Order } from "../shared/types";
import {
  Crown,
  Server,
  Database,
  Users,
  Building,
  Activity,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Globe,
  Plus,
  ArrowUpDown,
  Search,
  Check,
  ShieldCheck,
  Trash2,
  RefreshCw,
  Mail,
  Phone,
  MapPin,
  ChevronRight
} from "lucide-react";

interface SaasAdminDashboardProps {
  tenants: RestaurantTenant[];
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
  orders: Order[];
  currentSessionId?: string | null;
}

interface SyncLog {
  id: string;
  timestamp: string;
  tenantName: string;
  tenantId: string;
  eventType: string;
  syncStatus: "SUCCESS" | "PENDING" | "FAILED";
  recordsCount: number;
}

export default function SaasAdminDashboard({
  tenants,
  activeTenant,
  onSelectTenant,
  onRegisterBusiness,
  orders,
  currentSessionId
}: SaasAdminDashboardProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [regionFilter, setRegionFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Local state for live synced backend data
  const [localTenants, setLocalTenants] = useState<RestaurantTenant[]>(tenants);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Registration states for direct quick-register inside admin panel
  const [showQuickRegister, setShowQuickRegister] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [email, setEmail] = useState("");
  const [region, setRegion] = useState("North India / Delhi");
  const [pin, setPin] = useState("");
  const [regError, setRegError] = useState("");
  const [regSuccess, setRegSuccess] = useState("");

  // Live Sync Log generation
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [isSyncingAll, setIsSyncingAll] = useState(false);

  const fetchTenants = async () => {
    if (!currentSessionId) {
      setLocalTenants(tenants);
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/tenants", {
        headers: {
          "x-session-id": currentSessionId,
          "x-tenant-id": "saas-admin"
        }
      });
      const data = await res.json();
      if (data.success) {
        setLocalTenants(data.tenants);
      }
    } catch (err: any) {
      console.error("Failed to load live tenants:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, [currentSessionId, tenants]);

  // Generate initial mock sync log stream
  useEffect(() => {
    const initialLogs: SyncLog[] = [
      {
        id: "log-1029",
        timestamp: new Date(Date.now() - 1000 * 60 * 2).toLocaleTimeString(),
        tenantName: "The Green Kitchen",
        tenantId: "veg-main-001",
        eventType: "POS_BILL_DEDUCT_STOCK",
        syncStatus: "SUCCESS",
        recordsCount: 3
      },
      {
        id: "log-1028",
        timestamp: new Date(Date.now() - 1000 * 60 * 8).toLocaleTimeString(),
        tenantName: "Organic Bites",
        tenantId: "org-bites-02",
        eventType: "BATCH_INVENTORY_RESTOCK",
        syncStatus: "SUCCESS",
        recordsCount: 12
      },
      {
        id: "log-1027",
        timestamp: new Date(Date.now() - 1000 * 60 * 15).toLocaleTimeString(),
        tenantName: "The Green Kitchen",
        tenantId: "veg-main-001",
        eventType: "SHIFT_CLOCK_OUT_SYNC",
        syncStatus: "SUCCESS",
        recordsCount: 1
      },
      {
        id: "log-1026",
        timestamp: new Date(Date.now() - 1000 * 60 * 24).toLocaleTimeString(),
        tenantName: "Organic Bites",
        tenantId: "org-bites-02",
        eventType: "CUSTOMER_DISCOUNT_REDEEM",
        syncStatus: "SUCCESS",
        recordsCount: 1
      }
    ];
    setSyncLogs(initialLogs);

    // Stream random simulated live database sync events
    const interval = setInterval(() => {
      if (localTenants.length === 0) return;
      const randomTenant = localTenants[Math.floor(Math.random() * localTenants.length)];
      const events = [
        "POS_BILL_DEDUCT_STOCK",
        "SYNC_INGREDIENT_LEDGER",
        "CRM_CUSTOMER_REGISTER",
        "AI_REPORT_QUERY",
        "SHIFT_CLOCK_IN_SYNC",
        "ZOMATO_API_POLL"
      ];
      const randomEvent = events[Math.floor(Math.random() * events.length)];
      const randomCount = Math.floor(Math.random() * 8) + 1;

      const newLog: SyncLog = {
        id: `log-${Math.floor(2000 + Math.random() * 8000)}`,
        timestamp: new Date().toLocaleTimeString(),
        tenantName: randomTenant.name,
        tenantId: randomTenant.tenantId,
        eventType: randomEvent,
        syncStatus: Math.random() > 0.05 ? "SUCCESS" : "PENDING",
        recordsCount: randomCount
      };

      setSyncLogs((prev) => [newLog, ...prev.slice(0, 9)]);
    }, 12000);

    return () => clearInterval(interval);
  }, [localTenants]);

  const handleForceSync = () => {
    setIsSyncingAll(true);
    setTimeout(() => {
      setIsSyncingAll(false);
      // Add a fresh success log
      const newLog: SyncLog = {
        id: `log-${Math.floor(9000 + Math.random() * 1000)}`,
        timestamp: new Date().toLocaleTimeString(),
        tenantName: "GLOBAL SAAS SYSTEM",
        tenantId: "all-tenants",
        eventType: "FORCE_RE_SYNC_ALL_STORES",
        syncStatus: "SUCCESS",
        recordsCount: localTenants.length
      };
      setSyncLogs((prev) => [newLog, ...prev]);
    }, 1500);
  };

  const handleSuspendTenant = async (tenantId: string) => {
    if (!currentSessionId) {
      alert("Session required to manage tenants.");
      return;
    }
    if (!confirm(`Are you sure you want to suspend this tenant workspace (${tenantId})? All their API calls will return 403 Forbidden.`)) {
      return;
    }
    try {
      const res = await fetch("/api/admin/tenants/suspend", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-id": currentSessionId,
          "x-tenant-id": "saas-admin"
        },
        body: JSON.stringify({ tenantId })
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message);
        fetchTenants();
      } else {
        alert(data.error || data.message || "Failed to suspend tenant.");
      }
    } catch (err: any) {
      alert(err.message || "Connection error.");
    }
  };

  const handleActivateTenant = async (tenantId: string) => {
    if (!currentSessionId) {
      alert("Session required to manage tenants.");
      return;
    }
    try {
      const res = await fetch("/api/admin/tenants/activate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-id": currentSessionId,
          "x-tenant-id": "saas-admin"
        },
        body: JSON.stringify({ tenantId })
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message);
        fetchTenants();
      } else {
        alert(data.error || data.message || "Failed to activate tenant.");
      }
    } catch (err: any) {
      alert(err.message || "Connection error.");
    }
  };

  const handleQuickRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError("");
    setRegSuccess("");

    if (!businessName.trim()) return setRegError("Business Name is required.");
    if (!ownerName.trim()) return setRegError("Owner Full Name is required.");
    if (!ownerPhone.trim()) return setRegError("Owner Phone Number is required.");
    if (!email.trim()) return setRegError("Email ID is required.");
    if (pin.length !== 5 || isNaN(Number(pin))) {
      return setRegError("Owner PIN passcode must be exactly 5 digits.");
    }

    if (currentSessionId) {
      try {
        const res = await fetch("/api/admin/tenants/register", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-session-id": currentSessionId,
            "x-tenant-id": "saas-admin"
          },
          body: JSON.stringify({
            businessName,
            ownerName,
            ownerPhone,
            email,
            region,
            pin
          })
        });
        const data = await res.json();
        if (data.success) {
          setRegSuccess(`Restaurant "${businessName}" successfully registered & database schema initialized!`);
          fetchTenants();
          
          // Trigger the App.tsx prop logic too to keep client collections in sync if needed
          onRegisterBusiness({
            businessName,
            ownerName,
            ownerPhone,
            email,
            region,
            pin
          });
          
          // Reset fields
          setBusinessName("");
          setOwnerName("");
          setOwnerPhone("");
          setEmail("");
          setPin("");
          setTimeout(() => {
            setShowQuickRegister(false);
            setRegSuccess("");
          }, 3000);
        } else {
          setRegError(data.error || data.message || "Registration failed.");
        }
      } catch (err: any) {
        setRegError(err.message || "Connection error.");
      }
    } else {
      // Fallback fallback
      onRegisterBusiness({
        businessName,
        ownerName,
        ownerPhone,
        email,
        region,
        pin
      });
      setRegSuccess(`Restaurant "${businessName}" successfully registered locally!`);
      // Reset fields
      setBusinessName("");
      setOwnerName("");
      setOwnerPhone("");
      setEmail("");
      setPin("");
      setTimeout(() => {
        setShowQuickRegister(false);
        setRegSuccess("");
      }, 3000);
    }
  };

  // Filtered lists
  const filteredTenants = localTenants.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.tenantId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.ownerName && t.ownerName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (t.email && t.email.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesRegion =
      regionFilter === "all" || (t.region && t.region === regionFilter);
    const matchesStatus =
      statusFilter === "all" || t.status === statusFilter;

    return matchesSearch && matchesRegion && matchesStatus;
  });

  return (
    <div className="h-full p-6 flex flex-col gap-6 overflow-y-auto bg-[#fafbfd] font-sans">
      
      {/* 1. TOP HEADER BANNER - SEAMLESS DYNAMIC INFOGRAPHIC */}
      <div className="bg-gradient-to-r from-pink-500 via-rose-500 to-indigo-600 p-6 md:p-8 rounded-3xl text-white shadow-lg relative overflow-hidden">
        <div className="absolute right-0 bottom-0 top-0 w-1/3 opacity-10 pointer-events-none flex items-center justify-center">
          <Crown className="w-64 h-64" />
        </div>
        
        <div className="relative z-10 max-w-4xl space-y-2">
          <div className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider">
            <Crown className="w-3.5 h-3.5 text-amber-350" />
            <span>VeggiePOS SaaS Master Command Center</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            SaaS Owner Dashboard (सॉस एडमिन पैनल)
          </h1>
          <p className="text-white/80 text-xs md:text-sm max-w-2xl leading-relaxed">
            यहाँ से आप अपने सभी रजिस्टर्ड रेस्टोरेंट्स (Tenants) को लाइव देख सकते हैं, एक क्लिक में उनके डैशबोर्ड पर स्विच कर सकते हैं और रीयल-टाइम डेटा सिंक टेबल्स की निगरानी कर सकते हैं।
          </p>
        </div>
      </div>

      {/* 2. STATS OVERVIEW CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Card 1: Registered Restaurants */}
        <div className="bg-white p-5 border border-slate-100 rounded-2xl shadow-[0_2px_8px_-3px_rgba(0,0,0,0.04)] flex flex-col justify-between hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest font-mono">Total Stores</span>
            <div className="p-2 bg-pink-50 text-pink-600 rounded-xl border border-pink-100/30">
              <Building className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-black text-slate-800 tracking-tight leading-none">
              {tenants.length} <span className="text-xs text-slate-400 font-medium">registered</span>
            </h3>
            <p className="text-[10px] text-slate-500 mt-2 font-medium">
              Active: {tenants.filter(t => t.status === 'active').length} | Pending: {tenants.filter(t => t.status === 'pending').length}
            </p>
          </div>
        </div>

        {/* Card 2: Active Workspace */}
        <div className="bg-white p-5 border border-slate-100 rounded-2xl shadow-[0_2px_8px_-3px_rgba(0,0,0,0.04)] flex flex-col justify-between hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest font-mono">Selected Workspace</span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100/30">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-base font-extrabold text-indigo-600 truncate max-w-[200px]" title={activeTenant.name}>
              {activeTenant.name}
            </h3>
            <p className="text-[10px] text-slate-500 mt-1 font-mono">
              ID: {activeTenant.tenantId}
            </p>
          </div>
        </div>

        {/* Card 3: Cloud Database Connection */}
        <div className="bg-white p-5 border border-slate-100 rounded-2xl shadow-[0_2px_8px_-3px_rgba(0,0,0,0.04)] flex flex-col justify-between hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest font-mono">Database Ingress</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100/30">
              <Database className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-lg font-extrabold text-emerald-700 flex items-center gap-1.5 leading-none">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              Connected
            </h3>
            <p className="text-[10px] text-slate-500 mt-2 font-medium">
              Multi-Tenant Architecture Active
            </p>
          </div>
        </div>

        {/* Card 4: Background Sync Queue */}
        <div className="bg-white p-5 border border-slate-100 rounded-2xl shadow-[0_2px_8px_-3px_rgba(0,0,0,0.04)] flex flex-col justify-between hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest font-mono">Sync Operations</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100/30">
              <RefreshCw className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-black text-slate-800 tracking-tight leading-none">
              99.9% <span className="text-xs text-emerald-600 font-bold">Sync Health</span>
            </h3>
            <p className="text-[10px] text-slate-500 mt-2 font-medium">
              All REST API channels active
            </p>
          </div>
        </div>

      </div>

      {/* 3. BUSINESSES TABLE WITH WORKSPACE SELECTOR */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex flex-col overflow-hidden">
        
        {/* Table Filters Header */}
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
          <div className="space-y-1">
            <h3 className="font-extrabold text-sm text-slate-900 tracking-tight">
              Registered Restaurants & Business Switcher (पंजीकृत रेस्टोरेंट्स)
            </h3>
            <p className="text-[11px] text-slate-500">
              निचे दिए गए किसी भी रेस्टोरेंट के <b>"Activate Workspace"</b> बटन को दबाकर आप तुरंत उसका लाइव डेटा देख और एडिट कर सकते हैं।
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setShowQuickRegister(!showQuickRegister)}
              className="px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm shadow-pink-500/10"
            >
              <Plus className="w-4 h-4" />
              <span>Register New Restaurant</span>
            </button>
            <button
              onClick={handleForceSync}
              disabled={isSyncingAll}
              className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-750 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingAll ? "animate-spin text-pink-600" : ""}`} />
              <span>{isSyncingAll ? "Syncing..." : "Force Database Re-Sync"}</span>
            </button>
          </div>
        </div>

        {/* Quick Registration Form (Expandable) */}
        {showQuickRegister && (
          <div className="p-6 border-b border-slate-150 bg-pink-50/30 space-y-4 animate-in slide-in-from-top-4 duration-200">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-pink-900 uppercase tracking-wider">Fast Restaurant Boarding Form</h4>
                <p className="text-[10px] text-pink-700">Add a new store immediately. It will be assigned a secure isolated tenant schema.</p>
              </div>
              <button
                onClick={() => setShowQuickRegister(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-xs"
              >
                Cancel
              </button>
            </div>

            {regError && (
              <div className="p-3 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl text-xs font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                <span>{regError}</span>
              </div>
            )}

            {regSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl text-xs font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>{regSuccess}</span>
              </div>
            )}

            <form onSubmit={handleQuickRegisterSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase font-mono text-slate-500">Business Name</label>
                <input
                  type="text"
                  placeholder="e.g. Royal Veggie Bistro"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-pink-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase font-mono text-slate-500">Owner Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Rahul Sharma"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-pink-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase font-mono text-slate-500">Owner Phone Number</label>
                <input
                  type="tel"
                  placeholder="e.g. 9876543210"
                  value={ownerPhone}
                  onChange={(e) => setOwnerPhone(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-pink-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase font-mono text-slate-500">Email ID</label>
                <input
                  type="email"
                  placeholder="e.g. owner@veggie.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-pink-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase font-mono text-slate-500">Region</label>
                <select
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 font-medium cursor-pointer focus:outline-none focus:ring-1 focus:ring-pink-500"
                >
                  <option value="North India / Delhi">North India / Delhi</option>
                  <option value="South India / Bengaluru">South India / Bengaluru</option>
                  <option value="West India / Mumbai">West India / Mumbai</option>
                  <option value="East India / Kolkata">East India / Kolkata</option>
                  <option value="Central India">Central India</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase font-mono text-slate-500">5-Digit Owner PIN</label>
                <input
                  type="text"
                  maxLength={5}
                  placeholder="e.g. 11111"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                  className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs tracking-widest text-center font-mono font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-pink-500"
                />
              </div>

              <div className="col-span-1 md:col-span-3 pt-2">
                <button
                  type="submit"
                  className="w-full py-2.5 bg-pink-600 hover:bg-pink-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-pink-500/15"
                >
                  Submit & Provision Schema
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Live Filter Controls */}
        <div className="p-4 border-b border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-3 bg-white">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search stores, owner, email or tenant ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-3 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-pink-500 text-slate-800"
            />
          </div>

          <div>
            <select
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-700 font-medium cursor-pointer focus:outline-none"
            >
              <option value="all">All Regions (सभी क्षेत्र)</option>
              <option value="North India / Delhi">North India / Delhi</option>
              <option value="South India / Bengaluru">South India / Bengaluru</option>
              <option value="West India / Mumbai">West India / Mumbai</option>
              <option value="East India / Kolkata">East India / Kolkata</option>
              <option value="Central India">Central India</option>
            </select>
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-700 font-medium cursor-pointer focus:outline-none"
            >
              <option value="all">All Status (सभी स्टेटस)</option>
              <option value="active">Active System</option>
              <option value="pending">Pending Onboarding</option>
              <option value="suspended">Suspended Workspace</option>
            </select>
          </div>
        </div>

        {/* Businesses List Table */}
        <div className="overflow-x-auto w-full">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider font-mono text-[10px]">
              <tr>
                <th className="p-4">Store Name / Tenant ID</th>
                <th className="p-4">Owner & Contact</th>
                <th className="p-4">Region</th>
                <th className="p-4">Created Date</th>
                <th className="p-4">Plan & Status</th>
                <th className="p-4">Usage Stats</th>
                <th className="p-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {filteredTenants.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-slate-400 italic">
                    No matching registered restaurants found. Try clearing filters or register a new one.
                  </td>
                </tr>
              ) : (
                filteredTenants.map((t) => {
                  const isActiveWorkspace = activeTenant.tenantId === t.tenantId;
                  const isSuspended = t.status === "suspended";
                  
                  return (
                    <tr
                      key={t.id}
                      className={`transition-colors ${
                        isActiveWorkspace ? "bg-indigo-50/30 font-medium" : "hover:bg-slate-50/50"
                      } ${isSuspended ? "bg-red-50/10 opacity-80" : ""}`}
                    >
                      {/* Name & ID */}
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                            isSuspended
                              ? "bg-red-100 text-red-700"
                              : isActiveWorkspace 
                                ? "bg-indigo-100 text-indigo-700"
                                : "bg-pink-50 text-pink-600"
                          }`}>
                            {t.name.charAt(0)}
                          </div>
                          <div>
                            <div className="font-bold text-slate-800 text-xs sm:text-sm flex items-center gap-1.5">
                              <span>{t.name}</span>
                              {isActiveWorkspace && (
                                <span className="px-2 py-0.5 bg-indigo-600 text-white rounded text-[8px] font-mono font-bold">
                                  ACTIVE
                                </span>
                              )}
                              {isSuspended && (
                                <span className="px-2 py-0.5 bg-red-600 text-white rounded text-[8px] font-mono font-bold animate-pulse">
                                  SUSPENDED
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                              ID: {t.tenantId}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Owner Details */}
                      <td className="p-4 space-y-1">
                        <div className="font-semibold text-slate-700 flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-slate-400" />
                          <span>{t.ownerName || "SaaS Demo Partner"}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 flex flex-col gap-0.5">
                          <span className="flex items-center gap-1"><Mail className="w-3 h-3 text-slate-350" /> {t.email || "demo@veggiepos.com"}</span>
                          <span className="flex items-center gap-1"><Phone className="w-3 h-3 text-slate-350" /> {t.ownerPhone || "9876543210"}</span>
                          {t.ownerPin && (
                            <span className="flex items-center gap-1 text-[10px] font-bold font-mono text-indigo-700 bg-indigo-50/70 border border-indigo-100 px-1.5 py-0.5 rounded-md mt-1 w-max">
                              🔑 Owner PIN: {t.ownerPin}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Region */}
                      <td className="p-4">
                        <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 rounded-lg text-slate-700 font-medium">
                          <MapPin className="w-3 h-3 text-pink-500" />
                          <span>{t.region || "Delhi / National Capital"}</span>
                        </div>
                      </td>

                      {/* Created */}
                      <td className="p-4 text-slate-500 font-mono">
                        {t.created}
                      </td>

                      {/* Plan and Status */}
                      <td className="p-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${isSuspended ? "bg-red-500" : "bg-emerald-500"}`} />
                            <span className="font-bold capitalize text-slate-700">
                              {t.plan || "pro"} Plan
                            </span>
                          </div>
                          <p className="text-[9px] text-slate-400 font-mono">
                            Status: <span className={isSuspended ? "text-red-600 font-bold" : "text-emerald-600 font-bold"}>{isSuspended ? "Suspended" : "Active"}</span>
                          </p>
                        </div>
                      </td>

                      {/* Usage Stats */}
                      <td className="p-4">
                        <div className="text-[11px] text-slate-600 space-y-0.5">
                          <div>Staff: <span className="font-mono font-bold text-slate-800">{t.usage?.staffCount ?? 1}</span></div>
                          <div>Monthly Orders: <span className="font-mono font-bold text-slate-800">{t.usage?.monthlyOrders ?? 0}</span></div>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="p-4">
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
                          {/* Workspace select button */}
                          {isActiveWorkspace ? (
                            <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-100 text-indigo-700 rounded-lg text-[10px] font-bold border border-indigo-200">
                              <Check className="w-3 h-3" />
                              <span>Current</span>
                            </div>
                          ) : (
                            <button
                              disabled={isSuspended}
                              onClick={() => {
                                onSelectTenant(t);
                                alert(`Workspace switched successfully to "${t.name}"!`);
                              }}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border flex items-center gap-0.5 shadow-sm transition ${
                                isSuspended
                                  ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                                  : "bg-white hover:bg-indigo-50 text-indigo-600 border-indigo-200 hover:border-indigo-300 cursor-pointer"
                              }`}
                            >
                              <span>Switch</span>
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          )}

                          {/* Suspend / Activate toggle */}
                          {isSuspended ? (
                            <button
                              onClick={() => handleActivateTenant(t.tenantId)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold shadow-sm transition cursor-pointer"
                            >
                              Unsuspend
                            </button>
                          ) : (
                            <button
                              onClick={() => handleSuspendTenant(t.tenantId)}
                              className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 hover:border-red-350 rounded-lg text-[10px] font-bold shadow-sm transition cursor-pointer"
                            >
                              Suspend
                            </button>
                          )}
                        </div>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* 4. REAL-TIME SQL & CLOUD SYNC LIVE STREAM */}
      <div className="bg-white border border-slate-250 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <h3 className="font-extrabold text-sm text-slate-900 tracking-tight flex items-center gap-1.5 font-display">
              <Database className="w-4 h-4 text-pink-600" />
              Restaurant database Sync logs (डेटाबेस रीयल-टाइम लाइव स्ट्रीम)
            </h3>
            <span className="px-2 py-0.5 bg-pink-100 border border-pink-200 text-pink-600 rounded text-[9px] font-mono font-bold animate-pulse">LIVE STREAM</span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">Simulated master syncing protocol active</span>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed">
          SaaS प्लेटफॉर्म का बैकएंड लगातार प्रत्येक स्टोर से जुड़कर नए बिल, बदलती हुई इन्वेंट्री सामग्री और स्टाफ़ की जानकारी को सर्वर पर सिंक करता रहता है। नीचे सिंक डेटा की रीयल-टाइम स्थिति देखें:
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider font-mono text-[9px]">
              <tr>
                <th className="p-3">Log ID</th>
                <th className="p-3">Timestamp</th>
                <th className="p-3">Restaurant Name</th>
                <th className="p-3">Sync Event Type</th>
                <th className="p-3">Records Size</th>
                <th className="p-3">Sync Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150 font-mono text-[11px] text-slate-650">
              {syncLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="p-3 text-pink-600 font-bold">#{log.id}</td>
                  <td className="p-3 text-slate-400">{log.timestamp}</td>
                  <td className="p-3 font-sans font-semibold text-slate-700">{log.tenantName}</td>
                  <td className="p-3">
                    <span className="bg-slate-100 border border-slate-200 text-slate-850 px-1.5 py-0.5 rounded text-[9.5px]">
                      {log.eventType}
                    </span>
                  </td>
                  <td className="p-3 text-slate-500">{log.recordsCount} items</td>
                  <td className="p-3">
                    {log.syncStatus === "SUCCESS" ? (
                      <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-100 text-emerald-700 font-bold rounded-full text-[9px] font-sans">
                        SUCCESS
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-amber-50 border border-amber-100 text-amber-700 font-bold rounded-full text-[9px] font-sans animate-pulse">
                        PENDING
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
