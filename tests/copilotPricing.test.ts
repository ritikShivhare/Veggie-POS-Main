import { afterEach, expect, it, vi } from "vitest";
import { CopilotService } from "../server/features/copilot/CopilotService";
import { PLAN_LIMITS } from "../shared/planCatalog";

afterEach(() => vi.unstubAllEnvs());

it("quotes the app's current 30-day plans without an onboarding guarantee", async () => {
  vi.stubEnv("GEMINI_API_KEY", "");
  const result = await new CopilotService().handleChat(
    "What plans can I choose?", [], "preview", "Preview", "Visitor", "Owner"
  );
  for (const plan of Object.values(PLAN_LIMITS)) {
    expect(result.reply).toContain(plan.label);
    expect(result.reply).toContain(`₹${plan.price}/30 days`);
  }
  expect(result.reply).not.toMatch(/billed annually|48.hour|rapid go.live/i);
});
