import express from "express";
import bcrypt from "bcryptjs";
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
  verifyTOTP,
  generateTOTP
} from "../server/context";

const router = express.Router();

// Production-Level Session and Lockout Management Endpoints for SaaS Admin login
router.post("/saas-admin/login", async (req, res) => {
  const { pin, password, totp } = req.body;
  const inputPin = pin || password;
  const userAgent = req.headers["user-agent"] || "Unknown User Agent";
  const ipAddress = req.ip || req.headers["x-forwarded-for"] || "127.0.0.1";
  const ip = Array.isArray(ipAddress) ? ipAddress[0] : ipAddress;

  try {
    if (!inputPin) {
      return res.status(400).json({ success: false, message: "PIN/Password is required." });
    }

    const hashToUse = process.env.SAAS_OWNER_PASSWORD_HASH;
    const secret = process.env.SAAS_OWNER_TOTP_SECRET;

    if (!hashToUse || !secret) {
      return res.status(503).json({
        success: false,
        error: "SERVICE_UNAVAILABLE",
        message: "SaaS Owner login is currently disabled because security credentials are not fully configured in the server environment variables."
      });
    }

    const isMatch = await bcrypt.compare(inputPin, hashToUse);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: "INVALID_CREDENTIALS",
        message: "Incorrect Super-Admin PIN/Password."
      });
    }

    if (!totp) {
      // Return success but indicate TOTP MFA is required to issue session
      return res.json({
        success: true,
        require2FA: true,
        message: "Password verified. Please enter the 6-digit TOTP security code."
      });
    }

    const isTotpValid = verifyTOTP(totp, secret);
    if (!isTotpValid) {
      return res.status(401).json({
        success: false,
        error: "INVALID_2FA",
        message: "Invalid or expired 6-digit verification code. Please try again."
      });
    }

    const session = await sessionService.createSession(
      "saas-admin",
      "s-saas-owner",
      "SaaS Owner",
      "SaaS Owner",
      ip,
      userAgent
    );

    return res.json({
      success: true,
      session,
      user: {
        id: "s-saas-owner",
        name: "SaaS Owner",
        role: "SaaS Owner",
        permissions: ["billing", "inventory", "reports", "settings", "super_admin"]
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
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
        
        // Count monthly orders
        const orders = (await orderRepo.getAll(t.tenantId)) || [];
        const now = new Date();
        const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        const monthlyCount = orders.filter(o => o.date && o.date.startsWith(currentYearMonth)).length;

        // Find Owner PIN passcode
        const ownerMember = staffList.find(s => s.role === "Owner");
        const ownerPin = ownerMember ? ownerMember.pin : "";

        return {
          ...t,
          plan: sub.plan || "free",
          planStatus: sub.status || "active",
          ownerPin,
          usage: {
            staffCount: staffList.length,
            monthlyOrders: monthlyCount
          }
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
  const { businessName, ownerName, ownerPhone, email, region, pin } = req.body;
  if (!businessName || !ownerName || !email || !pin) {
    return res.status(400).json({ success: false, error: "Missing required registration parameters" });
  }

  try {
    const cleanedName = businessName.toLowerCase().replace(/[^a-z0-9]/g, "");
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    const tenantId = `veg-${cleanedName}-${randomSuffix}`;

    const newOwnerId = `s-${ownerName.toLowerCase().replace(/[^a-z0-9]/g, "")}-${randomSuffix}`;
    const newOwner = {
      id: newOwnerId,
      name: ownerName,
      role: "Owner" as any,
      pin,
      permissions: ["billing", "inventory", "reports", "settings"]
    };

    const newSettings = {
      autoDeductStock: true,
      blockOrdersIfInsufficient: true,
      managerCanAddPurchases: true,
      managerCanEditRecipes: true,
      kdsSoundAlerts: false,
      quickPinRequired: false
    };

    // Save initial slices using repos
    await staffRepo.saveAll(tenantId, [newOwner] as any[]);
    await settingsRepo.save(tenantId, newSettings);

    // Seed default inventory and menu items
    const defaultIngredients = [
      { id: "i-paneer", name: "Paneer", unit: "g", currentStock: 1200, minStock: 2000, costPerUnit: 0.4 },
      { id: "i-butter", name: "Amul Butter", unit: "g", currentStock: 400, minStock: 1000, costPerUnit: 0.6 },
      { id: "i-rice", name: "Basmati Rice", unit: "g", currentStock: 8500, minStock: 5000, costPerUnit: 0.1 },
      { id: "i-tomato", name: "Tomato", unit: "g", currentStock: 850, minStock: 3000, costPerUnit: 0.05 },
      { id: "i-onion", name: "Onion", unit: "g", currentStock: 12000, minStock: 8000, costPerUnit: 0.04 },
      { id: "i-garlic", name: "Garlic", unit: "g", currentStock: 2000, minStock: 1000, costPerUnit: 0.2 },
      { id: "i-maida", name: "Maida Flour", unit: "g", currentStock: 6000, minStock: 4000, costPerUnit: 0.08 }
    ];

    const defaultMenuItems = [
      { id: "m-thali", name: "Special Thali", nameHindi: "स्पेशल थाली", price: 220, category: "Recommended", imageUrl: "🍱", isVegetarian: true, isAvailable: true },
      { id: "m-paneer-butter", name: "Paneer Butter Masala", nameHindi: "पनीर बटर मसाला", price: 180, category: "Main Course", imageUrl: "🥘", isVegetarian: true, isAvailable: true },
      { id: "m-butter-naan", name: "Butter Naan", nameHindi: "बटर नान", price: 50, category: "Breads", imageUrl: "🫓", isVegetarian: true, isAvailable: true }
    ];

    const defaultRecipes = [
      { menuItemId: "m-paneer-butter", ingredients: [{ ingredientId: "i-paneer", quantity: 200 }, { ingredientId: "i-butter", quantity: 30 }, { ingredientId: "i-tomato", quantity: 150 }] }
    ];

    const defaultCustomers = [
      { id: "c-1", name: "Amit Kumar", phone: "9876543210", email: "amit@gmail.com", loyaltyPoints: 120, tier: "Silver", totalSpent: 12400 },
      { id: "c-2", name: "Priya Sharma", phone: "9123456789", email: "priya@yahoo.com", loyaltyPoints: 340, tier: "Gold", totalSpent: 34800 }
    ];

    await ingredientRepo.saveAll(tenantId, defaultIngredients);
    await menuRepo.saveAll(tenantId, defaultMenuItems);
    await recipeRepo.saveAll(tenantId, defaultRecipes);
    await customerRepo.saveAll(tenantId, defaultCustomers as any[]);
    await orderRepo.saveAll(tenantId, []);
    await purchaseRepo.saveAll(tenantId, []);
    await shiftRepo.saveAll(tenantId, []);

    // Add directly to global tenants list
    const list = await getGlobalTenantsList();
    list.push({
      id: `t-${Date.now()}`,
      name: businessName,
      tenantId,
      status: "active",
      created: new Date().toISOString().slice(0, 10),
      region: region || "North India / Delhi",
      ownerName,
      email,
      ownerPhone: ownerPhone || ""
    });
    await saveGlobalTenantsList(list);

    await auditLogService.log(
      tenantId,
      "TENANT_INIT",
      "SYSTEM",
      `SaaS Owner registered new tenant "${businessName}" successfully.`
    );

    res.json({
      success: true,
      tenantId,
      message: `Tenant "${businessName}" successfully registered by Super-Admin.`
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
