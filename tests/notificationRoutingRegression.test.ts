import { beforeEach, describe, expect, it } from "vitest";
import { Database } from "../server/features/shared/database";
import { OperationalAlerts } from "../server/features/notifications/OperationalAlerts";
import { NotificationService } from "../server/features/notifications/NotificationService";
import { defaultNotificationRules } from "../src/features/shared/notificationRules";

const db = Database.getInstance();
const alerts = new OperationalAlerts();
const inbox = NotificationService.getInstance();
let tenant: string;
const chef = { id: "chef-1", name: "Chef One", role: "Chef", status: "active", permissions: [] };
const owner = { id: "owner-1", name: "Owner", role: "Owner", status: "active", permissions: [] };
const cashier = { id: "cashier-1", name: "Cashier", role: "Cashier", status: "active", permissions: [] };
const order = { id: "order-1", orderNumber: "#1", type: "Dine-In", status: "Ready", version: 1, items: [], total: 100 };
const actor = (userId: string, role: string) => ({ userId, role });

beforeEach(async () => {
  tenant = "isolated-routing-" + crypto.randomUUID();
  await db.saveSlice(tenant, "staffList", [chef, owner, cashier]);
  await db.saveSlice(tenant, "shifts", [
    { id: "chef-shift", staffId: chef.id, status: "Active", startTime: new Date().toISOString() },
    { id: "cashier-shift", staffId: cashier.id, status: "Active", startTime: new Date().toISOString() }
  ]);
});

describe("operational alert recipient/shift regression", () => {
  it("routes to matching on-duty Chef instead of fallback Owner", async () => {
    await db.runTransaction(tenant, () => alerts.newOrder(tenant, order as any));
    expect(await inbox.getInbox(tenant, actor(chef.id, "Chef"))).toHaveLength(1);
    expect(await inbox.getInbox(tenant, actor(owner.id, "Owner"))).toHaveLength(0);
  });

  it("treats mismatched shift staffId as off-duty and selects fallback (diagnostic)", async () => {
    await db.saveSlice(tenant, "shifts", [
      { id: "chef-shift", staffId: "different-chef-id", status: "Active", startTime: new Date().toISOString() }
    ]);
    await db.runTransaction(tenant, () => alerts.newOrder(tenant, order as any));
    expect(await inbox.getInbox(tenant, actor(chef.id, "Chef"))).toHaveLength(0);
    expect(await inbox.getInbox(tenant, actor(owner.id, "Owner"))).toHaveLength(1);
  });

  it("configured role mismatch selects fallback even when Chef is on duty (diagnostic)", async () => {
    await alerts.saveRules(tenant, { ...structuredClone(defaultNotificationRules),
      newOrder: { enabled: true, role: "Waiter", fallbackRole: "Owner" }
    });
    await db.runTransaction(tenant, () => alerts.newOrder(tenant, order as any));
    expect(await inbox.getInbox(tenant, actor(chef.id, "Chef"))).toHaveLength(0);
    expect(await inbox.getInbox(tenant, actor(owner.id, "Owner"))).toHaveLength(1);
  });

  it("routes served alert to on-duty Cashier without fallback", async () => {
    await db.saveSlice(tenant, "orders", [order]);
    await alerts.serve(tenant, order.id, 1, chef.id);
    expect(await inbox.getInbox(tenant, actor(cashier.id, "Cashier"))).toHaveLength(1);
    expect(await inbox.getInbox(tenant, actor(owner.id, "Owner"))).toHaveLength(0);
  });
});
