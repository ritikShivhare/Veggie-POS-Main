import type {PlanId} from '../../../shared/planCatalog';
export {PLAN_LIMITS} from '../../../shared/planCatalog';
export {getSubscription,saveSubscription} from '../billing/SubscriptionLifecycle';
export interface TenantSubscription {
  plan:PlanId;
  status:'active'|'past_due'|'unpaid'|'canceled'|'read-only';
  isReadOnly:boolean;
  cycleStart?:string;
  cycleEnd?:string;
  paidUntil?:string;
  lastPaidPlan?:PlanId;
  trialEndsAt?:string;
  trialUsed?:boolean;
  reviewRequired?:boolean;
  inventoryFrozen?:boolean;
  financialReview?:boolean;
  financialReviewReason?:string;
  frozenKots?:Record<string,{total:number;items:any[];settleUntil:string}>;
  staffSelectionRequired?:boolean;
  // Read compatibility only; Stripe routes can no longer grant entitlements.
  stripeCustomerId?:string;
  stripeSubscriptionId?:string;
}
