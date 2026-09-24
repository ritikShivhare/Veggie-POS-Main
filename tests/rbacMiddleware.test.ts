import { describe, it, expect, vi, beforeEach } from "vitest";
import { requireRole, requirePermission } from "../server/context";
import { staffRepo } from "../server/context";

describe("Centralized RBAC Middleware Unit Tests", () => {
  let mockRequest: any;
  let mockResponse: any;
  let nextFunction: any;

  beforeEach(() => {
    vi.restoreAllMocks();

    mockRequest = {
      headers: {},
      query: {},
      body: {},
      session: null,
      tenantId: "veg-reetesh-dhaba"
    };

    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis()
    };

    nextFunction = vi.fn();
  });

  describe("requireRole Middleware", () => {
    it("should return 401 UNAUTHORIZED if request has no active session", () => {
      const middleware = requireRole("Owner", "Manager");
      middleware(mockRequest, mockResponse, nextFunction);

      expect(nextFunction).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: "UNAUTHORIZED"
        })
      );
    });

    it("should allow request and call next() when user role matches allowed roles", () => {
      mockRequest.session = {
        sessionId: "sess-test-1",
        userId: "u-mgr",
        role: "Manager",
        tenantId: "veg-reetesh-dhaba"
      };

      const middleware = requireRole("Owner", "Manager");
      middleware(mockRequest, mockResponse, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it("should automatically allow Tenant Owner and SaaS Owner regardless of specific allowed list", () => {
      mockRequest.session = {
        sessionId: "sess-test-owner",
        userId: "u-owner",
        role: "Owner",
        tenantId: "veg-reetesh-dhaba"
      };

      const middleware = requireRole("Manager"); // List only contains Manager
      middleware(mockRequest, mockResponse, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it("should return 403 FORBIDDEN when user role is insufficient", () => {
      mockRequest.session = {
        sessionId: "sess-test-waiter",
        userId: "u-waiter",
        role: "Waiter",
        tenantId: "veg-reetesh-dhaba"
      };

      const middleware = requireRole("Owner", "Manager");
      middleware(mockRequest, mockResponse, nextFunction);

      expect(nextFunction).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: "FORBIDDEN"
        })
      );
    });
  });

  describe("requirePermission Middleware", () => {
    it("should return 401 UNAUTHORIZED if session is missing", async () => {
      const middleware = requirePermission("inventory");
      await middleware(mockRequest, mockResponse, nextFunction);

      expect(nextFunction).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: "UNAUTHORIZED"
        })
      );
    });

    it("should automatically allow Owner role with all permissions", async () => {
      mockRequest.session = {
        sessionId: "sess-owner",
        userId: "u-owner",
        role: "Owner",
        tenantId: "veg-reetesh-dhaba",
        permissions: [] // Even if permissions array is empty, Owner has all
      };

      const middleware = requirePermission("settings");
      await middleware(mockRequest, mockResponse, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it("should allow access when user has the required permission", async () => {
      mockRequest.session = {
        sessionId: "sess-staff",
        userId: "u-staff-1",
        role: "Chef",
        tenantId: "veg-reetesh-dhaba",
        permissions: ["inventory"]
      };

      const middleware = requirePermission("inventory");
      await middleware(mockRequest, mockResponse, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it("should reject with 403 FORBIDDEN when user lacks the required permission", async () => {
      mockRequest.session = {
        sessionId: "sess-staff",
        userId: "u-staff-cashier",
        role: "Cashier",
        tenantId: "veg-reetesh-dhaba",
        permissions: ["billing"] // Only has billing
      };

      // Tries to access inventory write or settings
      const middleware = requirePermission("inventory");
      await middleware(mockRequest, mockResponse, nextFunction);

      expect(nextFunction).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: "FORBIDDEN"
        })
      );
    });

    it("should resolve permissions from staffRepo if not attached directly to session", async () => {
      mockRequest.session = {
        sessionId: "sess-legacy-staff",
        userId: "s-amit",
        role: "Staff",
        tenantId: "veg-reetesh-dhaba"
        // permissions omitted
      };

      vi.spyOn(staffRepo, "getAll").mockResolvedValue([
        {
          id: "s-amit",
          name: "Amit Kumar",
          role: "Staff",
          pin: "2222",
          permissions: ["billing", "inventory"]
        }
      ]);

      const middleware = requirePermission("inventory");
      await middleware(mockRequest, mockResponse, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockRequest.session.permissions).toEqual(["billing", "inventory"]);
    });
  });
});
