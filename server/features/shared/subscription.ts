import { Database } from "./database";
import { PLAN_LIMITS, type PlanId } from "../../../shared/planCatalog";

export { PLAN_LIMITS };

export interface TenantSubscription {
  plan: PlanId;
  status: 'active' | 'past_due' | 'unpaid' | 'canceled' | 'read-only';
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  isReadOnly: boolean;
}

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
