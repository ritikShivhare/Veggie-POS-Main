/**
 * Veggie POS - Device & Branch Identifier Utilities
 * Generates and maintains a stable UUID v4 for the current POS terminal/register
 * and assigns branch context for multi-outlet multi-register operations.
 */

const DEVICE_ID_STORAGE_KEY = "veggiepos_device_uuid";
const BRANCH_ID_STORAGE_KEY = "veggiepos_branch_id";

/**
 * Returns the stable unique device identifier for this client terminal.
 * Creates and persists a UUID v4 if not already present.
 */
export function getDeviceId(): string {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      let id = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY);
      if (!id) {
        if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
          id = crypto.randomUUID();
        } else {
          id = `dev_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
        }
        window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, id);
      }
      return id;
    }
  } catch {
    // Fallback if localStorage is inaccessible
  }
  return "dev_terminal_default";
}

/**
 * Returns the branch identifier for the current store or terminal.
 */
export function getBranchId(tenantId?: string): string {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const key = tenantId ? `${BRANCH_ID_STORAGE_KEY}_${tenantId}` : BRANCH_ID_STORAGE_KEY;
      let branchId = window.localStorage.getItem(key);
      if (!branchId) {
        branchId = "main";
        window.localStorage.setItem(key, branchId);
      }
      return branchId;
    }
  } catch {
    // Fallback
  }
  return "main";
}

/**
 * Sets the active branch for a tenant.
 */
export function setBranchId(branchId: string, tenantId?: string): void {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const key = tenantId ? `${BRANCH_ID_STORAGE_KEY}_${tenantId}` : BRANCH_ID_STORAGE_KEY;
      window.localStorage.setItem(key, branchId.trim() || "main");
    }
  } catch {
    // Ignore error
  }
}
