import {
  MenuItem,
  Ingredient,
  Recipe,
  Purchase,
  StaffMember,
  Shift,
  Order,
  InventorySettings,
  Customer
} from "../types";

export interface SyncPayload {
  menuItems?: MenuItem[];
  ingredients?: Ingredient[];
  recipes?: Recipe[];
  staffList?: StaffMember[];
  orders?: Order[];
  customers?: Customer[];
  purchases?: Purchase[];
  shifts?: Shift[];
  settings?: InventorySettings;
}

export interface SyncResponse {
  success: boolean;
  initialized: boolean;
  data?: {
    menuItems?: MenuItem[];
    ingredients?: Ingredient[];
    recipes?: Recipe[];
    staffList?: StaffMember[];
    orders?: Order[];
    customers?: Customer[];
    purchases?: Purchase[];
    shifts?: Shift[];
    settings?: InventorySettings;
  };
  error?: string;
  message?: string;
}

export interface ReportPayload {
  language?: "hindi" | "hinglish" | "english";
  salesData: {
    totalRevenue: number;
    totalOrders: number;
    cashRevenue: number;
    upiRevenue: number;
    topSellingItems: any[];
  };
  inventoryData: {
    materials: Array<{ name: string; currentStock: number; unit: string }>;
    lowStockItems: any[];
    totalStockValue: number;
  };
  shiftsData: {
    activeStaffCount: number;
    recentShifts: Array<{ staffName: string; role: string; status: string }>;
  };
}

export interface ReportResponse {
  success: boolean;
  report: string;
  isSimulated: boolean;
  error?: string;
}

export interface CopilotPayload {
  prompt: string;
  history: Array<{ sender: "user" | "ai"; text: string }>;
  tenantId: string;
  tenantName: string;
  staffName: string;
  staffRole: string;
}

export interface CopilotResponse {
  success: boolean;
  reply: string;
  isImportant: boolean;
  isSimulated: boolean;
  error?: string;
}

/**
 * Centralized API Client Service for UI-backend database communication.
 */
export class ApiClient {
  private static inMemorySessionId: string | null = null;

  public static setSessionId(sessionId: string | null): void {
    this.inMemorySessionId = sessionId;
  }

  public static getSessionId(): string | null {
    return this.inMemorySessionId;
  }

  public static generateIdempotencyKey(prefix: string = "ik"): string {
    const random = Math.random().toString(36).substring(2, 10);
    return `${prefix}_${Date.now()}_${random}`;
  }

  private static getHeaders(tenantId?: string, sessionId?: string, idempotencyKey?: string): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };
    if (tenantId) {
      headers["x-tenant-id"] = tenantId;
    }
    // Strictly in-memory session token (never read from localStorage)
    const sessId = sessionId || this.inMemorySessionId;
    if (sessId) {
      headers["x-session-id"] = sessId;
    }
    if (idempotencyKey) {
      headers["Idempotency-Key"] = idempotencyKey;
    }
    return headers;
  }

  private static handleHttpError(response: Response, contextMessage: string): void {
    if (!response.ok) {
      if (response.status === 401) {
        window.dispatchEvent(new CustomEvent("veggiepos_session_expired"));
      }
      throw new Error(`${contextMessage}: Server returned status ${response.status}`);
    }
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      throw new Error(`${contextMessage}: Expected JSON response but received ${contentType || "none"}`);
    }
  }

  private static handleApiResponse<T extends { success: boolean; error?: string }>(context: string, data: T): T {
    if (!data.success) {
      const errMsg = data.error || "The server rejected this transaction.";
      this.logApiError(context, new Error(errMsg));
    }
    return data;
  }

  private static logApiError(context: string, error: any): void {
    const isNetworkOrAuth = error?.message && (error.message.includes("status 401") || error.message.includes("Failed to fetch") || error.name === "TypeError");
    if (isNetworkOrAuth) {
      console.warn(`${context}:`, error.message);
    } else {
      console.error(`${context}:`, error);
    }

    // Dispatch custom event to trigger global visual Toast notifications for actual application errors
    if (typeof window !== "undefined" && error?.message && !error.message.includes("Failed to fetch")) {
      const errMsg = error?.message || "Unknown communication failure";
      window.dispatchEvent(new CustomEvent("veggiepos_api_error", {
        detail: {
          context: context.replace(/^ApiClient\./, ""), // clean up class prefix
          message: errMsg
        }
      }));
    }
  }

  /**
   * Fetches the full tenant synchronized state from the server database.
   */
  public static async getTenantSync(tenantId: string, sessionId?: string): Promise<SyncResponse> {
    try {
      const response = await fetch(`/api/sync?tenantId=${encodeURIComponent(tenantId)}`, {
        headers: this.getHeaders(tenantId, sessionId),
        credentials: "include"
      });
      this.handleHttpError(response, "Fetch sync state failed");
      const data: SyncResponse = await response.json();
      return this.handleApiResponse(`ApiClient.getTenantSync for tenant ${tenantId}`, data);
    } catch (error: any) {
      this.logApiError(`ApiClient.getTenantSync error for tenant ${tenantId}`, error);
      return {
        success: false,
        initialized: false,
        error: error.message || "Unknown communication error"
      };
    }
  }

  /**
   * Saves the updated tenant synchronized state back to the server database.
   */
  public static async saveTenantSync(tenantId: string, payload: SyncPayload, sessionId?: string, idempotencyKey?: string): Promise<SyncResponse> {
    try {
      const idempKey = idempotencyKey || this.generateIdempotencyKey("sync");
      const response = await fetch(`/api/sync?tenantId=${encodeURIComponent(tenantId)}`, {
        method: "POST",
        headers: this.getHeaders(tenantId, sessionId, idempKey),
        credentials: "include",
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        let errJson: any = null;
        try {
          errJson = await response.json();
        } catch (e) {}

        if (response.status === 409 || errJson?.error === "OPTIMISTIC_LOCK_CONFLICT") {
          const errMsg = errJson?.message || "Optimistic lock conflict: stale updates rejected.";
          this.logApiError(`ApiClient.saveTenantSync [409 OPTIMISTIC_LOCK_CONFLICT] for tenant ${tenantId}`, new Error(errMsg));
          return {
            success: false,
            initialized: true,
            error: "OPTIMISTIC_LOCK_CONFLICT",
            message: errMsg
          };
        }

        if (response.status === 503 || errJson?.error === "DATABASE_UNAVAILABLE") {
          const errMsg = errJson?.message || "Database is unavailable. Writes cannot be committed.";
          this.logApiError(`ApiClient.saveTenantSync [503 DATABASE_UNAVAILABLE] for tenant ${tenantId}`, new Error(errMsg));
          return {
            success: false,
            initialized: false,
            error: "DATABASE_UNAVAILABLE"
          };
        }
        this.handleHttpError(response, "Save sync state failed");
      }
      const data: SyncResponse = await response.json();
      return this.handleApiResponse(`ApiClient.saveTenantSync for tenant ${tenantId}`, data);
    } catch (error: any) {
      this.logApiError(`ApiClient.saveTenantSync error for tenant ${tenantId}`, error);
      return {
        success: false,
        initialized: false,
        error: error.message || "Unknown communication error"
      };
    }
  }

  /**
   * Generates analytical reports powered by Gemini/Simulation models.
   */
  public static async generateReport(payload: ReportPayload): Promise<ReportResponse> {
    try {
      const response = await fetch("/api/reports/generate", {
        method: "POST",
        headers: this.getHeaders(),
        credentials: "include",
        body: JSON.stringify(payload)
      });
      this.handleHttpError(response, "Report generation failed");
      const data: ReportResponse = await response.json();
      return this.handleApiResponse("ApiClient.generateReport", data);
    } catch (error: any) {
      this.logApiError("ApiClient.generateReport error", error);
      return {
        success: false,
        report: "",
        isSimulated: true,
        error: error.message || "Unknown communication error"
      };
    }
  }

  /**
   * Dispatches conversation queries to VeggiePOS AI Operations Copilot.
   */
  public static async sendCopilotMessage(payload: CopilotPayload): Promise<CopilotResponse> {
    try {
      const response = await fetch("/api/copilot-chat", {
        method: "POST",
        headers: this.getHeaders(payload.tenantId),
        credentials: "include",
        body: JSON.stringify(payload)
      });
      this.handleHttpError(response, "Copilot request failed");
      const data: CopilotResponse = await response.json();
      return this.handleApiResponse("ApiClient.sendCopilotMessage", data);
    } catch (error: any) {
      this.logApiError("ApiClient.sendCopilotMessage error", error);
      return {
        success: false,
        reply: "Unable to reach operational assistance. Please check connectivity or view logs.",
        isImportant: false,
        isSimulated: true,
        error: error.message || "Unknown communication error"
      };
    }
  }

  /**
   * Fetches a safe public list of staff members without sensitive fields like PIN.
   */
  public static async getStaffDirectory(tenantId: string): Promise<{ success: boolean; staff?: any[]; error?: string }> {
    try {
      const response = await fetch(`/api/auth/staff-directory?tenantId=${encodeURIComponent(tenantId)}`, {
        headers: this.getHeaders(tenantId),
        credentials: "include"
      });
      this.handleHttpError(response, "Staff directory fetch failed");
      const data = await response.json();
      return this.handleApiResponse(`ApiClient.getStaffDirectory for tenant ${tenantId}`, data);
    } catch (error: any) {
      this.logApiError(`ApiClient.getStaffDirectory error for tenant ${tenantId}`, error);
      return {
        success: false,
        error: error.message || "Unknown communication error"
      };
    }
  }

  /**
   * Fetches the server realtime configuration (indicates server-mediated WebSockets).
   */
  public static async getSupabaseConfig(): Promise<{ success: boolean; serverMediatedRealtime?: boolean; wsPath?: string; supabaseUrl?: string; supabaseAnonKey?: string; error?: string }> {
    try {
      const response = await fetch("/api/supabase-config", {
        headers: this.getHeaders(),
        credentials: "include"
      });
      this.handleHttpError(response, "Fetch Supabase config failed");
      const data = await response.json();
      return this.handleApiResponse("ApiClient.getSupabaseConfig", data);
    } catch (error: any) {
      this.logApiError("ApiClient.getSupabaseConfig error", error);
      return {
        success: false,
        error: error.message || "Unknown communication error"
      };
    }
  }
}
