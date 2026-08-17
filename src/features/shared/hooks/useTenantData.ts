import { useState, useEffect } from "react";
import { RestaurantTenant } from "../types";
import { INITIAL_TENANTS } from "../data";

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
    const saved = localStorage.getItem("veggiepos_tenants");
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

    const savedActiveId = localStorage.getItem("veggiepos_active_tenant_id");
    const savedTenantsStr = localStorage.getItem("veggiepos_tenants");
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

    if (savedActiveId) {
      const found = currentTenants.find(t => t.tenantId === savedActiveId || t.id === savedActiveId);
      if (found) return found;
    }
    return currentTenants[0];
  });

  const [activeQrToken, setActiveQrToken] = useState<string>(() => {
    const searchParams = new URLSearchParams(window.location.search);
    return searchParams.get("token") || "";
  });

  const [showTerminalLogin, setShowTerminalLogin] = useState<boolean>(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const urlTenantQuery = searchParams.get("tenant") || searchParams.get("outlet") || searchParams.get("tenantId") || searchParams.get("business");
    const savedActiveId = localStorage.getItem("veggiepos_active_tenant_id");
    return Boolean(urlTenantQuery || savedActiveId);
  });

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
            localStorage.setItem("veggiepos_tenants", JSON.stringify(updated));
            return updated;
          });
          localStorage.setItem("veggiepos_active_tenant_id", data.tenant.tenantId);
        }
      } catch (err) {
        console.warn("Failed to fetch tenant info:", err);
      }
    };

    syncSpecificTenant();
  }, []);

  useEffect(() => {
    localStorage.setItem("veggiepos_tenants", JSON.stringify(tenants));
  }, [tenants]);

  const [firstMountPassed, setFirstMountPassed] = useState(false);

  useEffect(() => {
    const savedActiveId = localStorage.getItem("veggiepos_active_tenant_id");
    if (!firstMountPassed) {
      setFirstMountPassed(true);
      if (!savedActiveId) {
        return;
      }
    }
    localStorage.setItem("veggiepos_active_tenant_id", activeTenant.tenantId);
  }, [activeTenant, firstMountPassed]);

  const handleRegisterTenant = (newTenant: RestaurantTenant) => {
    setTenants((prev) => {
      const exists = prev.some(t => t.tenantId === newTenant.tenantId);
      const updated = exists ? prev.map(t => t.tenantId === newTenant.tenantId ? newTenant : t) : [...prev, newTenant];
      localStorage.setItem("veggiepos_tenants", JSON.stringify(updated));
      return updated;
    });
    setActiveTenant(newTenant);
    localStorage.setItem("veggiepos_active_tenant_id", newTenant.tenantId);
  };

  const handleSwitchTenant = (tenant: RestaurantTenant, qrToken?: string) => {
    setActiveTenant(tenant);
    if (qrToken) setActiveQrToken(qrToken);
    setShowTerminalLogin(true);
    setTenants((prev) => {
      const exists = prev.some(t => t.tenantId === tenant.tenantId);
      const updated = exists ? prev.map(t => t.tenantId === tenant.tenantId ? tenant : t) : [...prev, tenant];
      localStorage.setItem("veggiepos_tenants", JSON.stringify(updated));
      return updated;
    });
    localStorage.setItem("veggiepos_active_tenant_id", tenant.tenantId);
  };

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
    handleSwitchTenant
  };
}
