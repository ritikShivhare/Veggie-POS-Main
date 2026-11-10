import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import express from "express";
import { configureRequestParsing } from "../server/http/requestParsing";
import http from "node:http";
import bcrypt from "bcryptjs";
const m = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  checkout: vi.fn(),
  portal: vi.fn(),
  subscription: vi.fn(),
  saveSubscription: vi.fn(),
  send: vi.fn(),
  createSession: vi.fn(),
}));
vi.mock("stripe", () => ({
  default: class {
    webhooks = { constructEvent: m.constructEvent };
    checkout = { sessions: { create: m.checkout } };
    billingPortal = { sessions: { create: m.portal } };
  },
}));
vi.mock("../server/context.ts", () => {
  const next = (_q: any, _s: any, n: any) => n();
  const auth = (q: any, _s: any, n: any) => {
    q.tenantId = "audit";
    q.session = { id: "mock-session" };
    q.subscription = { plan: "free" };
    n();
  };
  const repo = {
    getAll: vi.fn().mockResolvedValue([]),
    saveAll: vi.fn().mockResolvedValue(undefined),
  };
  return {
    authMiddleware: auth,
    adminAuthMiddleware: next,
    idempotencyMiddleware: next,
    requireRole: () => next,
    staffRepo: repo,
    orderRepo: repo,
    settingsRepo: { get: vi.fn().mockResolvedValue({}) },
    ingredientRepo: repo,
    menuRepo: repo,
    recipeRepo: repo,
    customerRepo: repo,
    purchaseRepo: repo,
    shiftRepo: repo,
    getSubscription: m.subscription,
    saveSubscription: m.saveSubscription,
    PLAN_LIMITS: { free: {} },
    getGlobalTenantsList: vi.fn().mockResolvedValue([]),
    saveGlobalTenantsList: vi.fn(),
    auditLogService: { log: vi.fn() },
    notificationService: { send: m.send },
    sessionService: { createSession: m.createSession },
    verifyTOTP: vi.fn(),
    generateTOTP: vi.fn(),
  };
});
import billingRouter from "../routes/billing.routes";
import adminRouter from "../routes/admin.routes";
import { Database } from "../server/features/shared/database";
import { verifyMasterVerificationCode } from "../server/features/auth/PinSecurityService";
let server: http.Server;
let base: string;
beforeEach(async () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("APP_ENV", "production");
  vi.stubEnv("STRIPE_SECRET_KEY", "");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
  vi.stubEnv("MASTER_VERIFICATION_CODE", "audit-custom-secret");
  vi.stubEnv("EMAIL_ALERT_ADDRESS", "owner@example.invalid");
  vi.stubEnv(
    "SAAS_OWNER_PASSWORD_HASH",
    await bcrypt.hash("audit-correct-password", 4),
  );
  m.constructEvent.mockReset();
  m.checkout.mockReset();
  m.portal.mockReset();
  m.subscription
    .mockReset()
    .mockResolvedValue({ plan: "free", stripeCustomerId: "mock-customer" });
  m.saveSubscription.mockReset();
  m.send
    .mockReset()
    .mockResolvedValue({
      success: false,
      dispatchedChannels: [{ channel: "email", status: "failed" }],
    });
  m.createSession.mockReset().mockResolvedValue({ sessionId: "mock-session" });
  const app = express();
  configureRequestParsing(app);
  app.use("/api", billingRouter);
  app.use("/api", adminRouter);
  server = http.createServer(app);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as any).port}`;
});
afterEach(async () => {
  await new Promise<void>((r) => server.close(() => r()));
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
const post = async (path: string, body: any, headers: any = {}) =>
  fetch(base + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
describe("Stripe integration with mocked SDK and authenticated tenant", () => {
  it("fails with 503 for production checkout without Stripe key", async () => {
    const res = await post("/api/billing/create-checkout-session", {
      plan: "pro",
    });
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({
      error: "PAYMENT_GATEWAY_UNAVAILABLE",
    });
  });
  it("fails with 503 for production portal without Stripe key", async () => {
    const res = await post("/api/billing/create-portal-session", {});
    expect(res.status).toBe(503);
  });
  it("creates checkout with mocked Stripe when configured", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_mock");
    m.checkout.mockResolvedValue({ url: "https://checkout.stripe.com/mock" });
    const res = await post(
      "/api/billing/create-checkout-session",
      { plan: "pro" },
      { Origin: "https://audit.invalid" },
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      url: "https://checkout.stripe.com/mock",
    });
    expect(m.checkout).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "subscription" }),
    );
  });
  it("creates portal using mocked Stripe", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_mock");
    m.portal.mockResolvedValue({ url: "https://billing.stripe.com/mock" });
    const res = await post("/api/billing/create-portal-session", {});
    expect(res.status).toBe(200);
    expect(m.portal).toHaveBeenCalled();
  });
  it("reports upstream checkout failures", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_mock");
    m.checkout.mockRejectedValue(new Error("mock gateway unavailable"));
    expect(
      (await post("/api/billing/create-checkout-session", { plan: "pro" }))
        .status,
    ).toBe(500);
  });
  it("guardrail: a valid signed webhook must retain its raw request body", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_mock");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_mock");
    m.constructEvent.mockImplementation((body) => {
      if (!Buffer.isBuffer(body))
        throw new Error("Raw webhook body was consumed by global JSON parser");
      return { type: "audit.noop", data: { object: {} } };
    });
    const res = await post(
      "/api/webhooks/stripe",
      { type: "audit.noop", data: { object: {} } },
      { "stripe-signature": "mock-valid-signature" },
    );
    expect(res.status).toBe(200);
  });
});
describe("Production authentication guardrails", () => {
  it("guardrail: a configured master secret must reject the hardcoded default", () => {
    expect(verifyMasterVerificationCode("123456")).toBe(false);
  });
  it("guardrail: empty Google credential and email must be rejected", async () => {
    const res = await post("/api/saas-admin/google-login", {});
    expect(res.status).toBe(401);
  });
  it("guardrail: a configured admin hash must disable default passwords", async () => {
    const res = await post("/api/saas-admin/login", {
      password: "admin123",
      email: "audit@example.invalid",
    });
    expect(res.status).toBe(401);
  });
  it("guardrail: failed OTP delivery must not bypass the second factor", async () => {
    const res = await post("/api/saas-admin/login", {
      password: "audit-correct-password",
      email: "audit@example.invalid",
    });
    expect(res.status).toBe(503);
  });
});
describe("Admin OTP lifecycle", () => {
  it("delivers only to configured owner, requires the delivered OTP and rejects replay", async () => {
    m.send.mockResolvedValue({
      success: true,
      dispatchedChannels: [{ channel: "email", status: "success" }],
    });
    const response = await post("/api/saas-admin/login", {
      password: "audit-correct-password",
      email: "attacker@example.invalid",
    });
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.requireOtp).toBe(true);
    expect(data.email).toBe("owner@example.invalid");
    expect(m.createSession).not.toHaveBeenCalled();
    const payload = m.send.mock.calls[0][1];
    expect(payload.recipientEmail).toBe("owner@example.invalid");
    const otp = payload.message.match(/code is: (\d{6})/)[1];
    expect(
      (
        await post("/api/saas-admin/login", {
          otp: "not-the-code",
          challengeToken: data.challengeToken,
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await post("/api/saas-admin/login", {
          otp,
          challengeToken: data.challengeToken,
        })
      ).status,
    ).toBe(200);
    expect(m.createSession).toHaveBeenCalledTimes(1);
    expect(
      (
        await post("/api/saas-admin/login", {
          otp,
          challengeToken: data.challengeToken,
        })
      ).status,
    ).toBe(401);
  });
  it("rejects forged Google tokens and client supplied owner email", async () => {
    const credential =
      "unsigned." +
      Buffer.from(JSON.stringify({ email: "owner@example.invalid" })).toString(
        "base64url",
      ) +
      ".fake";
    expect(
      (
        await post("/api/saas-admin/google-login", {
          credential,
          email: "owner@example.invalid",
        })
      ).status,
    ).toBe(401);
    expect(m.createSession).not.toHaveBeenCalled();
  });
  it("does not accept default passwords without a configured hash", async () => {
    vi.stubEnv("SAAS_OWNER_PASSWORD_HASH", "");
    expect(
      (await post("/api/saas-admin/login", { password: "superadmin" })).status,
    ).toBe(401);
    expect(m.createSession).not.toHaveBeenCalled();
  });
  it("rejects the old master code when no secret is configured", () => {
    vi.stubEnv("MASTER_VERIFICATION_CODE", "");
    expect(verifyMasterVerificationCode("123456")).toBe(false);
  });
});
describe("Stripe signatures verified by the real SDK", () => {
  it.each(["/api/stripe/webhook", "/api/webhooks/stripe"])(
    "verifies the exact raw body at %s and rejects tampering",
    async (endpoint) => {
      const { default: Stripe } =
        await vi.importActual<typeof import("stripe")>("stripe");
      const stripe = new Stripe("sk_test_mock");
      vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_mock");
      vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_mock");
      m.constructEvent.mockImplementation((...args: any[]) =>
        stripe.webhooks.constructEvent(args[0], args[1], args[2]),
      );
      const payload = {
        id: "evt_mock",
        type: "audit.noop",
        data: { object: {} },
      };
      const sig = stripe.webhooks.generateTestHeaderString({
        payload: JSON.stringify(payload),
        secret: "whsec_mock",
      });
      expect(
        (await post(endpoint, payload, { "stripe-signature": sig })).status,
      ).toBe(200);
      expect(
        (
          await post(
            endpoint,
            { ...payload, id: "tampered" },
            { "stripe-signature": sig },
          )
        ).status,
      ).toBe(400);
      expect((await post(endpoint, payload)).status).toBe(400);
      vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
      expect(
        (await post(endpoint, payload, { "stripe-signature": sig })).status,
      ).toBe(400);
    },
  );
});

describe("Signed invoice lifecycle", () => {
  it.each(["invoice.payment_succeeded", "invoice.payment_failed"])(
    "preserves the paid plan on %s",
    async (type) => {
      const { default: Stripe } =
        await vi.importActual<typeof import("stripe")>("stripe");
      const stripe = new Stripe("sk_test_mock");
      vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_mock");
      vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_mock");
      vi.stubEnv("NODE_ENV", "test");
      await Database.getInstance().saveObject(
        "global",
        "stripe_customer_mapping",
        { cus_audit: "audit" },
      );
      vi.stubEnv("NODE_ENV", "production");
      m.subscription.mockResolvedValue({
        plan: "enterprise",
        stripeCustomerId: "cus_audit",
      });
      m.constructEvent.mockImplementation((...args: any[]) =>
        stripe.webhooks.constructEvent(args[0], args[1], args[2]),
      );
      const payload = {
        type,
        data: { object: { customer: "cus_audit", subscription: "sub_audit" } },
      };
      const sig = stripe.webhooks.generateTestHeaderString({
        payload: JSON.stringify(payload),
        secret: "whsec_mock",
      });
      expect(
        (
          await post("/api/stripe/webhook", payload, {
            "stripe-signature": sig,
          })
        ).status,
      ).toBe(200);
      expect(m.saveSubscription).toHaveBeenCalledWith(
        "audit",
        expect.objectContaining({
          plan: "enterprise",
          status: type.endsWith("succeeded") ? "active" : "past_due",
        }),
      );
    },
  );
});

describe("Expired admin OTP challenges", () => {
  it("does not revive an expired challenge on resend", async () => {
    m.send.mockResolvedValue({
      success: true,
      dispatchedChannels: [{ channel: "email", status: "success" }],
    });
    const response = await post("/api/saas-admin/login", {
      password: "audit-correct-password",
    });
    const { challengeToken } = await response.json();
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(Date.now() + 11 * 60 * 1000);
      const resent = await post("/api/saas-admin/resend-otp", {
        challengeToken,
      });
      expect(resent.status).toBe(401);
      expect((await resent.json()).success).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
