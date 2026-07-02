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
}

export interface ReportPayload {
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
  private static handleHttpError(response: Response, contextMessage: string): void {
    if (!response.ok) {
      throw new Error(`${contextMessage}: Server returned status ${response.status}`);
    }
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      throw new Error(`${contextMessage}: Expected JSON response but received ${contentType || "none"}`);
    }
  }

  /**
   * Fetches the full tenant synchronized state from the server database.
   */
  public static async getTenantSync(tenantId: string): Promise<SyncResponse> {
    try {
      const response = await fetch(`/api/sync?tenantId=${encodeURIComponent(tenantId)}`);
      this.handleHttpError(response, "Fetch sync state failed");
      const data: SyncResponse = await response.json();
      return data;
    } catch (error: any) {
      console.error(`ApiClient.getTenantSync error for tenant ${tenantId}:`, error);
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
  public static async saveTenantSync(tenantId: string, payload: SyncPayload): Promise<SyncResponse> {
    try {
      const response = await fetch(`/api/sync?tenantId=${encodeURIComponent(tenantId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      this.handleHttpError(response, "Save sync state failed");
      const data: SyncResponse = await response.json();
      return data;
    } catch (error: any) {
      console.error(`ApiClient.saveTenantSync error for tenant ${tenantId}:`, error);
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      this.handleHttpError(response, "Report generation failed");
      const data: ReportResponse = await response.json();
      return data;
    } catch (error: any) {
      console.error("ApiClient.generateReport error:", error);
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      this.handleHttpError(response, "Copilot request failed");
      const data: CopilotResponse = await response.json();
      return data;
    } catch (error: any) {
      console.error("ApiClient.sendCopilotMessage error:", error);
      return {
        success: false,
        reply: "Unable to reach operational assistance. Please check connectivity or view logs.",
        isImportant: false,
        isSimulated: true,
        error: error.message || "Unknown communication error"
      };
    }
  }
}
