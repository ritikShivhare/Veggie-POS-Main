import {describe,it,expect} from "vitest";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
const root=new URL("../",import.meta.url);
const admin=readFileSync(fileURLToPath(new URL("routes/admin.routes.ts",root)),"utf8");
const ui=readFileSync(fileURLToPath(new URL("src/features/saas/SaasAdminDashboard.tsx",root)),"utf8");
describe("SaaS audit visibility security",()=>{
 it("requires an admin session and reads only saas-admin audit logs",()=>{
   expect(admin).toContain('router.get("/admin/audit", adminAuthMiddleware');
   expect(admin).toContain('auditLogService.getLogs("saas-admin")');
   expect(admin).toContain('logs.slice(0, 100)');
 });
 it("shows only read-only audit entries without mutate controls",()=>{
   expect(ui).toContain('fetch("/api/admin/audit"');
   expect(ui).toContain('platformAudit.map(event=>');
   expect(ui).toContain('No administrator audit events recorded.');
 });
});
