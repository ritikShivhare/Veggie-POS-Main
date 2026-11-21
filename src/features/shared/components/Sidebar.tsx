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
  Crown,
  X
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
  const [isDesktop, setIsDesktop] = React.useState(() => typeof window !== "undefined" && (window.matchMedia ? window.matchMedia("(min-width: 1024px)").matches : window.innerWidth >= 1024));
  const drawerRef = React.useRef<HTMLElement>(null);
  const closeMobileRef = React.useRef(onCloseMobile);
  React.useEffect(() => { closeMobileRef.current = onCloseMobile; }, [onCloseMobile]);
  React.useEffect(() => {
    const query = window.matchMedia?.("(min-width: 1024px)");
    if (!query) return;
    const update = () => setIsDesktop(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  React.useEffect(() => {
    if (isDesktop && isOpenMobile) closeMobileRef.current?.();
    if (isDesktop || !isOpenMobile || !drawerRef.current) return;
    const drawer = drawerRef.current;
    const previousFocus = document.activeElement as HTMLElement | null;
    const focusable = () => Array.from(drawer.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]'))
      .filter((element) => element.getClientRects().length > 0);
    (focusable()[0] || drawer).focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); closeMobileRef.current?.(); return; }
      if (event.key !== "Tab") return;
      const controls = focusable(), first = controls[0], last = controls.at(-1);
      if (!first) { event.preventDefault(); drawer.focus(); return; }
      if (!drawer.contains(document.activeElement) || (event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last)) {
        event.preventDefault(); (event.shiftKey ? last : first)?.focus();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [isDesktop, isOpenMobile]);
  const handleShiftAction = () => { onCloseMobile?.(); onShiftAction(); };

  const menuItems: Array<{ id: string; label: string; icon: any; permission?: string; role?: string }> = [
    { id: "saas-admin", label: "SaaS Admin Panel", icon: Crown, role: "Owner" },
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, role: "Owner" },
    { id: "billing", label: "POS Billing", icon: ShoppingCart, permission: "billing" },
    { id: "kds", label: "Kitchen (KDS)", icon: ChefHat, permission: "billing" },
    { id: "crm", label: "CRM & Loyalty", icon: Users, permission: "billing" },
    { id: "inventory", label: "Inventory & Recipes", icon: Boxes, permission: "inventory" },
    { id: "shifts", label: "Staff Shifts", icon: Clock, permission: "billing" },
    { id: "ai-reports", label: "Automated AI Reports", icon: FileText, role: "Owner" },
    { id: "jobs", label: "Background Jobs", icon: Cpu, permission: "settings" },
    { id: "notifications", label: "Notification Center", icon: Bell },
    { id: "settings", label: "Settings", icon: Settings, role: "Owner" }
  ];

  // Filter menu items by permissions and roles
  const filteredMenuItems = menuItems.filter((item) => {
    if (["jobs","monitoring"].includes(item.id)) return currentStaff.role==="SaaS Owner";
    if (item.id === "delivery") return false;
    if (item.id === "saas-admin") {
      // Completely removed from the restaurant terminal sidebar as requested
      return false;
    }
    if (item.role && currentStaff.role !== item.role) return false;
    if (["billing","kds"].includes(item.id) && currentStaff.permissions.includes("orders")) return true;
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
          aria-hidden="true"
          onClick={onCloseMobile}
        />
      )}

      <aside
        ref={drawerRef}
        id="main-sidebar"
        tabIndex={-1}
        inert={!isDesktop && !isOpenMobile}
        aria-hidden={!isDesktop && !isOpenMobile ? true : undefined}
        role={!isDesktop && isOpenMobile ? "dialog" : undefined}
        aria-modal={!isDesktop && isOpenMobile ? true : undefined}
        aria-label="Main menu"
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
                  A
                </div>
                <div className="flex flex-col">
                  <h1 className="text-sm font-extrabold text-slate-800 tracking-tight leading-none">
                    Aatmyam Pos
                  </h1>
                  <p className="text-[9px] uppercase tracking-wider text-slate-600 mt-1 font-mono font-bold">
                    SYSTEM TERMINAL
                  </p>
                </div>
              </div>
            ) : null}

            {/* Collapsible toggle (three lines / hamburger icon) */}
            <button
              onClick={() => { if (!isDesktop && isOpenMobile) onCloseMobile?.(); else setIsCollapsed(!isCollapsed); }}
              className={`min-h-11 min-w-11 p-2 rounded-lg text-slate-600 hover:text-slate-700 hover:bg-slate-100 transition-all duration-150 focus:outline-none shrink-0 cursor-pointer ${
                collapsedMode ? "lg:w-10 lg:h-10 lg:flex lg:items-center lg:justify-center lg:mx-auto" : ""
              }`}
              id="sidebar-toggle-collapse-btn"
              aria-label={!isDesktop && isOpenMobile ? "Close menu" : isCollapsed ? "Expand menu" : "Collapse menu"}
              title={!isDesktop && isOpenMobile ? "Close menu" : isCollapsed ? "Expand Menu" : "Collapse Menu"}
            >
              {!isDesktop && isOpenMobile ? <X aria-hidden="true" className="w-5 h-5" /> : <Menu aria-hidden="true" className="w-5 h-5" />}
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
                  onClick={handleShiftAction}
                  className="w-11 h-11 rounded-lg bg-pink-50 border border-pink-100 flex items-center justify-center text-pink-700 font-bold text-sm shrink-0 hover:bg-pink-100/70 transition-all duration-150 relative cursor-pointer"
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
                  <p className="text-[10px] text-slate-600 capitalize mt-0.5">{currentStaff.role}</p>
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
                  <div className="w-8 h-8 rounded-lg bg-pink-50 border border-pink-100 flex items-center justify-center text-pink-700 font-bold text-xs shrink-0">
                    {currentStaff.name.charAt(0)}
                  </div>
                  <div className="overflow-hidden">
                    <h2 className="font-semibold text-slate-800 text-xs truncate">
                      {currentStaff.name}
                    </h2>
                    <p className="text-[10px] text-slate-600 font-medium capitalize mt-0.5">
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
                    onClick={handleShiftAction}
                    className={`min-h-11 px-3 py-2 rounded text-xs font-bold transition duration-150 cursor-pointer ${
                      activeShift
                        ? "bg-rose-50 text-rose-800 border border-rose-100 hover:bg-rose-100/70"
                        : "bg-emerald-50 text-emerald-800 border border-emerald-100 hover:bg-emerald-100/70"
                    }`}
                    id="sidebar-shift-action-btn"
                  >
                    {activeShift ? "Clock Out" : "Clock In"}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* NATIVE SCROLLABLE NAVIGATION */}
          <div className="relative flex-1 min-h-0 flex flex-col mt-2">
            <nav
              id="sidebar-navigation"
              aria-label="Main navigation"
              tabIndex={0}
              className="flex-1 overflow-y-auto p-2 space-y-1.5"
            >
              {filteredMenuItems.map((item) => {
                const IconComponent = item.icon;
                const isSelected = activeTab === item.id;

                return (
                  <div key={item.id} className="relative group px-1">
                    <button
                      aria-label={item.label}
                      aria-current={isSelected ? "page" : undefined}
                      onClick={() => {
                        setActiveTab(item.id);
                        onCloseMobile?.();
                      }}
                      className={`w-full flex items-center transition-all duration-150 rounded-lg text-xs cursor-pointer ${
                        collapsedMode
                          ? "justify-center h-11 w-11 mx-auto"
                          : "min-h-11 gap-3 px-3 py-2.5 text-left"
                      } ${
                        isSelected
                          ? "bg-pink-50/70 text-pink-700 border-l-2 border-pink-500 font-semibold shadow-sm"
                          : "hover:bg-slate-50 text-slate-500 hover:text-slate-800 font-medium"
                      }`}
                      id={`sidebar-tab-btn-${item.id}`}
                    >
                      <IconComponent className={`shrink-0 transition-transform duration-150 ${
                        collapsedMode ? "w-5 h-5 group-hover:scale-110" : "w-4 h-4"
                      } ${isSelected ? "text-pink-500" : "text-slate-600 group-hover:text-slate-600"}`} />

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
                className="w-11 h-11 flex items-center justify-center bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-100 rounded-lg transition duration-150 cursor-pointer"
                id="sidebar-logout-btn-collapsed"
                aria-label="Lock Terminal"
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
                className="min-h-11 w-full flex items-center justify-center space-x-2 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-150 py-2.5 rounded-lg font-semibold text-xs transition duration-150 cursor-pointer"
                id="sidebar-logout-btn"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Lock Terminal</span>
              </button>
              <p className="text-center text-[9px] text-slate-600 mt-3 font-mono">
                Aatmyam Pos 1.20
              </p>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
