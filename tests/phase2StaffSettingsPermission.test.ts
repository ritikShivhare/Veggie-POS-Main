import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const editor = readFileSync(fileURLToPath(new URL("src/features/staff/StaffAccessEditor.tsx", root)), "utf8");
const routes = readFileSync(fileURLToPath(new URL("routes/pos.routes.ts", root)), "utf8");

describe("Owner-only Settings permission policy", () => {
  it("does not offer the settings permission in staff access editor", () => {
    expect(editor).toContain("const visiblePermissions=['billing','inventory','reports'] as const;");
    expect(editor).toContain("permissions.filter(permission=>permission!=='settings')");
  });
  it("normalizes non-owner permissions on staff create and update", () => {
    expect(routes).toContain('req.body.role !== "Owner"');
    expect(routes).toContain('current.role !== "Owner"');
    expect(routes).toContain('permission !== "settings"');
    expect(routes).toContain('permission!=="settings"');
  });
  it("keeps staff mutation endpoints Owner-only", () => {
    expect(routes).toContain('router.post("/staff", authMiddleware, requireRole("Owner")');
    expect(routes).toContain('router.put("/staff/:id", authMiddleware, requireRole("Owner")');
  });
});
