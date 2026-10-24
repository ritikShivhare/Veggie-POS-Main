import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root=new URL("../",import.meta.url);
const ui=readFileSync(fileURLToPath(new URL("src/features/saas/SaasAdminDashboard.tsx",root)),"utf8");
const routes=readFileSync(fileURLToPath(new URL("routes/admin.routes.ts",root)),"utf8");
describe("Phase 3 SaaS acceptance safety",()=>{
 it("never claims local-only registration success",()=>{
   expect(ui).not.toContain("successfully registered locally");
   expect(ui).toContain("Super Admin session is required. Sign in with MFA");
 });
 it("never introduces fictional walkthrough records in live service",()=>{
   expect(routes).not.toContain("DEFAULT_SAMPLE_LEADS");
   expect(routes).toContain("existingLeads = [];");
   expect(routes).toContain("leads = [];");
 });
 it("requires admin authentication for walkthrough data reads",()=>{
   expect(routes).toContain('router.get("/leads/walkthrough", adminAuthMiddleware');
 });
});
