import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { PUBLIC_ROUTES, isPublicRoute, authMiddleware } from "../server/context";

describe("Mock Payment Endpoints Security Validation", () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = "production";
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it("should NOT contain mock endpoints in the PUBLIC_ROUTES allowlist", () => {
    const mockRoutes = [
      { method: "GET", path: "/api/billing/mock-checkout" },
      { method: "POST", path: "/api/billing/mock-payment-success" },
      { method: "POST", path: "/api/billing/mock-payment-fail" },
      { method: "GET", path: "/api/billing/mock-portal" }
    ];

    for (const route of mockRoutes) {
      const isPublic = PUBLIC_ROUTES.some(
        (p) => p.method === route.method && p.path === route.path
      );
      expect(isPublic).toBe(false);
    }
  });

  it("should classify mock payment routes as non-public via isPublicRoute()", () => {
    const mockRequests = [
      { method: "POST", originalUrl: "/api/billing/mock-payment-success" },
      { method: "POST", originalUrl: "/api/billing/mock-payment-fail" },
      { method: "GET", originalUrl: "/api/billing/mock-checkout" },
      { method: "GET", originalUrl: "/api/billing/mock-portal" }
    ];

    for (const req of mockRequests) {
      expect(isPublicRoute(req as any)).toBe(false);
    }
  });

  it("should reject unauthenticated calls to mock endpoints in authMiddleware", async () => {
    const req: any = {
      method: "POST",
      path: "/billing/mock-payment-success",
      originalUrl: "/api/billing/mock-payment-success",
      headers: {},
      cookies: {}
    };

    let statusCalledWith = 0;
    let jsonBody: any = null;
    const res: any = {
      status: (code: number) => {
        statusCalledWith = code;
        return {
          json: (body: any) => {
            jsonBody = body;
          }
        };
      }
    };
    let nextCalled = false;
    const next = () => {
      nextCalled = true;
    };

    await authMiddleware(req, res, next);

    expect(nextCalled).toBe(false);
    expect(statusCalledWith).toBe(401);
    expect(jsonBody).toBeDefined();
    expect(jsonBody.error).toBe("UNAUTHORIZED");
  });
});
