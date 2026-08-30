import { useState, useEffect, useCallback } from "react";
import { RestaurantTenant } from "../types";
import { INITIAL_TENANTS } from "../data";

export const STORE_CODE_STORAGE_KEY = "veggiepos_saved_store_code";
export const ACTIVE_TENANT_ID_STORAGE_KEY = "veggiepos_active_tenant_id";
export const TENANTS_LIST_STORAGE_KEY = "veggiepos_tenants";

export function useTenantData() {
  const [showSignup, setShowSignup] = useState<boolean>(() => {
    return window.location.pathname === "/signup";
  });

  const [showAdminPanel, setShowAdminPanel] = useState<boolean>(() => {
    const hostname = window.location.hostname;
    const searchParams = new URLSearchParams(window.location.search);
    const hasSaasParam = searchParams.get("subdomain") === "saas" || searchParams.get("subdomain") === "admin";
    
    return (
      hostname.startsWith("saas.") || 
      hostname.startsWith("admin.") || 
      hostname.includes("saas-admin") ||
      hasSaasParam
    );
  });

  const [tenants, setTenants] = useState<RestaurantTenant[]>(() => {
    const saved = localStorage.getItem(TENANTS_LIST_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return INITIAL_TENANTS;
  });

  const [activeTenant, setActiveTenant] = useState<RestaurantTenant>(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const urlTenantQuery = searchParams.get("tenant") || searchParams.get("outlet") || searchParams.get("tenantId") || searchParams.get("business");

    const savedStoreCode = localStorage.getItem(STORE_CODE_STORAGE_KEY) || localStorage.getItem(ACTIVE_TENANT_ID_STORAGE_KEY);
    const savedTenantsStr = localStorage.getItem(TENANTS_LIST_STORAGE_KEY);
    let currentTenants = INITIAL_TENANTS;
    if (savedTenantsStr) {
      try {
        const parsed = JSON.parse(savedTenantsStr);
        if (Array.isArray(parsed) && parsed.length > 0) currentTenants = parsed;
      } catch (e) {}
    }

    if (urlTenantQuery) {
      const q = urlTenantQuery.toLowerCase().trim();
      const match = currentTenants.find(
        (t) =>
          t.tenantId.toLowerCase() === q ||
          t.id.toLowerCase() === q ||
          t.name.toLowerCase() === q ||
          t.name.toLowerCase().includes(q)
      );
      if (match) return match;
    }

    if (savedStoreCode) {
      const q = savedStoreCode.toLowerCase().trim();
      const found = currentTenants.find(t => 
        t.tenantId.toLowerCase() === q || 
        t.id.toLowerCase() === q ||
        t.name.toLowerCase() === q ||
        t.name.toLowerCase().replace(/[^a-z0-9]/g, "") === q.replace(/[^a-z0-9]/g, "")
      );
      if (found) return found;
    }
    return currentTenants[0];
  });

  const [activeQrToken, setActiveQrToken] = useState<string>(() => {
    const searchParams = new URLSearchParams(window.location.search);
    return searchParams.get("token") || "";
  });

  // Open terminal only if explicitly navigating to /terminal or /login, or URL tenant query is supplied
  const [showTerminalLogin, setShowTerminalLogin] = useState<boolean>(() => {
    const path = window.location.pathname;
    const searchParams = new URLSearchParams(window.location.search);
    const isTerminalPath = path === "/terminal" || path === "/login";
    const urlTenantQuery = searchParams.get("tenant") || searchParams.get("outlet") || searchParams.get("tenantId") || searchParams.get("business");
    return Boolean(isTerminalPath || urlTenantQuery);
  });

  // Keep path in sync with browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      const searchParams = new URLSearchParams(window.location.search);
      const isTerminalPath = path === "/terminal" || path === "/login";
      const urlTenantQuery = searchParams.get("tenant") || searchParams.get("outlet") || searchParams.get("tenantId") || searchParams.get("business");
      setShowTerminalLogin(Boolean(isTerminalPath || urlTenantQuery));
      setShowSignup(path === "/signup");
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Synchronize specific active tenant from server if URL query is present
  useEffect(() => {
    const syncSpecificTenant = async () => {
      const searchParams = new URLSearchParams(window.location.search);
      const urlTenantQuery = searchParams.get("tenant") || searchParams.get("outlet") || searchParams.get("tenantId") || searchParams.get("business");
      const token = searchParams.get("token") || "";
      
      if (!urlTenantQuery) return;
      if (token) setActiveQrToken(token);

      try {
        const res = await fetch(`/api/auth/tenant-info?q=${encodeURIComponent(urlTenantQuery.trim())}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.success && data.tenant) {
          setActiveTenant(data.tenant);
          setShowTerminalLogin(true);
          setTenants((prev) => {
            const exists = prev.some(t => t.tenantId === data.tenant.tenantId);
            const updated = exists ? prev.map(t => t.tenantId === data.tenant.tenantId ? data.tenant : t) : [...prev, data.tenant];
            localStorage.setItem(TENANTS_LIST_STORAGE_KEY, JSON.stringify(updated));
            return updated;
          });
          localStorage.setItem(STORE_CODE_STORAGE_KEY, data.tenant.tenantId);
          localStorage.setItem(ACTIVE_TENANT_ID_STORAGE_KEY, data.tenant.tenantId);
        }
      } catch (err) {
        console.warn("Failed to fetch tenant info:", err);
      }
    };

    syncSpecificTenant();
  }, []);

  useEffect(() => {
    localStorage.setItem(TENANTS_LIST_STORAGE_KEY, JSON.stringify(tenants));
  }, [tenants]);

  // Connect and persist a store code once to local storage
  const handleConnectStoreCode = useCallback(async (codeOrName: string, qrToken?: string): Promise<{ success: boolean; tenant?: RestaurantTenant; error?: string }> => {
    const query = codeOrName.trim();
    if (!query) return { success: false, error: "Please enter a valid store code or restaurant name." };

    // 1. Check in local tenants cache first for instantaneous response
    const localMatch = tenants.find(
      (t) =>
        t.tenantId.toLowerCase() === query.toLowerCase() ||
        t.id.toLowerCase() === query.toLowerCase() ||
        t.name.toLowerCase() === query.toLowerCase() ||
        t.name.toLowerCase().replace(/[^a-z0-9]/g, "") === query.toLowerCase().replace(/[^a-z0-9]/g, "")
    );

    if (localMatch) {
      setActiveTenant(localMatch);
      if (qrToken) setActiveQrToken(qrToken);
      localStorage.setItem(STORE_CODE_STORAGE_KEY, localMatch.tenantId);
      localStorage.setItem(ACTIVE_TENANT_ID_STORAGE_KEY, localMatch.tenantId);
      setShowTerminalLogin(true);
      return { success: true, tenant: localMatch };
    }

    // 2. Query the server directory
    try {
      const res = await fetch(`/api/auth/tenant-info?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (!res.ok || !data.success || !data.tenant) {
        return { success: false, error: data.error || `Restaurant outlet "${query}" not found.` };
      }

      const fetchedTenant: RestaurantTenant = data.tenant;
      setActiveTenant(fetchedTenant);
      if (qrToken) setActiveQrToken(qrToken);
      setTenants((prev) => {
        const exists = prev.some(t => t.tenantId === fetchedTenant.tenantId);
        const updated = exists ? prev.map(t => t.tenantId === fetchedTenant.tenantId ? fetchedTenant : t) : [...prev, fetchedTenant];
        localStorage.setItem(TENANTS_LIST_STORAGE_KEY, JSON.stringify(updated));
        return updated;
      });
      localStorage.setItem(STORE_CODE_STORAGE_KEY, fetchedTenant.tenantId);
      localStorage.setItem(ACTIVE_TENANT_ID_STORAGE_KEY, fetchedTenant.tenantId);
      setShowTerminalLogin(true);
      return { success: true, tenant: fetchedTenant };
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to reach server. Please check internet connection." };
    }
  }, [tenants]);

  // Clear saved store code from local storage and return to landing page
  const handleClearSavedStore = useCallback(() => {
    localStorage.removeItem(STORE_CODE_STORAGE_KEY);
    localStorage.removeItem(ACTIVE_TENANT_ID_STORAGE_KEY);
    setShowTerminalLogin(false);
  }, []);

  const handleRegisterTenant = useCallback((newTenant: RestaurantTenant) => {
    setTenants((prev) => {
      const exists = prev.some(t => t.tenantId === newTenant.tenantId);
      const updated = exists ? prev.map(t => t.tenantId === newTenant.tenantId ? newTenant : t) : [...prev, newTenant];
      localStorage.setItem(TENANTS_LIST_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
    setActiveTenant(newTenant);
    localStorage.setItem(STORE_CODE_STORAGE_KEY, newTenant.tenantId);
    localStorage.setItem(ACTIVE_TENANT_ID_STORAGE_KEY, newTenant.tenantId);
    setShowTerminalLogin(true);
  }, []);

  const handleSwitchTenant = useCallback((tenant: RestaurantTenant, qrToken?: string) => {
    setActiveTenant(tenant);
    if (qrToken) setActiveQrToken(qrToken);
    setShowTerminalLogin(true);
    setTenants((prev) => {
      const exists = prev.some(t => t.tenantId === tenant.tenantId);
      const updated = exists ? prev.map(t => t.tenantId === tenant.tenantId ? tenant : t) : [...prev, tenant];
      localStorage.setItem(TENANTS_LIST_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
    localStorage.setItem(STORE_CODE_STORAGE_KEY, tenant.tenantId);
    localStorage.setItem(ACTIVE_TENANT_ID_STORAGE_KEY, tenant.tenantId);
  }, []);

  return {
    showSignup,
    setShowSignup,
    showAdminPanel,
    setShowAdminPanel,
    tenants,
    setTenants,
    activeTenant,
    setActiveTenant,
    activeQrToken,
    setActiveQrToken,
    showTerminalLogin,
    setShowTerminalLogin,
    handleRegisterTenant,
    handleSwitchTenant,
    handleConnectStoreCode,
    handleClearSavedStore
  };
}
