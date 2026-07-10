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
        return JSON.parse(saved);
      } catch (e) {
        return INITIAL_TENANTS;
      }
    }
    return INITIAL_TENANTS;
  });

  const [activeTenant, setActiveTenant] = useState<RestaurantTenant>(() => {
    const savedActiveId = localStorage.getItem("veggiepos_active_tenant_id");
    const savedTenantsStr = localStorage.getItem("veggiepos_tenants");
    let currentTenants = INITIAL_TENANTS;
    if (savedTenantsStr) {
      try {
        currentTenants = JSON.parse(savedTenantsStr);
      } catch (e) {}
    }
    if (savedActiveId) {
      const found = currentTenants.find(t => t.tenantId === savedActiveId);
      if (found) return found;
    }
    return currentTenants[0];
  });

  const [showTerminalLogin, setShowTerminalLogin] = useState<boolean>(() => {
    const savedActiveId = localStorage.getItem("veggiepos_active_tenant_id");
    return savedActiveId ? true : false;
  });

  useEffect(() => {
    localStorage.setItem("veggiepos_tenants", JSON.stringify(tenants));
  }, [tenants]);

  // Use a simple ref-like state or local ref to track first mount to prevent auto-saving default on brand new sessions
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
    setTenants((prev) => [...prev, newTenant]);
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
    showTerminalLogin,
    setShowTerminalLogin,
    handleRegisterTenant
  };
}
