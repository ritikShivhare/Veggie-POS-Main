import React, { createContext, useContext } from "react";
import { useTenantData } from "../hooks/useTenantData";
import { useSyncState } from "../hooks/useSyncState";
import { useAuthSession } from "../hooks/useAuthSession";
import { MenuItem, Ingredient, Recipe, Purchase, StaffMember, Shift, Order, RestaurantTenant, InventorySettings, Customer } from "../types";

export interface AppContextType {
  // Tenant states
  showSignup: boolean;
  setShowSignup: React.Dispatch<React.SetStateAction<boolean>>;
  showAdminPanel: boolean;
  setShowAdminPanel: React.Dispatch<React.SetStateAction<boolean>>;
  tenants: RestaurantTenant[];
  setTenants: React.Dispatch<React.SetStateAction<RestaurantTenant[]>>;
  activeTenant: RestaurantTenant;
  setActiveTenant: React.Dispatch<React.SetStateAction<RestaurantTenant>>;
  activeQrToken: string;
  setActiveQrToken: React.Dispatch<React.SetStateAction<string>>;
  showTerminalLogin: boolean;
  setShowTerminalLogin: React.Dispatch<React.SetStateAction<boolean>>;
  handleRegisterTenant: (newTenant: RestaurantTenant) => void;
  handleSwitchTenant: (tenant: RestaurantTenant, qrToken?: string) => void;
  handleConnectStoreCode: (codeOrName: string, qrToken?: string) => Promise<{ success: boolean; tenant?: RestaurantTenant; error?: string }>;
  handleClearSavedStore: () => void;

  // Sync state & data lists
  menuItems: MenuItem[];
  setMenuItems: React.Dispatch<React.SetStateAction<MenuItem[]>>;
  ingredients: Ingredient[];
  setIngredients: React.Dispatch<React.SetStateAction<Ingredient[]>>;
  recipes: Recipe[];
  setRecipes: React.Dispatch<React.SetStateAction<Recipe[]>>;
  staffList: StaffMember[];
  setStaffList: React.Dispatch<React.SetStateAction<StaffMember[]>>;
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  customers: Customer[];
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
  purchases: Purchase[];
  setPurchases: React.Dispatch<React.SetStateAction<Purchase[]>>;
  shifts: Shift[];
  setShifts: (shifts: Shift[]) => void;
  isInitialSyncLoading: boolean;
  settings: InventorySettings;
  setSettings: React.Dispatch<React.SetStateAction<InventorySettings>>;
  toastMessage: { type: "success" | "error"; text: string } | null;
  setToastMessage: React.Dispatch<React.SetStateAction<{ type: "success" | "error"; text: string } | null>>;
  aiReport: string;
  setAiReport: React.Dispatch<React.SetStateAction<string>>;
  isGeneratingReport: boolean;
  reportError: string;
  pendingOwnerRef: React.MutableRefObject<StaffMember | null>;
  dashboardStats: {
    totalRevenue: number;
    cashRevenue: number;
    upiRevenue: number;
    totalOrders: number;
    activeShiftsCount: number;
    lowStockItems: Ingredient[];
    totalStockValue: number;
    topSellingItems: { name: string; qty: number; sales: number }[];
  };
  handleGenerateAIReport: () => Promise<void>;
  handleOrderCreated: (newOrder: Order) => void;
  handleUpdateOrderStatus: (orderId: string, nextStatus: any, paymentMethod?: 'Cash' | 'UPI', paidAt?: string) => void;
  handleUpdateIngredients: (updated: Ingredient[]) => void;
  handleUpdateRecipes: (updated: Recipe[]) => void;
  handleUpdateMenuItems: (updated: MenuItem[]) => void;
  handleAddPurchase: (purchase: Purchase) => void;

  // Auth / Session states
  currentStaff: StaffMember | null;
  setCurrentStaff: React.Dispatch<React.SetStateAction<StaffMember | null>>;
  currentSessionId: string | null;
  setCurrentSessionId: React.Dispatch<React.SetStateAction<string | null>>;
  showIdleWarning: boolean;
  setShowIdleWarning: React.Dispatch<React.SetStateAction<boolean>>;
  idleCountdown: number;
  activeShift: Shift | null;
  handleLoginSuccess: (staff: StaffMember, sessionId?: string, loggedInTenant?: any) => void;
  handleLogout: () => void;
  handleShiftAction: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppContextProvider({ children }: { children: React.ReactNode }) {
  const tenant = useTenantData();

  const [currentStaff, setCurrentStaff] = React.useState<StaffMember | null>(() => {
    const saved = localStorage.getItem("veggiepos_current_staff");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.name) {
          return parsed;
        }
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  const [currentSessionId, setCurrentSessionId] = React.useState<string | null>(() => {
    const savedStaff = localStorage.getItem("veggiepos_current_staff");
    if (savedStaff) {
      try {
        const parsed = JSON.parse(savedStaff);
        if (parsed && parsed.name) {
          return localStorage.getItem("veggiepos_current_session_id") || null;
        }
      } catch (e) {}
    }
    return null;
  });

  // Run Auth hook or Sync hook depending on tenant
  const sync = useSyncState({
    activeTenantId: tenant.activeTenant.tenantId,
    currentStaff,
    currentSessionId
  });

  const auth = useAuthSession({
    activeTenantId: tenant.activeTenant.tenantId,
    shifts: sync.shifts,
    setShifts: sync.setShifts,
    staffList: sync.staffList,
    currentStaff,
    setCurrentStaff,
    currentSessionId,
    setCurrentSessionId
  });

  const handleLoginSuccess = (staff: StaffMember, sessionId?: string, loggedInTenant?: any) => {
    if (loggedInTenant && loggedInTenant.tenantId) {
      tenant.handleRegisterTenant(loggedInTenant);
      tenant.setActiveTenant(loggedInTenant);
    }
    auth.handleLoginSuccess(staff, sessionId);
  };

  const value: AppContextType = {
    ...tenant,
    ...sync,
    ...auth,
    handleLoginSuccess,
    currentStaff,
    setCurrentStaff,
    currentSessionId,
    setCurrentSessionId
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useAppContext must be used within an AppContextProvider");
  }
  return context;
}
