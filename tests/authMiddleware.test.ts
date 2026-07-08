import { describe, it, expect, vi, beforeEach } from "vitest";
import { authMiddleware } from "../server/context";
import { SessionService } from "../server/features/auth/SessionService";

describe("Express authMiddleware Unit Tests", () => {
  let mockRequest: any;
  let mockResponse: any;
  let nextFunction: any;

  beforeEach(() => {
    vi.restoreAllMocks();
    
    mockRequest = {
      headers: {},
      query: {},
      body: {},
      path: "",
      method: "GET"
    };

    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis()
    };

    nextFunction = vi.fn();
  });

  it("should bypass authentication for public health check and call next()", async () => {
    mockRequest.path = "/api/health";
    mockRequest.method = "GET";

    await authMiddleware(mockRequest, mockResponse, nextFunction);

    expect(nextFunction).toHaveBeenCalled();
    expect(mockResponse.status).not.toHaveBeenCalled();
  });

  it("should bypass authentication for auth login routes and call next()", async () => {
    mockRequest.path = "/api/auth/login";
    mockRequest.method = "POST";

    await authMiddleware(mockRequest, mockResponse, nextFunction);

    expect(nextFunction).toHaveBeenCalled();
    expect(mockResponse.status).not.toHaveBeenCalled();
  });

  it("should return 401 Unauthorized for a mutation request with no session ID", async () => {
    mockRequest.path = "/api/ingredients";
    mockRequest.method = "POST"; // Mutation
    mockRequest.headers = {
      "x-tenant-id": "veg-main-001"
    };

    await authMiddleware(mockRequest, mockResponse, nextFunction);

    expect(nextFunction).not.toHaveBeenCalled();
    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: "UNAUTHORIZED"
      })
    );
  });

  it("should return 401 Unauthorized for sensitive path requests with no session ID", async () => {
    mockRequest.path = "/api/sync";
    mockRequest.method = "GET"; // Sensitive GET path
    mockRequest.headers = {
      "x-tenant-id": "veg-main-001"
    };

    await authMiddleware(mockRequest, mockResponse, nextFunction);

    expect(nextFunction).not.toHaveBeenCalled();
    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: "UNAUTHORIZED"
      })
    );
  });

  it("should return 401 SESSION_EXPIRED when an invalid or expired session token is provided", async () => {
    mockRequest.path = "/api/ingredients";
    mockRequest.method = "POST"; // Mutation
    mockRequest.headers = {
      "x-tenant-id": "veg-main-001",
      "x-session-id": "invalid-token-abc"
    };

    // Register session in mapping index for O(1) resolution
    SessionService.getInstance().registerSessionTenant("invalid-token-abc", "veg-main-001");

    // Spy on session service validation to return null (invalid session)
    const sessionSpy = vi
      .spyOn(SessionService.getInstance(), "validateAndTouchSession")
      .mockResolvedValue(null);

    await authMiddleware(mockRequest, mockResponse, nextFunction);

    expect(sessionSpy).toHaveBeenCalledWith("veg-main-001", "invalid-token-abc");
    expect(nextFunction).not.toHaveBeenCalled();
    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: "SESSION_EXPIRED"
      })
    );
  });

  it("should grant access and call next() if a valid active session is verified", async () => {
    mockRequest.path = "/api/ingredients";
    mockRequest.method = "POST";
    mockRequest.headers = {
      "x-tenant-id": "veg-main-001",
      "x-session-id": "valid-active-session-token"
    };

    // Register session in mapping index for O(1) resolution
    SessionService.getInstance().registerSessionTenant("valid-active-session-token", "veg-main-001");

    const dummySession: any = {
      sessionId: "valid-active-session-token",
      userId: "u-123",
      userName: "Chef Ritik",
      role: "Manager",
      tenantId: "veg-main-001"
    };

    const sessionSpy = vi
      .spyOn(SessionService.getInstance(), "validateAndTouchSession")
      .mockResolvedValue(dummySession);

    await authMiddleware(mockRequest, mockResponse, nextFunction);

    expect(sessionSpy).toHaveBeenCalledWith("veg-main-001", "valid-active-session-token");
    expect(mockRequest.session).toEqual(dummySession);
    expect(nextFunction).toHaveBeenCalled();
    expect(mockResponse.status).not.toHaveBeenCalled();
  });
});
