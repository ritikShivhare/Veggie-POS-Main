import React from "react";
import { StaffMember, Shift, RestaurantTenant } from "../types";
import {
  LayoutDashboard,
  ChefHat,
  Boxes,
  Clock,
  Settings,
  FileText,
  LogOut,
  Users,
  Smartphone,
  Menu,
  ShoppingCart,
  Cpu,
  Bell,
  Zap,
  Shield,
  Activity,
  ChevronUp,
  ChevronDown,
  Crown
} from "lucide-react";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentStaff: StaffMember;
  onLogout: () => void;
  activeShift: Shift | null;
  onShiftAction: () => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
  activeTenant: RestaurantTenant;
}

export default function Sidebar({
  activeTab,
  setActiveTab,
  currentStaff,
  onLogout,
  activeShift,
  onShiftAction,
  isOpenMobile,
  onCloseMobile,
  activeTenant
}: SidebarProps) {
  // Local state for collapse/slim mode on desktop
  const [isCollapsed, setIsCollapsed] = React.useState(true);

  // Custom scrolling references and state for tabs overflow
  const navRef = React.useRef<HTMLDivElement>(null);
  const [showUpBtn, setShowUpBtn] = React.useState(false);
  const [showDownBtn, setShowDownBtn] = React.useState(false);

  const checkScroll = () => {
    if (navRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = navRef.current;
      setShowUpBtn(scrollTop > 5);
      setShowDownBtn(scrollTop + clientHeight < scrollHeight - 5);
    }
  };

  const scrollUp = () => {
    navRef.current?.scrollBy({ top: -140, behavior: "smooth" });
  };

  const scrollDown = () => {
    navRef.current?.scrollBy({ top: 140, behavior: "smooth" });
  };

  React.useEffect(() => {
    const el = navRef.current;
    if (el) {
      el.addEventListener("scroll", checkScroll);
      window.addEventListener("resize", checkScroll);
      checkScroll();
      
      const timer = setTimeout(checkScroll, 300);
      return () => {
        el.removeEventListener("scroll", checkScroll);
        window.removeEventListener("resize", checkScroll);
        clearTimeout(timer);
      };
    }
  }, [currentStaff, isCollapsed]);

  const menuItems: Array<{ id: string; label: string; icon: any; permission?: string; role?: string }> = [
    { id: "saas-admin", label: "SaaS Admin Panel", icon: Crown, role: "Owner" },
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, permission: "reports" },
    { id: "billing", label: "POS Billing", icon: ShoppingCart, permission: "billing" },
    { id: "kds", label: "Kitchen (KDS)", icon: ChefHat, permission: "billing" },
    { id: "crm", label: "CRM & Loyalty", icon: Users, permission: "billing" },
    { id: "inventory", label: "Inventory & Recipes", icon: Boxes, permission: "inventory" },
    { id: "shifts", label: "Staff Shifts", icon: Clock, permission: "billing" },
    { id: "ai-reports", label: "Automated AI Reports", icon: FileText, permission: "reports" },
    { id: "jobs", label: "Background Jobs", icon: Cpu, permission: "settings" },
    { id: "notifications", label: "Notification Center", icon: Bell, permission: "billing" },
    { id: "events", label: "Events & Audit", icon: Zap, permission: "billing" },
    { id: "security", label: "Security & Sessions", icon: Shield, permission: "settings" },
    { id: "settings", label: "Settings", icon: Settings, permission: "settings" }
  ];

  // Filter menu items by permissions and roles
  const filteredMenuItems = menuItems.filter((item) => {
    if (item.id === "saas-admin") {
      // Completely removed from the restaurant terminal sidebar as requested
      return false;
    }
    if (item.role && currentStaff.role !== item.role) return false;
    if (item.permission && !currentStaff.permissions.includes(item.permission as any)) return false;
    return true;
  });

  const collapsedMode = isCollapsed && !isOpenMobile;

  return (
    <>
      {/* Backdrop for mobile (Clean semi-transparent background WITHOUT BLUR exactly as requested) */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/20 lg:hidden transition-opacity duration-300"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 bg-white border-r border-slate-200/85 flex flex-col justify-between text-slate-600 font-sans select-none shrink-0 shadow-lg transition-all duration-300 ease-in-out lg:static lg:translate-x-0 ${
          isCollapsed ? "w-64 lg:w-[72px]" : "w-64"
        } ${
          isOpenMobile ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* UPPER BRAND & TOGGLE SECTION + CURRENT ACTIVE STAFF DETAILS + SCROLLABLE NAV */}
        <div className="flex flex-col flex-1 min-h-0">
          <div className={`p-4 border-b border-slate-100 flex items-center transition-all duration-300 shrink-0 ${
            collapsedMode ? "lg:justify-center justify-between" : "justify-between"
          }`}>
            {/* Show brand logo ONLY when expanded OR on mobile screens */}
            {(!isCollapsed || isOpenMobile) ? (
              <div className="flex items-center gap-2.5 overflow-hidden transition-all duration-300">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-pink-500 to-rose-500 flex items-center justify-center text-white text-base font-black shadow-md shadow-rose-500/10 shrink-0">
                  V
                </div>
                <div className="flex flex-col">
                  <h1 className="text-sm font-extrabold text-slate-800 tracking-tight leading-none">
                    VEGGIE<span className="text-pink-600 font-extrabold">POS</span>
                  </h1>
                  <p className="text-[9px] uppercase tracking-wider text-slate-400 mt-1 font-mono font-bold">
                    SYSTEM TERMINAL
                  </p>
                </div>
              </div>
            ) : null}

            {/* Collapsible toggle (three lines / hamburger icon) */}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className={`p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all duration-150 focus:outline-none shrink-0 cursor-pointer ${
                collapsedMode ? "lg:w-10 lg:h-10 lg:flex lg:items-center lg:justify-center lg:mx-auto" : ""
              }`}
              id="sidebar-toggle-collapse-btn"
              title={isCollapsed ? "Expand Menu" : "Collapse Menu"}
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>

          {/* CURRENT ACTIVE STAFF DETAILS */}
          <div className={`px-3 py-4 border-b border-slate-100 shrink-0 transition-all duration-300 ${
            collapsedMode ? "flex justify-center" : ""
          }`}>
            {collapsedMode ? (
              // Collapsed Staff Avatar & Quick Action with premium multi-detail popover
              <div className="relative group">
                <button
                  onClick={onShiftAction}
                  className="w-10 h-10 rounded-lg bg-pink-50 border border-pink-100 flex items-center justify-center text-pink-600 font-bold text-sm shrink-0 hover:bg-pink-100/70 transition-all duration-150 relative cursor-pointer"
                  id="sidebar-collapsed-staff-btn"
                >
                  {currentStaff.name.charAt(0)}
                  {/* Status dot indicating active shift status */}
                  <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${
                    activeShift ? "bg-emerald-500" : "bg-rose-500"
                  }`} />
                </button>

                {/* Staff and Shift popover */}
                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 p-3 bg-white text-slate-800 rounded-xl shadow-xl border border-slate-200 pointer-events-none opacity-0 translate-x-[-6px] group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 z-[100] min-w-[180px]">
                  <div className="absolute top-1/2 -left-1 -translate-y-1/2 w-1.5 h-1.5 bg-white border-b border-l border-slate-200 rotate-45" />
                  <p className="font-semibold text-xs text-slate-800">{currentStaff.name}</p>
                  <p className="text-[10px] text-slate-400 capitalize mt-0.5">{currentStaff.role}</p>
                  <div className="mt-2 pt-2 border-t border-slate-100 flex items-center gap-1.5 text-[10px]">
                    <span className={`w-1.5 h-1.5 rounded-full ${activeShift ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
                    <span className="text-slate-500 font-medium">{activeShift ? "Shift Active (Click to clock out)" : "Off-Duty (Click to clock in)"}</span>
                  </div>
                </div>
              </div>
            ) : (
              // Expanded Staff Details and Roster Status
              <>
                <div className="flex items-center space-x-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <div className="w-8 h-8 rounded-lg bg-pink-50 border border-pink-100 flex items-center justify-center text-pink-600 font-bold text-xs shrink-0">
                    {currentStaff.name.charAt(0)}
                  </div>
                  <div className="overflow-hidden">
                    <h2 className="font-semibold text-slate-800 text-xs truncate">
                      {currentStaff.name}
                    </h2>
                    <p className="text-[10px] text-slate-400 font-medium capitalize mt-0.5">
                      {currentStaff.role}
                    </p>
                  </div>
                </div>

                {/* Shift status */}
                <div className="mt-3 flex items-center justify-between bg-slate-50/50 px-3 py-2 rounded-lg text-[11px] border border-slate-100">
                  <div className="flex items-center space-x-2">
                    <div
                      className={`w-1.5 h-1.5 rounded-full ${
                        activeShift ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
                      }`}
                    />
                    <span className="text-slate-500 font-medium text-[11px]">
                      {activeShift ? "Shift Active" : "Off-Duty"}
                    </span>
                  </div>
                  <button
                    onClick={onShiftAction}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition duration-150 cursor-pointer ${
                      activeShift
                        ? "bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-100/70"
                        : "bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-100/70"
                    }`}
                    id="sidebar-shift-action-btn"
                  >
                    {activeShift ? "Clock Out" : "Clock In"}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* NAVIGATION ITEMS LIST WITH DYNAMIC SCROLL CONTROLS */}
          <div className="relative flex-1 min-h-0 flex flex-col mt-2">
            {showUpBtn && (
              <button
                onClick={scrollUp}
                className="absolute top-1 inset-x-0 mx-auto z-10 w-7 h-7 rounded-full bg-white/95 border border-pink-100 flex items-center justify-center text-pink-600 hover:bg-pink-50 shadow-md hover:shadow-lg transition-all duration-150 cursor-pointer animate-bounce"
                title="Scroll Up"
                id="sidebar-scroll-up-btn"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
            )}

            <nav
              ref={navRef}
              className="flex-1 overflow-y-auto p-2 space-y-1.5 scrollbar-none"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              onScroll={checkScroll}
            >
              {filteredMenuItems.map((item) => {
                const IconComponent = item.icon;
                const isSelected = activeTab === item.id;

                return (
                  <div key={item.id} className="relative group px-1">
                    <button
                      onClick={() => {
                        setActiveTab(item.id);
                        onCloseMobile?.();
                      }}
                      className={`w-full flex items-center transition-all duration-150 rounded-lg text-xs cursor-pointer ${
                        collapsedMode
                          ? "justify-center h-10 w-10 mx-auto"
                          : "gap-3 px-3 py-2.5 text-left"
                      } ${
                        isSelected
                          ? "bg-pink-50/70 text-pink-600 border-l-2 border-pink-500 font-semibold shadow-sm"
                          : "hover:bg-slate-50 text-slate-500 hover:text-slate-800 font-medium"
                      }`}
                      id={`sidebar-tab-btn-${item.id}`}
                    >
                      <IconComponent className={`shrink-0 transition-transform duration-150 ${
                        collapsedMode ? "w-5 h-5 group-hover:scale-110" : "w-4 h-4"
                      } ${isSelected ? "text-pink-500" : "text-slate-400 group-hover:text-slate-600"}`} />
                      
                      {!collapsedMode && (
                        <span className="truncate text-slate-600 group-hover:text-slate-900 transition-colors duration-150">
                          {item.label}
                        </span>
                      )}
                    </button>

                    {/* FLOATING HOVER TOOLTIP (Only shown in Collapsed mode on desktop) */}
                    {collapsedMode && (
                      <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-1.5 bg-white text-slate-800 text-[11px] font-semibold rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.08)] border border-slate-200/60 pointer-events-none opacity-0 translate-x-[-6px] group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 z-[100] whitespace-nowrap">
                        <div className="absolute top-1/2 -left-1 -translate-y-1/2 w-1.5 h-1.5 bg-white border-b border-l border-slate-200/60 rotate-45" />
                        {item.label}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>

            {showDownBtn && (
              <button
                onClick={scrollDown}
                className="absolute bottom-1 inset-x-0 mx-auto z-10 w-7 h-7 rounded-full bg-white/95 border border-pink-100 flex items-center justify-center text-pink-600 hover:bg-pink-50 shadow-md hover:shadow-lg transition-all duration-150 cursor-pointer animate-bounce"
                title="Scroll Down"
                id="sidebar-scroll-down-btn"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* FOOTER SYSTEM LOCK / TERMINAL SHUTDOWN */}
        <div className={`p-4 border-t border-slate-100 transition-all duration-300 ${
          collapsedMode ? "flex justify-center" : ""
        }`}>
          {collapsedMode ? (
            // Collapsed Lock Button with floating tooltip
            <div className="relative group">
              <button
                onClick={() => {
                  onLogout();
                  onCloseMobile?.();
                }}
                className="w-10 h-10 flex items-center justify-center bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 rounded-lg transition duration-150 cursor-pointer"
                id="sidebar-logout-btn-collapsed"
              >
                <LogOut className="w-4 h-4" />
              </button>
              <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-1.5 bg-white text-slate-800 text-[11px] font-semibold rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.08)] border border-slate-200/60 pointer-events-none opacity-0 translate-x-[-6px] group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 z-[100] whitespace-nowrap">
                <div className="absolute top-1/2 -left-1 -translate-y-1/2 w-1.5 h-1.5 bg-white border-b border-l border-slate-200/60 rotate-45" />
                Lock Terminal
              </div>
            </div>
          ) : (
            // Expanded Lock Button with label
            <>
              <button
                onClick={() => {
                  onLogout();
                  onCloseMobile?.();
                }}
                className="w-full flex items-center justify-center space-x-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-150 py-2.5 rounded-lg font-semibold text-xs transition duration-150 cursor-pointer"
                id="sidebar-logout-btn"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Lock Terminal</span>
              </button>
              <p className="text-center text-[9px] text-slate-400 mt-3 font-mono">
                VeggiePOS 1.20
              </p>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
