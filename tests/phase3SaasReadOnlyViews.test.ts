import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
const path=fileURLToPath(new URL("../src/features/saas/SaasAdminDashboard.tsx",import.meta.url));
const source=readFileSync(path,"utf8");
describe("SaaS Control Center phase 3 read-only sections",()=>{
  it("uses backend-provided tenants for subscription and analytics views",()=>{
    expect(source).toContain('activeAdminTab === "billing"');
    expect(source).toContain('activeAdminTab === "analytics"');
    expect(source).toContain("localTenants.map(t =>");
    expect(source).toContain('t.usage?.monthlyOrders ?? "—"');
  });
  it("does not display owner PINs or fabricated contact placeholders",()=>{
    expect(source).not.toContain("Owner PIN: {t.ownerPin}");
    expect(source).not.toContain("demo@veggiepos.com");
    expect(source).not.toContain('{t.ownerPhone || "9876543210"}');
  });
  it("keeps payment and unavailable activity explicitly unimplemented",()=>{
    expect(source).toContain("Payments and invoices are not available in this view.");
    expect(source).toContain("No fabricated records are displayed.");
  });
});
