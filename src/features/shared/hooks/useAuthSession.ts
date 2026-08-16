import { useState, useEffect, useRef } from "react";
import { StaffMember, Shift } from "../types";

interface UseAuthSessionProps {
  activeTenantId: string;
  shifts: Shift[];
  setShifts: (shifts: Shift[]) => void;
  staffList: StaffMember[];
  currentStaff: StaffMember | null;
  setCurrentStaff: React.Dispatch<React.SetStateAction<StaffMember | null>>;
  currentSessionId: string | null;
  setCurrentSessionId: React.Dispatch<React.SetStateAction<string | null>>;
}

export function useAuthSession({
  activeTenantId,
  shifts,
  setShifts,
  staffList,
  currentStaff,
  setCurrentStaff,
  currentSessionId,
  setCurrentSessionId
}: UseAuthSessionProps) {
  const [showIdleWarning, setShowIdleWarning] = useState<boolean>(false);
  const [idleCountdown, setIdleCountdown] = useState<number>(30);
  const [activeShift, setActiveShift] = useState<Shift | null>(null);

  useEffect(() => {
    if (currentStaff) {
      localStorage.setItem("veggiepos_current_staff", JSON.stringify(currentStaff));
    } else {
      localStorage.removeItem("veggiepos_current_staff");
    }
  }, [currentStaff]);

  useEffect(() => {
    if (currentSessionId) {
      localStorage.setItem("veggiepos_current_session_id", currentSessionId);
    } else {
      localStorage.removeItem("veggiepos_current_session_id");
    }
  }, [currentSessionId]);

  // Sync currentStaff details if staffList changes (e.g. owner edits PIN or permissions)
  useEffect(() => {
    if (currentStaff) {
      const updated = staffList.find((s) => s.id === currentStaff.id);
      if (updated) {
        if (
          updated.pin !== currentStaff.pin ||
          updated.permissions.length !== currentStaff.permissions.length ||
          !updated.permissions.every((p) => currentStaff.permissions.includes(p))
        ) {
          setCurrentStaff(updated);
        }
      }
    }
  }, [staffList, currentStaff]);

  // Production-level Secure Session Idle Timeout and Keep-Alive Engine
  const lastActivityRef = useRef<number>(Date.now());
  const idleTimeoutMinutesRef = useRef<number>(60);

  useEffect(() => {
    if (!currentStaff || !currentSessionId) {
      setShowIdleWarning(false);
      return;
    }

    const isSaaS = (currentStaff?.role as string) === "SaaS Owner";
    const requestTenantId = isSaaS ? "saas-admin" : activeTenantId;

    const resetActivity = () => {
      lastActivityRef.current = Date.now();
      if (showIdleWarning) {
        setShowIdleWarning(false);
        setIdleCountdown(30);
        
        fetch("/api/auth/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: currentSessionId, tenantId: requestTenantId })
        }).catch(err => console.error(err));
      }
    };

    const events = ["mousedown", "mousemove", "keydown", "click", "scroll", "touchstart"];
    events.forEach(ev => window.addEventListener(ev, resetActivity));

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-tenant-id": requestTenantId
    };
    if (currentSessionId) {
      headers["x-session-id"] = currentSessionId;
    }

    fetch("/api/auth/sessions-data?tenantId=" + requestTenantId, { headers })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.securitySettings) {
          idleTimeoutMinutesRef.current = data.securitySettings.sessionTimeoutMinutes;
        }
      })
      .catch(err => console.error(err));

    return () => {
      events.forEach(ev => window.removeEventListener(ev, resetActivity));
    };
  }, [currentStaff, currentSessionId, showIdleWarning, activeTenantId]);

  useEffect(() => {
    if (!currentStaff || !currentSessionId) return;

    const isSaaS = (currentStaff?.role as string) === "SaaS Owner";
    const requestTenantId = isSaaS ? "saas-admin" : activeTenantId;

    const validateInterval = setInterval(async () => {
      try {
        const res = await fetch("/api/auth/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: currentSessionId, tenantId: requestTenantId })
        });
        const data = await res.json();
        if (!data.success) {
          setCurrentStaff(null);
          setCurrentSessionId(null);
          alert(data.message || "Your session has expired or has been revoked by an administrator.");
        }
      } catch (err) {
        console.warn("Keep-alive validation warning (transient fetch failure):", err);
      }
    }, 12000);

    const idleCheckInterval = setInterval(() => {
      const elapsedSeconds = (Date.now() - lastActivityRef.current) / 1000;
      const timeoutSeconds = idleTimeoutMinutesRef.current * 60;
      const warningThresholdSeconds = Math.max(10, timeoutSeconds - 30);

      if (elapsedSeconds >= timeoutSeconds) {
        setCurrentStaff(null);
        setCurrentSessionId(null);
        setShowIdleWarning(false);
        alert("Session expired. You have been automatically logged out due to inactivity.");
      } else if (elapsedSeconds >= warningThresholdSeconds) {
        setShowIdleWarning(true);
        const remaining = Math.ceil(timeoutSeconds - elapsedSeconds);
        setIdleCountdown(remaining);
      } else {
        if (showIdleWarning) {
          setShowIdleWarning(false);
        }
      }
    }, 1000);

    return () => {
      clearInterval(validateInterval);
      clearInterval(idleCheckInterval);
    };
  }, [currentStaff, currentSessionId, showIdleWarning, activeTenantId]);

  // Sync active shift details when current staff logs in
  useEffect(() => {
    if (currentStaff) {
      const active = shifts.find((s) => s.staffId === currentStaff.id && s.status === "Active");
      setActiveShift(active || null);
    } else {
      setActiveShift(null);
    }
  }, [currentStaff, shifts]);

  // Listen for global session expiration events (e.g. 401 response from server)
  useEffect(() => {
    const handleExpired = () => {
      setCurrentStaff(null);
      setCurrentSessionId(null);
    };
    window.addEventListener("veggiepos_session_expired", handleExpired);
    return () => {
      window.removeEventListener("veggiepos_session_expired", handleExpired);
    };
  }, []);

  // Handle Employee Login
  const handleLoginSuccess = (staff: StaffMember, sessionId?: string, _loggedInTenant?: any) => {
    setCurrentStaff(staff);
    if (sessionId) {
      setCurrentSessionId(sessionId);
    }
  };

  // Handle Employee Logout / Terminal lock
  const handleLogout = () => {
    if (currentSessionId) {
      const isSaaS = (currentStaff?.role as string) === "SaaS Owner";
      const requestTenantId = isSaaS ? "saas-admin" : activeTenantId;
      fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: currentSessionId, tenantId: requestTenantId })
      }).catch(err => console.error("Logout propagation failed:", err));
    }
    setCurrentStaff(null);
    setCurrentSessionId(null);
  };

  const getShiftDurationString = (startTime: string): string => {
    const diffMs = Date.now() - new Date(startTime).getTime();
    const diffHrs = Math.floor(diffMs / 3600000);
    const diffMins = Math.floor((diffMs % 3600000) / 60000);
    if (diffHrs < 1) return `${diffMins} mins`;
    return `${diffHrs}h ${diffMins}m`;
  };

  // Clock In / Clock Out shift actions
  const handleShiftAction = () => {
    if (!currentStaff) return;

    if (activeShift) {
      const updatedShifts = shifts.map((s) =>
        s.id === activeShift.id
          ? { ...s, endTime: new Date().toISOString(), status: "Completed" as const }
          : s
      );
      setShifts(updatedShifts);
      alert(`Successfully clocked out. Shift duration: ${getShiftDurationString(activeShift.startTime)}`);
    } else {
      const newShift: Shift = {
        id: `sh-${Date.now()}`,
        staffId: currentStaff.id,
        staffName: currentStaff.name,
        role: currentStaff.role,
        startTime: new Date().toISOString(),
        status: "Active"
      };
      setShifts([...shifts, newShift]);
      alert("Welcome to duty! Shift started successfully.");
    }
  };

  return {
    currentStaff,
    setCurrentStaff,
    currentSessionId,
    setCurrentSessionId,
    showIdleWarning,
    setShowIdleWarning,
    idleCountdown,
    activeShift,
    handleLoginSuccess,
    handleLogout,
    handleShiftAction
  };
}
