/** Shared source of truth for the app's tenant subscription plans. */
export const PLAN_LIMITS = {
  free: {
    label: "Free Starter",
    staffCount: 3,
    monthlyOrders: 30,
    price: 0,
    currency: "INR",
    priceId: "price_free",
    features: {
      posTerminal: true,
      basicReports: true,
      advancedInventory: false,
      aiCopilot: false,
      dedicatedSupport: false,
    }
  },
  pro: {
    label: "Professional Pro",
    staffCount: 10,
    monthlyOrders: 500,
    price: 999,
    currency: "INR",
    priceId: "price_pro",
    features: {
      posTerminal: true,
      basicReports: true,
      advancedInventory: true,
      aiCopilot: true,
      dedicatedSupport: false,
    }
  },
  enterprise: {
    label: "Enterprise Elite",
    staffCount: 100000, // unlimited
    monthlyOrders: 100000, // unlimited
    price: 1999,
    currency: "INR",
    priceId: "price_ent",
    features: {
      posTerminal: true,
      basicReports: true,
      advancedInventory: true,
      aiCopilot: true,
      dedicatedSupport: true,
    }
  }
} as const;

export type PlanId = keyof typeof PLAN_LIMITS;
