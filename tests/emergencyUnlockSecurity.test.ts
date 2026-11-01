import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const routes = readFileSync(new URL("../routes/auth.routes.ts", import.meta.url), "utf8");
const ui = readFileSync(new URL("../src/features/staff/PinLogin.tsx", import.meta.url), "utf8");

describe("P1 emergency unlock safeguards", () => {
  it("enforces a strict dedicated unlock rate limit", () => {
    expect(routes).toMatch(/const unlockLimiter = rateLimit\(\{ windowMs: 15 \* 60 \* 1000, limit: 5/);
    expect(routes).toContain("router.use('/auth/unlock-override', unlockLimiter)");
  });
  it("requires an existing tenant plus both owner email and unlock key", () => {
    expect(routes).toContain('if (!targetTenant) return res.status(403)');
    expect(routes).toContain('!ownerEmail.trim()');
    expect(routes).toContain('!masterPin.trim()');
    expect(routes).toContain('if (!isOwnerEmailMatch || (!isMasterCode && !isOwnerPinMatch))');
  });
  it("does not permit email-only unlock and aligns the form with backend requirements", () => {
    expect(ui).toContain('if (!overrideMasterPin.trim() || !overrideOwnerEmail.trim())');
    expect(ui).toContain('Owner PIN or Master Key');
    expect(ui).toContain('uppercase">AND</span>');
  });
});
