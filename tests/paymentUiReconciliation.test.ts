import { describe, it, expect, beforeEach, afterEach } from "vitest";
import "fake-indexeddb/auto";
import { VeggiePOSLocalDatabase } from "../src/features/shared/services/offline/database";
import { OfflineRepository } from "../src/features/shared/services/offline/OfflineRepository";

describe("P0 payment confirmation UI storage contract", () => {
  let db: VeggiePOSLocalDatabase;
  let repo: OfflineRepository;
  const tenant = "tenant-payment-ui";

  beforeEach(async () => {
    db = new VeggiePOSLocalDatabase("aatmyam-payment-reconciliation-test");
    await db.open();
    repo = new OfflineRepository(db);
    await repo.putOrder(tenant, {
      id: "order-001", orderNumber: "1", date: new Date().toISOString(),
      type: "Dine-In", total: 150, subtotal: 150, status: "Ready",
      items: []
    });
  });

  afterEach(async () => { await db.delete(); });

  it("queues cash settlement without declaring local order paid before server acknowledgment", async () => {
    await repo.recordPaymentOffline(tenant, "order-001", {
      status: "Completed", paymentMethod: "Cash", paidAt: new Date().toISOString()
    });
    const order = (await repo.getOrders(tenant)).find(o => o.id === "order-001");
    const outbox = await repo.getAllOutbox(tenant);
    expect(order?.status).toBe("Ready");
    expect(order?.paidAt).toBeUndefined();
    expect(order?.paymentMethod).toBeUndefined();
    expect(outbox.filter(o => o.entityType === "payment" && o.entityId === "order-001")).toHaveLength(1);
  });

  it("applies server-confirmed Paid state only after canonical order is received", async () => {
    await repo.recordPaymentOffline(tenant, "order-001", {
      status: "Completed", paymentMethod: "Cash", paidAt: new Date().toISOString()
    });
    const confirmedAt = new Date().toISOString();
    await repo.updateEntityWithCanonical(tenant, "payment", "order-001", {
      id: "order-001", status: "Completed", paymentMethod: "Cash", paidAt: confirmedAt, version: 2
    });
    const order = (await repo.getOrders(tenant)).find(o => o.id === "order-001");
    expect(order?.status).toBe("Completed");
    expect(order?.paidAt).toBe(confirmedAt);
    expect(order?.paymentMethod).toBe("Cash");
  });

  it("preserves unpaid state when the queued payment is rejected", async () => {
    const item = await repo.recordPaymentOffline(tenant, "order-001", {
      status: "Completed", paymentMethod: "Cash", paidAt: new Date().toISOString()
    });
    await repo.recordOutboxFailure(item.id, "Payment rejected", "validation_error", 600000);
    const order = (await repo.getOrders(tenant)).find(o => o.id === "order-001");
    const saved = (await repo.getAllOutbox(tenant)).find(o => o.id === item.id);
    expect(order?.status).toBe("Ready");
    expect(order?.paidAt).toBeUndefined();
    expect(saved?.status).toBe("validation_error");
  });
});
