import {subscriptionUsage,resolveSubscriptionReview,getPlanLimits} from '../server/features/billing/SubscriptionLifecycle';
import rateLimit from "express-rate-limit";
import express from "express";
import crypto from "crypto";
import {
  adminAuthMiddleware,
  sessionService,
  getGlobalTenantsList,
  saveGlobalTenantsList,
  getSubscription,
  staffRepo,
  orderRepo,
  settingsRepo,
  ingredientRepo,
  menuRepo,
  recipeRepo,
  customerRepo,
  purchaseRepo,
  shiftRepo,
  auditLogService,
  notificationService
} from "../server/context";
import {
  SESSION_COOKIE_NAME,
  getSessionCookieOptions
} from "../server/features/auth/SessionService";
import { hashPin } from "../server/features/auth/PinSecurityService";
import { Database } from "../server/features/shared/database";

import {verifySupabaseSuperAdmin} from "../server/features/auth/SuperAdminAuth";

const router = express.Router();

// No legacy credential path can mint an administrator session.
const adminLimiter = rateLimit({windowMs:15*60*1000,limit:15,standardHeaders:true,legacyHeaders:false});
router.post(['/saas-admin/login','/saas-admin/google-login','/saas-admin/resend-otp'], (_req,res) => {
  res.status(410).json({success:false,error:'LEGACY_ADMIN_LOGIN_DISABLED',message:'Use the verified Supabase administrator login with authenticator verification.'});
});
router.post('/saas-admin/exchange', adminLimiter, async (req,res) => {
  const authorization=req.get('authorization') || '';
  if (!authorization.startsWith('Bearer ') || !authorization.slice(7).trim()) {
    return res.status(401).json({success:false,error:'ADMIN_TOKEN_REQUIRED'});
  }
  try {
    const verified=await verifySupabaseSuperAdmin(authorization.slice(7).trim());
    if(!verified) return res.status(403).json({success:false,error:'ADMIN_NOT_AUTHORIZED_OR_MFA_REQUIRED'});
    const session=await sessionService.createSession('saas-admin',`supabase:${verified.user.id}`,'SaaS Owner','SaaS Owner',req.ip || '',String(req.headers['user-agent'] || ''),['super_admin'],verified.identity);
    res.cookie(SESSION_COOKIE_NAME,session.sessionId,{...getSessionCookieOptions(req),maxAge:verified.identity.expiresAt-Date.now()});
    return res.json({success:true,session,user:{id:session.userId,name:session.userName,role:session.role,permissions:['super_admin']}});
  } catch {
    return res.status(503).json({success:false,error:'ADMIN_IDENTITY_SERVICE_UNAVAILABLE'});
  }
});

// SaaS-wide audit is scoped to administrator actions only; never expose restaurant audit logs.
router.get("/admin/audit", adminAuthMiddleware, async (_req, res) => {
  try {
    const logs = await auditLogService.getLogs("saas-admin");
    return res.json({success: true, logs: logs.slice(0, 100).map(({id, timestamp, eventType, actor, description}) =>
      ({id, timestamp, eventType, actor, description}))});
  } catch {
    return res.status(503).json({success:false,error:"ADMIN_AUDIT_UNAVAILABLE"});
  }
});

router.get("/admin/tenants", adminAuthMiddleware, async (req, res) => {
  try {
    const tenants = await getGlobalTenantsList();

    // Enrich with dynamic live subscription and usage stats
    const enrichedTenants = await Promise.all(tenants.map(async (t) => {
      try {
        const sub = await getSubscription(t.tenantId);

        // Count staff
        const staffList = (await staffRepo.getAll(t.tenantId)) || [];

        // Mask Owner PIN passcode completely
        const ownerMember = staffList.find(s => s.role === "Owner");
        const ownerPin = ownerMember ? "•••••" : "";

        return {
          ...t,
          plan: sub.plan || "free",
          planStatus: sub.status || "active",
          subscription:sub,limits:getPlanLimits(sub),
          ownerPin,
          usage: await subscriptionUsage(t.tenantId,sub)
        };
      } catch (err) {
        return {
          ...t,
          plan: "free",
          planStatus: "active",
          usage: { staffCount: 0, monthlyOrders: 0 }
        };
      }
    }));

    res.json({ success: true, tenants: enrichedTenants });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/admin/subscription/resolve-review',adminAuthMiddleware,async(req,res)=>{
 try{const {tenantId,kind,reason}=req.body;
  if(!(await getGlobalTenantsList()).some(t=>t.tenantId===tenantId)) return res.status(404).json({success:false,error:'TENANT_NOT_FOUND'});
  await resolveSubscriptionReview(tenantId,kind,reason,(req as any).session.userId);res.json({success:true});
 }catch(error){const status=(error as any).status || 500;res.status(status).json({success:false,error:(error as any).message});}
});

router.post("/admin/tenants/suspend", adminAuthMiddleware, async (req, res) => {
  const { tenantId } = req.body;
  if (!tenantId) {
    return res.status(400).json({ success: false, error: "Tenant ID required." });
  }

  try {
    const list = await getGlobalTenantsList();
    const tenant = list.find(t => t.tenantId === tenantId);
    if (!tenant) {
      return res.status(404).json({ success: false, error: "Tenant not found." });
    }

    tenant.status = "suspended";
    await saveGlobalTenantsList(list);

    await auditLogService.log(
      "saas-admin",
      "TENANT_SUSPENDED",
      "SaaS Owner",
      `Tenant workspace "${tenant.name}" (${tenantId}) has been suspended.`,
      { tenantId }
    );

    res.json({ success: true, message: `Tenant "${tenant.name}" has been suspended. All API access is revoked.` });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/admin/tenants/activate", adminAuthMiddleware, async (req, res) => {
  const { tenantId } = req.body;
  if (!tenantId) {
    return res.status(400).json({ success: false, error: "Tenant ID required." });
  }

  try {
    const list = await getGlobalTenantsList();
    const tenant = list.find(t => t.tenantId === tenantId);
    if (!tenant) {
      return res.status(404).json({ success: false, error: "Tenant not found." });
    }

    tenant.status = "active";
    await saveGlobalTenantsList(list);

    await auditLogService.log(
      "saas-admin",
      "TENANT_ACTIVATED",
      "SaaS Owner",
      `Tenant workspace "${tenant.name}" (${tenantId}) has been activated.`,
      { tenantId }
    );

    res.json({ success: true, message: `Tenant "${tenant.name}" has been activated.` });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/admin/tenants/register", adminAuthMiddleware, async (req, res) => {
  const { businessName, ownerName, ownerPhone, email, region, pin } = req.body || {};
  if (typeof businessName !== "string" || !businessName.trim() ||
      typeof ownerName !== "string" || !ownerName.trim() ||
      typeof ownerPhone !== "string" || !ownerPhone.trim() ||
      typeof email !== "string" || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ||
      typeof region !== "string" || typeof pin !== "string" || !/^\d{5}$/.test(pin)) {
    return res.status(400).json({ success: false, error: "Valid restaurant details and a 5-digit Owner PIN are required." });
  }
  try {
    const randomSuffix = crypto.randomUUID();
    const cleanedName = businessName.trim().toLowerCase().replace(/[^a-z0-9]/g, "") || "restaurant";
    const tenantId = `veg-${cleanedName}-${randomSuffix}`;
    const newOwnerId = `s-owner-${randomSuffix}`;
    const hashedPin = await hashPin(pin);
    const result = await Database.getInstance().registerAdminRestaurantAtomic({
      tenantId, ownerId:newOwnerId, businessName:businessName.trim(), ownerName:ownerName.trim(),
      ownerPhone:ownerPhone.trim(), email:email.trim(), region:region.trim(), hashedPin
    });
    return res.json({ success: true, tenantId, tenant: result, message: "Restaurant successfully registered." });
  } catch (error: any) {
    const conflict = error?.code === "23505" || /already registered|already initialized/i.test(String(error?.message || ""));
    return res.status(conflict ? 409 : 500).json({success:false,error:conflict?"Restaurant already registered.":(error?.code || "REGISTRATION_FAILED")});
  }
});

// -----------------------------------------------------------------
// Walkthrough Bookings & Leads Management Endpoints (Public & Admin)
// -----------------------------------------------------------------

export interface WalkthroughLeadRecord {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  restaurantName: string;
  address: string; // Address column
  format: string;
  outletCount: string;
  primaryGoal: string;
  preferredDate?: string;
  preferredTime: string;
  notes?: string;
  createdAt: string;
  status: "new" | "contacted" | "scheduled" | "completed" | "converted" | "cancelled";
  internalNotes?: string;
}

const DEFAULT_SAMPLE_LEADS: WalkthroughLeadRecord[] = [
  {
    id: "lead-sample-1",
    fullName: "Vikram Malhotra",
    email: "vikram@urbanbistro.in",
    phone: "9820198201",
    restaurantName: "Urban Bistro & Brews",
    address: "Shop 14, High Street Mall, Senapati Bapat Road, Pune, Maharashtra - 411016",
    format: "casual-dine",
    outletCount: "2-4",
    primaryGoal: "Recipe BOM stock & ingredient leakage control",
    preferredDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    preferredTime: "morning",
    notes: "Facing inventory wastage issue across 2 locations.",
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    status: "new"
  },
  {
    id: "lead-sample-2",
    fullName: "Pooja Singhania",
    email: "pooja@chaico.com",
    phone: "9811234567",
    restaurantName: "Chai & Conversations Cafe",
    address: "Ground Floor, Cyber Hub, DLF Phase 2, Gurugram, Haryana - 122002",
    format: "cafe-bakery",
    outletCount: "5-10",
    primaryGoal: "Fast PIN billing & speed at register",
    preferredDate: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10),
    preferredTime: "afternoon",
    notes: "Opening 2 more quick-service outlets next month, need fast counter setup.",
    createdAt: new Date(Date.now() - 3600000 * 18).toISOString(),
    status: "contacted",
    internalNotes: "Spoke with manager on WhatsApp. Walkthrough call scheduled."
  }
];

// 1. Public Endpoint: Book Walkthrough from Marketing Website
router.post("/leads/walkthrough", async (req, res) => {
  try {
    const {
      fullName,
      email,
      phone,
      restaurantName,
      address,
      format,
      outletCount,
      primaryGoal,
      preferredDate,
      preferredTime,
      notes
    } = req.body;

    if (!fullName || !phone || !restaurantName) {
      return res.status(400).json({
        success: false,
        message: "Full name, phone number, and restaurant name are required."
      });
    }

    const db = Database.getInstance();
    let existingLeads = await db.getObject<WalkthroughLeadRecord[]>("system-tenant", "walkthrough_leads");
    if (!existingLeads || !Array.isArray(existingLeads)) {
      existingLeads = [...DEFAULT_SAMPLE_LEADS];
    }

    const cleanPhone = String(phone).replace(/[^0-9]/g, "");
    const todayStr = new Date().toISOString().slice(0, 10);

    const existingIndex = -1;
    /* Existing leads may only be edited through authenticated administration.
    const unused = existingLeads.findIndex((l) => {
      const p1 = l.phone.replace(/[^0-9]/g, "");
      const isSamePhone = cleanPhone && p1 && (p1 === cleanPhone || p1.endsWith(cleanPhone) || cleanPhone.endsWith(p1));
      const isSameEmail = email && l.email && l.email.toLowerCase().trim() === String(email).toLowerCase().trim();
      const isSameRest = l.restaurantName && l.restaurantName.toLowerCase().trim() === String(restaurantName).toLowerCase().trim();
      return isSamePhone || isSameEmail || (isSameRest && l.fullName.toLowerCase().trim() === String(fullName).toLowerCase().trim());
    });

    */
    let targetLead: WalkthroughLeadRecord;
    let isRescheduled = false;

    if (existingIndex !== -1) {
      // Existing lead putting same details again or scheduling again after slot expired
      const existingLead = existingLeads[existingIndex];
      const isExpired = existingLead.preferredDate ? existingLead.preferredDate < todayStr : false;

      existingLead.fullName = String(fullName).trim();
      if (email) existingLead.email = String(email).trim();
      existingLead.phone = String(phone).trim();
      existingLead.restaurantName = String(restaurantName).trim();
      if (address) existingLead.address = String(address).trim();
      if (format) existingLead.format = format;
      if (outletCount) existingLead.outletCount = outletCount;
      if (primaryGoal) existingLead.primaryGoal = primaryGoal;
      existingLead.preferredDate = preferredDate || existingLead.preferredDate || new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      existingLead.preferredTime = preferredTime || existingLead.preferredTime || "morning";
      if (notes) existingLead.notes = String(notes).trim();
      existingLead.createdAt = new Date().toISOString();
      existingLead.status = "new";

      // Move to top of list
      existingLeads.splice(existingIndex, 1);
      existingLeads.unshift(existingLead);
      targetLead = existingLead;
      isRescheduled = isExpired;
    } else {
      targetLead = {
        id: `lead-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        fullName: String(fullName).trim(),
        email: String(email || "").trim(),
        phone: String(phone).trim(),
        restaurantName: String(restaurantName).trim(),
        address: String(address || "").trim(),
        format: format || "casual-dine",
        outletCount: outletCount || "1",
        primaryGoal: primaryGoal || "Fast PIN billing & speed at register",
        preferredDate: preferredDate || new Date(Date.now() + 86400000).toISOString().slice(0, 10),
        preferredTime: preferredTime || "morning",
        notes: notes ? String(notes).trim() : "",
        createdAt: new Date().toISOString(),
        status: "new"
      };
      existingLeads.unshift(targetLead);
    }

    await db.saveObject("system-tenant", "walkthrough_leads", existingLeads);

    // Also push notification to in-app notification center for all tenants/SaaS owner
    try {
      const currentNotifications = (await db.getObject<any[]>("saas-admin", "system_notifications")) || [];
      const newNotification = {
        id: `notify-lead-${Date.now()}`,
        title: isRescheduled ? "🔄 Walkthrough Re-scheduled" : "🌟 Walkthrough Schedule Confirmed",
        message: `${targetLead.fullName} (${targetLead.restaurantName}) - Slot: ${targetLead.preferredDate} (${targetLead.preferredTime.toUpperCase()}). Address: ${targetLead.address || "N/A"}. Contact: ${targetLead.phone}`,
        timestamp: new Date().toISOString(),
        read: false,
        severity: "info"
      };
      currentNotifications.unshift(newNotification);
      await db.saveObject("saas-admin", "system_notifications", currentNotifications.slice(0, 50));
    } catch (notifErr) {
      console.warn("Could not append lead to system_notifications:", notifErr);
    }

    await auditLogService.log(
      "system-tenant",
      "LEAD_CAPTURE",
      "WEBSITE",
      `Walkthrough ${isRescheduled ? "re-scheduled" : "booked"} for "${targetLead.restaurantName}" by ${targetLead.fullName} (Phone: ${targetLead.phone}, Address: ${targetLead.address || "N/A"})`
    );

    res.json({
      success: true,
      lead: targetLead,
      isRescheduled,
      message: "Walkthrough request successfully recorded."
    });
  } catch (error: any) {
    console.error("Error creating walkthrough lead:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. Admin Endpoint: List all Walkthrough Leads
router.get("/leads/walkthrough", adminAuthMiddleware, async (req, res) => {
  try {
    const db = Database.getInstance();
    let leads = await db.getObject<WalkthroughLeadRecord[]>("system-tenant", "walkthrough_leads");
    if (!leads || !Array.isArray(leads) || leads.length === 0) {
      leads = [...DEFAULT_SAMPLE_LEADS];
      await db.saveObject("system-tenant", "walkthrough_leads", leads);
    }

    res.json({
      success: true,
      leads
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. Admin Endpoint: Update Lead Status / Notes
router.patch("/leads/walkthrough/:id", adminAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, internalNotes } = req.body;

    const db = Database.getInstance();
    let leads = await db.getObject<WalkthroughLeadRecord[]>("system-tenant", "walkthrough_leads");
    if (!leads || !Array.isArray(leads)) {
      leads = [...DEFAULT_SAMPLE_LEADS];
    }

    const index = leads.findIndex((l) => l.id === id);
    if (index === -1) {
      return res.status(404).json({ success: false, message: "Lead not found." });
    }

    if (status) leads[index].status = status;
    if (internalNotes !== undefined) leads[index].internalNotes = internalNotes;

    await db.saveObject("system-tenant", "walkthrough_leads", leads);

    res.json({
      success: true,
      lead: leads[index],
      message: "Lead updated successfully."
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4. Admin Endpoint: Delete a Lead
router.delete("/leads/walkthrough/:id", adminAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const db = Database.getInstance();
    let leads = await db.getObject<WalkthroughLeadRecord[]>("system-tenant", "walkthrough_leads");
    if (leads && Array.isArray(leads)) {
      leads = leads.filter((l) => l.id !== id);
      await db.saveObject("system-tenant", "walkthrough_leads", leads);
    }
    res.json({ success: true, message: "Lead removed." });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
