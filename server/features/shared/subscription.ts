import { Database } from "./database";

export interface TenantSubscription {
  plan: 'free' | 'pro' | 'enterprise';
  status: 'active' | 'past_due' | 'unpaid' | 'canceled' | 'read-only';
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  isReadOnly: boolean;
}

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
    price: 2999,
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
};

export async function getSubscription(tenantId: string): Promise<TenantSubscription> {
  const db = Database.getInstance();
  const sub = await db.getObject<TenantSubscription>(tenantId, "stripe_subscription");
  if (!sub) {
    return {
      plan: 'free',
      status: 'active',
      isReadOnly: false
    };
  }
  return sub;
}

export async function saveSubscription(tenantId: string, sub: TenantSubscription): Promise<void> {
  const db = Database.getInstance();
  await db.saveObject(tenantId, "stripe_subscription", sub);
}
