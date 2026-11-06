import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";

const root=new URL("../",import.meta.url);
const staff=readFileSync(fileURLToPath(new URL("src/features/staff/StaffShifts.tsx",root)),"utf8");
const pos=readFileSync(fileURLToPath(new URL("routes/pos.routes.ts",root)),"utf8");
describe("Owner-only team administration",()=>{
 it("hides staff registration and roster management from Manager without hiding shift oversight",()=>{
  expect(staff).toContain('const isOwner = currentStaff.role === "Owner"');
  expect(staff).toContain('const isManagerOrOwner = isOwner || currentStaff.role === "Manager"');
  expect(staff).toMatch(/Team membership and staff credentials are Owner-only[\s\S]{0,90}\{isOwner && \(/);
  expect(staff).not.toContain('{/* Add Staff Member (Owner / Manager only) */}');
 });
 it("defends staff mutations even if the UI is bypassed",()=>{
  for(const route of [
    'router.post("/staff", authMiddleware, requireRole("Owner")',
    'router.post("/staff/bulk", authMiddleware, requireRole("Owner")',
    'router.put("/staff/:id", authMiddleware, requireRole("Owner")',
    'router.delete("/staff/:id", authMiddleware, requireRole("Owner")'
  ]) expect(pos).toContain(route);
 });
 it("blocks accidental staff-management handler invocation from non-owners",()=>{
  expect(staff).toContain('if (!isOwner || isSaving || needsRefresh) return;');
 });
});
