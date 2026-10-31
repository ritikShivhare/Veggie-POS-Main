import {describe,it,expect} from "vitest";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
const src=readFileSync(fileURLToPath(new URL("../src/features/saas/SaasAdminDashboard.tsx",import.meta.url)),"utf8");
describe("SaaS registry-only store overview",()=>{
  it("uses same live registry for total and active/pending counts",()=>{
    expect(src).toContain('{localTenants.length} <span className="text-xs text-slate-400 font-medium">registered</span>');
    expect(src).toContain("Active: {localTenants.filter(t => t.status === 'active').length}");
    expect(src).toContain("Pending: {localTenants.filter(t => t.status === 'pending').length}");
    expect(src).not.toContain('{tenants.length} <span className="text-xs text-slate-400 font-medium">registered</span>');
  });
});
