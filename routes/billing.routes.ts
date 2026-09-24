import express from "express";
import Stripe from "stripe";
import { Database } from "../server/features/shared/database";
import {
  staffRepo,
  orderRepo,
  authMiddleware,
  idempotencyMiddleware,
  getSubscription,
  saveSubscription,
  PLAN_LIMITS
} from "../server/context";

const router = express.Router();

// Lazy initialization function
let stripeInstance: Stripe | null = null;
function getStripeClient(): Stripe | null {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey || stripeKey === "YOUR_STRIPE_SECRET_KEY") {
    return null;
  }
  if (!stripeInstance) {
    stripeInstance = new Stripe(stripeKey, {
      apiVersion: "2023-10-16" as any,
    });
  }
  return stripeInstance;
}

// 1. Get current billing subscription status & stats
router.get("/billing/subscription", authMiddleware, async (req, res) => {
  const tenantId = (req as any).tenantId;
  const sub = (req as any).subscription; // loaded in authMiddleware
  try {
    const staffList = await staffRepo.getAll(tenantId);
    
    const now = new Date();
    const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const orders = await orderRepo.getAll(tenantId);
    const monthlyCount = orders.filter(o => o.date && o.date.startsWith(currentYearMonth)).length;

    const limits = PLAN_LIMITS[sub.plan] || PLAN_LIMITS.free;

    res.json({
      success: true,
      subscription: sub,
      limits,
      usage: {
        staffCount: staffList.length,
        monthlyOrders: monthlyCount
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. Create Stripe Checkout Session
router.post("/billing/create-checkout-session", authMiddleware, idempotencyMiddleware, async (req, res) => {
  const tenantId = (req as any).tenantId;
  const { plan } = req.body; // pro or enterprise
  const origin = req.headers.origin || "http://localhost:3000";

  if (plan !== "pro" && plan !== "enterprise") {
    return res.status(400).json({ success: false, message: "Invalid subscription plan selected." });
  }

  const stripe = getStripeClient();

  // If no Stripe key is configured, fall back to our premium interactive simulator
  if (!stripe) {
    console.log(`[Stripe Billing] No Stripe API key configured. Redirecting to custom interactive Checkout Simulator for tenant ${tenantId}.`);
    return res.json({
      success: true,
      url: `/api/billing/mock-checkout?tenantId=${tenantId}&plan=${plan}&origin=${encodeURIComponent(origin)}`
    });
  }

  try {
    let sub = await getSubscription(tenantId);
    let customerId = sub.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: req.body.email || `${tenantId}@veggiepos.com`,
        metadata: { tenantId }
      });
      customerId = customer.id;
      sub.stripeCustomerId = customerId;
      await saveSubscription(tenantId, sub);

      // Save global customer mapping
      const db = Database.getInstance();
      const mapping = (await db.getObject<Record<string, string>>("global", "stripe_customer_mapping")) || {};
      mapping[customerId] = tenantId;
      await db.saveObject("global", "stripe_customer_mapping", mapping);
    }

    const priceAmount = plan === "pro" ? 99900 : 299900;
    const planLabel = plan === "pro" ? "Professional Pro Plan" : "Enterprise Elite Plan";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "inr",
            product_data: {
              name: `VeggiePOS ${planLabel}`,
              description: plan === "pro" ? "Up to 10 staff members, 500 monthly orders" : "Unlimited staff members, unlimited monthly orders",
            },
            unit_amount: priceAmount,
            recurring: { interval: "month" },
          },
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${origin}/?tab=settings&checkout=success&tenantId=${tenantId}`,
      cancel_url: `${origin}/?tab=settings&checkout=cancel&tenantId=${tenantId}`,
      metadata: { tenantId, plan }
    });

    res.json({ success: true, url: session.url });
  } catch (error: any) {
    console.error("Stripe Checkout Session Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. Create Stripe Customer Portal Session
router.post("/billing/create-portal-session", authMiddleware, idempotencyMiddleware, async (req, res) => {
  const tenantId = (req as any).tenantId;
  const origin = req.headers.origin || "http://localhost:3000";
  const stripe = getStripeClient();

  if (!stripe) {
    console.log(`[Stripe Billing] No Stripe API key configured. Redirecting to custom interactive Billing Portal Simulator for tenant ${tenantId}.`);
    return res.json({
      success: true,
      url: `/api/billing/mock-portal?tenantId=${tenantId}&origin=${encodeURIComponent(origin)}`
    });
  }

  try {
    const sub = await getSubscription(tenantId);
    if (!sub.stripeCustomerId) {
      return res.status(400).json({
        success: false,
        message: "No active Stripe customer profile found. Please complete Checkout or choose a plan first."
      });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: `${origin}/?tab=settings`,
    });

    res.json({ success: true, url: session.url });
  } catch (error: any) {
    console.error("Stripe Portal Session Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4. Actual Stripe Webhook Endpoint (handles signature checking if configured)
router.post("/webhooks/stripe", express.raw({ type: "application/json" }), async (req, res) => {
  const stripe = getStripeClient();
  if (!stripe) {
    return res.status(400).send("Stripe SDK is not configured.");
  }

  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  let event: any;

  try {
    if (webhookSecret && sig) {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } else {
      // Direct parse fallback for development testing/forwarding without signature verification
      event = JSON.parse(req.body.toString());
    }
  } catch (err: any) {
    console.error("Stripe Webhook Parsing / Signature Verification Failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    const db = Database.getInstance();
    const mapping = (await db.getObject<Record<string, string>>("global", "stripe_customer_mapping")) || {};

    let customerId: string | undefined;
    let subscriptionId: string | undefined;
    let status: string | undefined;
    let tenantId: string | undefined;
    let plan: "free" | "pro" | "enterprise" = "free";

    // Handle the specific subscription lifecycle events
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as any;
        customerId = subscription.customer;
        subscriptionId = subscription.id;
        status = subscription.status; // active, trialing, past_due, unpaid, canceled
        
        // Find tenant ID either from subscription metadata, or our customer-to-tenant mapping
        tenantId = subscription.metadata?.tenantId || mapping[customerId || ""];
        const metadataPlan = subscription.metadata?.plan || "pro";
        plan = (metadataPlan === "pro" || metadataPlan === "enterprise") ? metadataPlan : "pro";
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as any;
        customerId = subscription.customer;
        subscriptionId = subscription.id;
        status = "canceled";
        tenantId = subscription.metadata?.tenantId || mapping[customerId || ""];
        break;
      }
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as any;
        customerId = invoice.customer;
        subscriptionId = invoice.subscription;
        status = "active";
        tenantId = mapping[customerId || ""];
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as any;
        customerId = invoice.customer;
        subscriptionId = invoice.subscription;
        status = "past_due"; // Will flag as read-only mode automatically
        tenantId = mapping[customerId || ""];
        break;
      }
    }

    if (tenantId) {
      const isReadOnly = (status === "past_due" || status === "unpaid" || status === "canceled" || status === "read-only");
      const currentSub = await getSubscription(tenantId);
      
      const updatedSub = {
        plan: status === "canceled" ? "free" : (plan || currentSub.plan),
        status: status as any,
        stripeCustomerId: customerId || currentSub.stripeCustomerId,
        stripeSubscriptionId: subscriptionId || currentSub.stripeSubscriptionId,
        isReadOnly
      };

      await saveSubscription(tenantId, updatedSub);
      console.log(`[Stripe Webhook] Successfully processed ${event.type} for tenant ${tenantId}. Plan set to: ${updatedSub.plan}, Status: ${status}, ReadOnly: ${isReadOnly}`);
    } else if (customerId) {
      console.warn(`[Stripe Webhook] Received subscription event ${event.type} but could not resolve tenantId for customerId ${customerId}.`);
    }

    res.json({ received: true });
  } catch (error: any) {
    console.error("Error processing Stripe webhook event:", error);
    res.status(500).json({ error: error.message });
  }
});

// 5. Serve HTML Mock Checkout Page
router.get("/billing/mock-checkout", async (req, res) => {
  const tenantId = req.query.tenantId as string;
  if (!tenantId) {
    return res.status(400).send("Tenant identifier is required for mock checkout.");
  }
  const plan = req.query.plan as string || "pro";
  const origin = req.query.origin as string || "http://localhost:3000";

  const planName = plan === "pro" ? "Professional Pro" : "Enterprise Elite";
  const planPrice = plan === "pro" ? "₹999.00 / month" : "₹2999.00 / month";
  const planLimits = plan === "pro" ? "Up to 10 staff members and 500 monthly orders" : "Unlimited staff members and unlimited orders";

  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>VeggiePOS Stripe Checkout (Simulator)</title>
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-slate-50 text-slate-900 font-sans min-h-screen flex items-center justify-center p-4">
      <div class="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        
        <!-- Header -->
        <div class="bg-blue-600 px-6 py-5 text-white flex items-center justify-between">
          <div>
            <span class="text-xs uppercase font-bold tracking-wider opacity-75">Stripe Checkout</span>
            <h1 class="text-lg font-bold">Simulator Environment</h1>
          </div>
          <div class="bg-white/10 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase">SANDBOX</div>
        </div>

        <div class="p-6 space-y-6">
          <!-- Order Summary Card -->
          <div class="bg-slate-50 rounded-xl p-4 border border-slate-100 flex justify-between items-center">
            <div>
              <p class="text-xs text-slate-500 font-medium">Subscription Plan</p>
              <h3 class="font-bold text-slate-800 text-sm">${planName}</h3>
              <p class="text-[10px] text-slate-400 mt-0.5">${planLimits}</p>
            </div>
            <div class="text-right">
              <span class="text-base font-extrabold text-blue-600">${planPrice}</span>
            </div>
          </div>

          <!-- Checkout Card Form -->
          <form id="checkout-form" class="space-y-4">
            <div>
              <label class="block text-xs font-bold text-slate-600 mb-1">Email Address</label>
              <input type="email" id="email" required value="${tenantId}@veggiepos.com" class="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white" />
            </div>

            <div class="space-y-2">
              <label class="block text-xs font-bold text-slate-600">Card Information</label>
              <div class="relative">
                <input type="text" id="card" required placeholder="4242 4242 4242 4242" value="4242 4242 4242 4242" class="w-full bg-slate-50 border border-slate-200 rounded-lg pl-3 pr-10 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white font-mono" />
                <span class="absolute right-3 top-2.5 text-xs text-slate-400">💳</span>
              </div>
              <div class="grid grid-cols-2 gap-2">
                <input type="text" placeholder="MM / YY" required value="12/28" class="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white font-mono" />
                <input type="text" placeholder="CVC" required value="123" class="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white font-mono" />
              </div>
            </div>

            <!-- Action Buttons -->
            <div class="space-y-2.5 pt-4">
              <button type="submit" id="btn-pay" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-lg text-xs transition duration-200 flex justify-center items-center shadow-md cursor-pointer">
                Subscribe & Pay ${planPrice.split(" ")[0]}
              </button>

              <button type="button" id="btn-fail" class="w-full bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200/50 font-bold py-2 rounded-lg text-xs transition duration-200 flex justify-center items-center cursor-pointer">
                ⚠️ Simulate Payment Failure
              </button>

              <a href="${origin}/?tab=settings" class="block text-center text-[11px] text-slate-400 hover:text-slate-600 hover:underline pt-2 font-medium">
                Cancel and return to VeggiePOS
              </a>
            </div>
          </form>
        </div>
      </div>

      <script>
        const emailInput = document.getElementById("email");
        const checkoutForm = document.getElementById("checkout-form");
        const btnPay = document.getElementById("btn-pay");
        const btnFail = document.getElementById("btn-fail");

        checkoutForm.addEventListener("submit", async (e) => {
          e.preventDefault();
          btnPay.disabled = true;
          btnPay.innerHTML = "Processing payment...";

          try {
            const res = await fetch("/api/billing/mock-payment-success", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                tenantId: "${tenantId}",
                plan: "${plan}",
                email: emailInput.value
              })
            });

            if (res.ok) {
              window.location.href = "${origin}/?tab=settings&checkout=success&tenantId=${tenantId}";
            } else {
              alert("Payment error, failed to log subscription in local emulator.");
              btnPay.disabled = false;
              btnPay.innerHTML = "Subscribe & Pay";
            }
          } catch (err) {
            console.error(err);
            btnPay.disabled = false;
            btnPay.innerHTML = "Subscribe & Pay";
          }
        });

        btnFail.addEventListener("click", async () => {
          btnFail.disabled = true;
          btnFail.innerHTML = "Simulating fail...";

          try {
            const res = await fetch("/api/billing/mock-payment-fail", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                tenantId: "${tenantId}"
              })
            });

            if (res.ok) {
              window.location.href = "${origin}/?tab=settings&checkout=failed&tenantId=${tenantId}";
            } else {
              alert("Error simulating payment failure.");
              btnFail.disabled = false;
              btnFail.innerHTML = "⚠️ Simulate Payment Failure";
            }
          } catch (err) {
            console.error(err);
            btnFail.disabled = false;
            btnFail.innerHTML = "⚠️ Simulate Payment Failure";
          }
        });
      </script>
    </body>
    </html>
  `);
});

// 6. Mock Success Payment Handler
router.post("/billing/mock-payment-success", idempotencyMiddleware, async (req, res) => {
  const { tenantId, plan, email } = req.body;
  if (!tenantId) {
    return res.status(400).json({ success: false, error: "MISSING_TENANT", message: "Tenant ID is required." });
  }
  try {
    await saveSubscription(tenantId, {
      plan: plan || "pro",
      status: "active",
      stripeCustomerId: `mock_cus_${Date.now()}`,
      stripeSubscriptionId: `mock_sub_${Date.now()}`,
      isReadOnly: false
    });
    console.log(`[Stripe Billing Simulator] Success processed. Plan set to ${plan} for tenant ${tenantId}`);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 7. Mock Failed Payment Handler
router.post("/billing/mock-payment-fail", idempotencyMiddleware, async (req, res) => {
  const { tenantId } = req.body;
  if (!tenantId) {
    return res.status(400).json({ success: false, error: "MISSING_TENANT", message: "Tenant ID is required." });
  }
  try {
    const current = await getSubscription(tenantId);
    await saveSubscription(tenantId, {
      ...current,
      status: "past_due",
      isReadOnly: true
    });
    console.log(`[Stripe Billing Simulator] Failed payment simulated. Tenant ${tenantId} placed in READ-ONLY mode.`);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 8. Serve HTML Mock Billing Portal
router.get("/billing/mock-portal", async (req, res) => {
  const tenantId = req.query.tenantId as string;
  if (!tenantId) {
    return res.status(400).send("Tenant identifier is required for mock portal.");
  }
  const origin = req.query.origin as string || "http://localhost:3000";

  const sub = await getSubscription(tenantId);
  const planLimits = sub.plan === "pro" ? "Up to 10 staff members and 500 monthly orders" : sub.plan === "enterprise" ? "Unlimited staff members and unlimited orders" : "Up to 3 staff members and 30 orders";

  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>VeggiePOS Stripe Customer Portal (Simulator)</title>
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-slate-50 text-slate-900 font-sans min-h-screen flex items-center justify-center p-4">
      <div class="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        
        <!-- Header -->
        <div class="bg-slate-800 px-6 py-5 text-white flex items-center justify-between">
          <div>
            <span class="text-xs uppercase font-bold tracking-wider opacity-75">Stripe Customer Portal</span>
            <h1 class="text-lg font-bold">Billing Dashboard</h1>
          </div>
          <div class="bg-white/10 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase">SANDBOX</div>
        </div>

        <div class="p-6 space-y-6">
          <!-- Active Subscription details -->
          <div class="space-y-1.5">
            <h3 class="text-xs font-bold text-slate-500 uppercase tracking-wider">Current Subscription Plan</h3>
            <div class="bg-slate-50 rounded-xl p-4 border border-slate-100 flex justify-between items-center">
              <div>
                <h4 class="font-extrabold text-slate-800 text-sm capitalize">\${sub.plan} Plan</h4>
                <p class="text-xs text-slate-500 mt-0.5">${planLimits}</p>
                <div class="mt-2 flex items-center gap-1.5">
                  <span class="inline-block w-2 h-2 rounded-full \${sub.isReadOnly ? 'bg-rose-500' : 'bg-emerald-500'}"></span>
                  <span class="text-[10px] font-bold uppercase \${sub.isReadOnly ? 'text-rose-600' : 'text-emerald-600'}">
                    \${sub.isReadOnly ? 'Suspended (Read-Only)' : 'Active'}
                  </span>
                </div>
              </div>
              <div class="text-right">
                <span class="text-sm font-extrabold text-slate-800">\${sub.plan === "pro" ? "₹999/mo" : sub.plan === "enterprise" ? "₹2999/mo" : "₹0/mo"}</span>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="space-y-3">
            <h3 class="text-xs font-bold text-slate-500 uppercase tracking-wider">Subscription Actions</h3>
            
            <div class="grid grid-cols-1 gap-2">
              <button onclick="updateSubscription('free')" class="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2 rounded-lg text-xs transition duration-200 cursor-pointer">
                Downgrade to Free Tier
              </button>
              <button onclick="updateSubscription('pro')" class="w-full bg-blue-50 hover:bg-blue-100 text-blue-600 font-semibold py-2 rounded-lg text-xs transition duration-200 cursor-pointer font-semibold py-2 rounded-lg text-xs transition duration-200 cursor-pointer">
                Switch to Professional Pro (₹999/mo)
              </button>
              <button onclick="updateSubscription('enterprise')" class="w-full bg-purple-50 hover:bg-purple-100 text-purple-600 font-semibold py-2 rounded-lg text-xs transition duration-200 cursor-pointer">
                Switch to Enterprise Elite (₹2999/mo)
              </button>
              <button onclick="simulateFailure()" class="w-full bg-rose-50 hover:bg-rose-100 text-rose-600 font-semibold py-2 rounded-lg text-xs transition duration-200 cursor-pointer border border-rose-100">
                Trigger Simulation Payment Failure (Suspends Access)
              </button>
            </div>
          </div>

          <!-- Footer return -->
          <div class="border-t border-slate-100 pt-4 flex justify-between items-center text-xs text-slate-400">
            <span>Customer ID: \${sub.stripeCustomerId || 'mock_cus_none'}</span>
            <a href="${origin}/?tab=settings" class="text-blue-600 hover:underline font-bold">Return to VeggiePOS</a>
          </div>
        </div>
      </div>

      <script>
        async function updateSubscription(targetPlan) {
          try {
            const res = await fetch("/api/billing/mock-payment-success", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                tenantId: "${tenantId}",
                plan: targetPlan
              })
            });
            if (res.ok) {
              alert("Subscription updated successfully in sandbox portal!");
              window.location.href = "${origin}/?tab=settings&tenantId=${tenantId}";
            } else {
              alert("Failed to update subscription.");
            }
          } catch (err) {
            console.error(err);
          }
        }

        async function simulateFailure() {
          try {
            const res = await fetch("/api/billing/mock-payment-fail", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                tenantId: "${tenantId}"
              })
            });
            if (res.ok) {
              alert("Payment failure simulated! Subscription placed in read-only status.");
              window.location.href = "${origin}/?tab=settings&tenantId=${tenantId}";
            } else {
              alert("Failed to trigger payment failure.");
            }
          } catch (err) {
            console.error(err);
          }
        }
      </script>
    </body>
    </html>
  `);
});

export default router;
