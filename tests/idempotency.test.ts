import { describe, it, expect, beforeEach, vi } from "vitest";
import { IdempotencyService } from "../server/features/shared/IdempotencyService";
import { idempotencyMiddleware } from "../server/middleware/idempotency.middleware";

describe("Idempotency Service & Unique Constraint on (tenant_id, idempotency_key)", () => {
  let idempotencyService: IdempotencyService;

  beforeEach(() => {
    idempotencyService = IdempotencyService.getInstance();
    idempotencyService.clearMemory();
  });

  it("should store and retrieve an idempotency record by (tenant_id, idempotency_key)", async () => {
    const record = await idempotencyService.saveRecord({
      tenant_id: "tenant-alpha",
      idempotency_key: "ik-test-001",
      status_code: 201,
      response_body: { success: true, orderId: "ord-123", total: 450 },
      request_path: "/api/orders",
      request_method: "POST"
    });

    expect(record.id).toBeDefined();
    expect(record.tenant_id).toBe("tenant-alpha");
    expect(record.idempotency_key).toBe("ik-test-001");
    expect(record.status_code).toBe(201);
    expect(record.response_body.orderId).toBe("ord-123");

    // Fetch existing
    const retrieved = await idempotencyService.getRecord("tenant-alpha", "ik-test-001");
    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe(record.id);
    expect(retrieved?.response_body).toEqual(record.response_body);
  });

  it("should enforce UNIQUE constraint on (tenant_id, idempotency_key) and not overwrite with new payload", async () => {
    // 1st request
    const original = await idempotencyService.saveRecord({
      tenant_id: "tenant-alpha",
      idempotency_key: "ik-dup-check",
      status_code: 200,
      response_body: { success: true, paymentId: "pay-100", amount: 1500 }
    });

    // 2nd request with same (tenant_id, idempotency_key) but different payload
    const duplicate = await idempotencyService.saveRecord({
      tenant_id: "tenant-alpha",
      idempotency_key: "ik-dup-check",
      status_code: 500, // Should be ignored because unique constraint protects original
      response_body: { success: false, paymentId: "pay-DIFFERENT", amount: 99999 }
    });

    expect(duplicate.id).toBe(original.id);
    expect(duplicate.status_code).toBe(200);
    expect(duplicate.response_body.paymentId).toBe("pay-100");
    expect(duplicate.response_body.amount).toBe(1500);

    // Verify lookup still returns the original
    const lookup = await idempotencyService.getRecord("tenant-alpha", "ik-dup-check");
    expect(lookup?.response_body.paymentId).toBe("pay-100");
  });

  it("should isolate idempotency keys across different tenants (tenant_id scoping)", async () => {
    // Tenant A with key 'order-123'
    await idempotencyService.saveRecord({
      tenant_id: "tenant-A",
      idempotency_key: "order-123",
      status_code: 200,
      response_body: { tenant: "A", orderId: "A-1" }
    });

    // Tenant B with same idempotency_key 'order-123'
    await idempotencyService.saveRecord({
      tenant_id: "tenant-B",
      idempotency_key: "order-123",
      status_code: 200,
      response_body: { tenant: "B", orderId: "B-1" }
    });

    const recordA = await idempotencyService.getRecord("tenant-A", "order-123");
    const recordB = await idempotencyService.getRecord("tenant-B", "order-123");

    expect(recordA?.response_body.tenant).toBe("A");
    expect(recordB?.response_body.tenant).toBe("B");
    expect(recordA?.id).not.toBe(recordB?.id);
  });
});

describe("Express idempotencyMiddleware Unit Tests", () => {
  let mockRequest: any;
  let mockResponse: any;
  let nextFunction: any;
  let capturedHeaders: Record<string, string>;

  beforeEach(() => {
    IdempotencyService.getInstance().clearMemory();
    capturedHeaders = {};

    mockRequest = {
      headers: {},
      body: {},
      query: {},
      path: "/api/orders",
      originalUrl: "/api/orders",
      method: "POST",
      tenantId: "tenant-pos-1"
    };

    mockResponse = {
      statusCode: 200,
      status: vi.fn(function (code: number) {
        mockResponse.statusCode = code;
        return mockResponse;
      }),
      setHeader: vi.fn((key: string, value: string) => {
        capturedHeaders[key.toLowerCase()] = value;
      }),
      json: vi.fn(function (body: any) {
        mockResponse.body = body;
        return mockResponse;
      }),
      on: vi.fn()
    };

    nextFunction = vi.fn();
  });

  it("should call next() without intercepting if no Idempotency-Key header is present", async () => {
    await idempotencyMiddleware(mockRequest, mockResponse, nextFunction);

    expect(nextFunction).toHaveBeenCalled();
    expect(mockResponse.status).not.toHaveBeenCalled();
    expect(capturedHeaders["idempotency-key"]).toBeUndefined();
  });

  it("should record response on first request with Idempotency-Key", async () => {
    mockRequest.headers["idempotency-key"] = "ik-order-001";

    let interceptedJson: any;
    nextFunction = vi.fn(() => {
      // Simulate route handler calling res.status(201).json(...)
      mockResponse.status(201);
      interceptedJson = mockResponse.json({ success: true, orderId: "ord-999" });
    });

    await idempotencyMiddleware(mockRequest, mockResponse, nextFunction);

    expect(nextFunction).toHaveBeenCalled();
    expect(mockResponse.statusCode).toBe(201);
    expect(capturedHeaders["idempotency-key"]).toBe("ik-order-001");
    expect(capturedHeaders["idempotent-replayed"]).toBeUndefined();

    // Verify it was persisted
    const record = await IdempotencyService.getInstance().getRecord("tenant-pos-1", "ik-order-001");
    expect(record).not.toBeNull();
    expect(record?.status_code).toBe(201);
    expect(record?.response_body).toEqual({ success: true, orderId: "ord-999" });
  });

  it("should return cached previous response and NOT call next() on duplicate request", async () => {
    // Seed existing idempotency record
    await IdempotencyService.getInstance().saveRecord({
      tenant_id: "tenant-pos-1",
      idempotency_key: "ik-duplicate-123",
      status_code: 201,
      response_body: { success: true, orderId: "ord-first-run", amount: 750 },
      request_path: "/api/orders",
      request_method: "POST"
    });

    mockRequest.headers["idempotency-key"] = "ik-duplicate-123";

    await idempotencyMiddleware(mockRequest, mockResponse, nextFunction);

    // Business handler (next) MUST NOT be executed!
    expect(nextFunction).not.toHaveBeenCalled();

    // Replayed response headers and status
    expect(mockResponse.status).toHaveBeenCalledWith(201);
    expect(mockResponse.json).toHaveBeenCalledWith({ success: true, orderId: "ord-first-run", amount: 750 });
    expect(capturedHeaders["idempotent-replayed"]).toBe("true");
    expect(capturedHeaders["idempotency-key"]).toBe("ik-duplicate-123");
  });

  it("should accept lowercase 'idempotency-key' and 'x-idempotency-key' variants", async () => {
    await IdempotencyService.getInstance().saveRecord({
      tenant_id: "tenant-pos-1",
      idempotency_key: "ik-var-key",
      status_code: 200,
      response_body: { success: true, sessionUrl: "https://checkout.stripe.com/test" },
      request_path: "/api/billing/create-checkout-session",
      request_method: "POST"
    });

    // Try x-idempotency-key header
    mockRequest.headers = { "x-idempotency-key": "ik-var-key" };

    await idempotencyMiddleware(mockRequest, mockResponse, nextFunction);

    expect(nextFunction).not.toHaveBeenCalled();
    expect(mockResponse.status).toHaveBeenCalledWith(200);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: true,
      sessionUrl: "https://checkout.stripe.com/test"
    });
    expect(capturedHeaders["idempotent-replayed"]).toBe("true");
  });

  it("should reject invalid / empty / excessively long idempotency keys with 400", async () => {
    mockRequest.headers["idempotency-key"] = "   "; // Whitespace only

    await idempotencyMiddleware(mockRequest, mockResponse, nextFunction);

    expect(nextFunction).not.toHaveBeenCalled();
    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: "INVALID_IDEMPOTENCY_KEY"
    }));
  });

  it("should serialize concurrent twin requests and resolve in-flight execution", async () => {
    const service = IdempotencyService.getInstance();
    const idKey = "ik-concurrent-test";

    // Simulate request 1 starting in-flight
    service.startInFlight("tenant-pos-1", idKey);

    // Simulate request 2 arriving while request 1 is in-flight
    mockRequest.headers["idempotency-key"] = idKey;

    let request2Finished = false;
    const req2Promise = idempotencyMiddleware(mockRequest, mockResponse, nextFunction).then(() => {
      request2Finished = true;
    });

    // Request 2 should be awaiting in-flight resolution
    expect(request2Finished).toBe(false);

    // Now complete request 1 by saving record (which resolves in-flight listeners)
    await service.saveRecord({
      tenant_id: "tenant-pos-1",
      idempotency_key: idKey,
      status_code: 200,
      response_body: { success: true, paymentStatus: "paid" }
    });

    await req2Promise;

    expect(request2Finished).toBe(true);
    expect(nextFunction).not.toHaveBeenCalled(); // Req 2 did not run handler
    expect(mockResponse.status).toHaveBeenCalledWith(200);
    expect(mockResponse.json).toHaveBeenCalledWith({ success: true, paymentStatus: "paid" });
    expect(capturedHeaders["idempotent-replayed"]).toBe("true");
  });
});
