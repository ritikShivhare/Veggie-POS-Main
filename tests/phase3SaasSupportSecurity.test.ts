import {describe,it,expect} from "vitest";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
const root=new URL("../",import.meta.url);
const routes=readFileSync(fileURLToPath(new URL("routes/admin.routes.ts",root)),"utf8");
const ui=readFileSync(fileURLToPath(new URL("src/features/saas/SaasAdminDashboard.tsx",root)),"utf8");
describe("SaaS security & support guardrails",()=>{
 it("protects security summary and never returns session secrets",()=>{
  expect(routes).toContain('router.get("/admin/security/summary", adminAuthMiddleware');
  expect(routes).toContain("activeSessionCount:sessions.length");
  expect(routes).toContain("deviceType:s.device?.deviceType");
  expect(routes).not.toContain("sessionId:s.sessionId");
 });
 it("keeps support triage separate from real ticket functionality",()=>{
  expect(ui).toContain('activeAdminTab==="support"');
  expect(ui).toContain("There is no support ticket inbox connected yet");
  expect(ui).toContain('setStatusFilter("suspended")');
 });
 it("requires authenticated summary request",()=>{
  expect(ui).toContain('fetch("/api/admin/security/summary"');
  expect(ui).toContain('"x-tenant-id":"saas-admin"');
 });
});
