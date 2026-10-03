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
import {
  SESSION_COOKIE_NAME,
  getSessionCookieOptions
} from "../server/features/auth/SessionService";
import { hashPin } from "../server/features/auth/PinSecurityService";
import { Database } from "../server/features/shared/database";

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

    // Set production-grade HttpOnly Secure session cookie
    res.cookie(SESSION_COOKIE_NAME, session.sessionId, getSessionCookieOptions(req));

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

        // Mask Owner PIN passcode completely
        const ownerMember = staffList.find(s => s.role === "Owner");
        const ownerPin = ownerMember ? "•••••" : "";

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
    const hashedPin = await hashPin(pin);
    const newOwner = {
      id: newOwnerId,
      name: ownerName,
      role: "Owner" as any,
      pin: hashedPin,
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

    // Seed full default inventory, menu items, and editable recipes
    const defaultIngredients = [
      { id: "i-paneer", name: "Paneer", unit: "g", currentStock: 2200, minStock: 2000, costPerUnit: 0.4 },
      { id: "i-butter", name: "Amul Butter", unit: "g", currentStock: 1400, minStock: 1000, costPerUnit: 0.6 },
      { id: "i-rice", name: "Basmati Rice", unit: "g", currentStock: 8500, minStock: 5000, costPerUnit: 0.1 },
      { id: "i-tomato", name: "Tomato", unit: "g", currentStock: 3850, minStock: 3000, costPerUnit: 0.05 },
      { id: "i-onion", name: "Onion", unit: "g", currentStock: 12000, minStock: 8000, costPerUnit: 0.04 },
      { id: "i-garlic", name: "Garlic", unit: "g", currentStock: 2000, minStock: 1000, costPerUnit: 0.2 },
      { id: "i-maida", name: "Maida Flour", unit: "g", currentStock: 6000, minStock: 4000, costPerUnit: 0.08 },
      { id: "i-milk", name: "Fresh Milk / Cream", unit: "ml", currentStock: 5000, minStock: 2000, costPerUnit: 0.06 },
      { id: "i-lemon", name: "Fresh Lemon", unit: "pcs", currentStock: 60, minStock: 20, costPerUnit: 5 },
      { id: "i-sugar", name: "Sugar", unit: "g", currentStock: 4500, minStock: 2000, costPerUnit: 0.04 },
      { id: "i-tea-coffee", name: "Tea Leaves & Coffee", unit: "g", currentStock: 1200, minStock: 500, costPerUnit: 0.3 }
    ];

    const defaultMenuItems = [
      { id: "m-thali", name: "Special Thali", nameHindi: "स्पेशल थाली", price: 220, category: "Recommended", imageUrl: "🍱", isVegetarian: true, isAvailable: true },
      { id: "m-paneer-butter", name: "Paneer Butter Masala", nameHindi: "पनीर बटर मसाला", price: 180, category: "Main Course", imageUrl: "🥘", isVegetarian: true, isAvailable: true },
      { id: "m-paneer-tikka", name: "Paneer Tikka", nameHindi: "पनीर टिक्का", price: 150, category: "Starters", imageUrl: "🍢", isVegetarian: true, isAvailable: true },
      { id: "m-manchurian", name: "Veg Manchurian Dry", nameHindi: "वेज मंचूरियन", price: 140, category: "Chinese", imageUrl: "🧆", isVegetarian: true, isAvailable: true },
      { id: "m-crispy-corn", name: "Crispy Corn", nameHindi: "क्रिस्पी कॉर्न", price: 130, category: "Starters", imageUrl: "🌽", isVegetarian: true, isAvailable: true },
      { id: "m-hara-bhara", name: "Hara Bhara Kabab", nameHindi: "हरा भरा कबाब", price: 150, category: "Starters", imageUrl: "🥙", isVegetarian: true, isAvailable: true },
      { id: "m-dal-makhani", name: "Dal Makhani", nameHindi: "दाल मखनी", price: 160, category: "Main Course", imageUrl: "🍲", isVegetarian: true, isAvailable: true },
      { id: "m-dal-tadka", name: "Dal Tadka", nameHindi: "दाल तड़का", price: 140, category: "Main Course", imageUrl: "🥣", isVegetarian: true, isAvailable: true },
      { id: "m-kadhai-paneer", name: "Kadhai Paneer", nameHindi: "कढ़ाई पनीर", price: 190, category: "Main Course", imageUrl: "🥘", isVegetarian: true, isAvailable: true },
      { id: "m-veg-biryani", name: "Veg Biryani", nameHindi: "वेज बिरयानी", price: 250, category: "Rice & Biryani", imageUrl: "🍛", isVegetarian: true, isAvailable: true },
      { id: "m-jeera-rice", name: "Jeera Rice", nameHindi: "जीरा राइस", price: 180, category: "Rice & Biryani", imageUrl: "🍚", isVegetarian: true, isAvailable: true },
      { id: "m-butter-naan", name: "Butter Naan", nameHindi: "बटर नान", price: 50, category: "Breads", imageUrl: "🫓", isVegetarian: true, isAvailable: true },
      { id: "m-tandoori-roti", name: "Tandoori Roti", nameHindi: "तंदूरी रोटी", price: 20, category: "Breads", imageUrl: "🥖", isVegetarian: true, isAvailable: true },
      { id: "m-gulab-jamun", name: "Gulab Jamun (2pcs)", nameHindi: "गुलाब जामुन", price: 50, category: "Desserts", imageUrl: "🥯", isVegetarian: true, isAvailable: true },
      { id: "m-vanilla-ice", name: "Vanilla Ice Cream", nameHindi: "वैनिला आइसक्रीम", price: 40, category: "Desserts", imageUrl: "🍨", isVegetarian: true, isAvailable: true },
      { id: "m-soda", name: "Fresh Lime Soda", nameHindi: "शिकंजी", price: 50, category: "Beverages", imageUrl: "🥤", isVegetarian: true, isAvailable: true },
      { id: "m-water", name: "Mineral Water", nameHindi: "पानी", price: 20, category: "Beverages", imageUrl: "🍼", isVegetarian: true, isAvailable: true }
    ];

    const defaultRecipes = [
      {
        menuItemId: "m-thali",
        ingredients: [
          { ingredientId: "i-paneer", quantity: 100 },
          { ingredientId: "i-butter", quantity: 20 },
          { ingredientId: "i-rice", quantity: 120 },
          { ingredientId: "i-tomato", quantity: 40 },
          { ingredientId: "i-onion", quantity: 40 }
        ]
      },
      {
        menuItemId: "m-paneer-butter",
        ingredients: [
          { ingredientId: "i-paneer", quantity: 200 },
          { ingredientId: "i-butter", quantity: 50 },
          { ingredientId: "i-tomato", quantity: 80 },
          { ingredientId: "i-onion", quantity: 50 }
        ]
      },
      {
        menuItemId: "m-paneer-tikka",
        ingredients: [
          { ingredientId: "i-paneer", quantity: 180 },
          { ingredientId: "i-onion", quantity: 40 },
          { ingredientId: "i-tomato", quantity: 30 }
        ]
      },
      {
        menuItemId: "m-manchurian",
        ingredients: [
          { ingredientId: "i-maida", quantity: 50 },
          { ingredientId: "i-onion", quantity: 60 },
          { ingredientId: "i-garlic", quantity: 20 }
        ]
      },
      {
        menuItemId: "m-crispy-corn",
        ingredients: [
          { ingredientId: "i-maida", quantity: 40 },
          { ingredientId: "i-butter", quantity: 20 },
          { ingredientId: "i-onion", quantity: 30 }
        ]
      },
      {
        menuItemId: "m-hara-bhara",
        ingredients: [
          { ingredientId: "i-paneer", quantity: 60 },
          { ingredientId: "i-onion", quantity: 30 },
          { ingredientId: "i-maida", quantity: 30 }
        ]
      },
      {
        menuItemId: "m-dal-makhani",
        ingredients: [
          { ingredientId: "i-butter", quantity: 40 },
          { ingredientId: "i-tomato", quantity: 50 },
          { ingredientId: "i-onion", quantity: 30 },
          { ingredientId: "i-milk", quantity: 30 }
        ]
      },
      {
        menuItemId: "m-dal-tadka",
        ingredients: [
          { ingredientId: "i-butter", quantity: 25 },
          { ingredientId: "i-tomato", quantity: 40 },
          { ingredientId: "i-onion", quantity: 30 },
          { ingredientId: "i-garlic", quantity: 15 }
        ]
      },
      {
        menuItemId: "m-kadhai-paneer",
        ingredients: [
          { ingredientId: "i-paneer", quantity: 180 },
          { ingredientId: "i-butter", quantity: 35 },
          { ingredientId: "i-tomato", quantity: 60 },
          { ingredientId: "i-onion", quantity: 50 }
        ]
      },
      {
        menuItemId: "m-veg-biryani",
        ingredients: [
          { ingredientId: "i-rice", quantity: 180 },
          { ingredientId: "i-onion", quantity: 50 },
          { ingredientId: "i-tomato", quantity: 30 },
          { ingredientId: "i-paneer", quantity: 30 }
        ]
      },
      {
        menuItemId: "m-jeera-rice",
        ingredients: [
          { ingredientId: "i-rice", quantity: 160 },
          { ingredientId: "i-butter", quantity: 20 }
        ]
      },
      {
        menuItemId: "m-butter-naan",
        ingredients: [
          { ingredientId: "i-maida", quantity: 100 },
          { ingredientId: "i-butter", quantity: 15 }
        ]
      },
      {
        menuItemId: "m-tandoori-roti",
        ingredients: [
          { ingredientId: "i-maida", quantity: 80 }
        ]
      },
      {
        menuItemId: "m-gulab-jamun",
        ingredients: [
          { ingredientId: "i-maida", quantity: 50 },
          { ingredientId: "i-sugar", quantity: 40 },
          { ingredientId: "i-butter", quantity: 15 }
        ]
      },
      {
        menuItemId: "m-vanilla-ice",
        ingredients: [
          { ingredientId: "i-milk", quantity: 120 },
          { ingredientId: "i-sugar", quantity: 25 }
        ]
      },
      {
        menuItemId: "m-soda",
        ingredients: [
          { ingredientId: "i-lemon", quantity: 1 },
          { ingredientId: "i-sugar", quantity: 30 }
        ]
      }
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
    const newTenantRecord = {
      id: `t-${Date.now()}`,
      name: businessName,
      tenantId,
      status: "active" as const,
      created: new Date().toISOString().slice(0, 10),
      region: region || "North India / Delhi",
      ownerName,
      email,
      ownerPhone: ownerPhone || "",
      ownerPin: hashedPin
    };
    list.push(newTenantRecord);
    await saveGlobalTenantsList(list);

    await auditLogService.log(
      tenantId,
      "TENANT_INIT",
      "SYSTEM",
      `SaaS Owner registered new tenant "${businessName}" successfully.`
    );

    // Return sanitized tenant object without sensitive credentials
    const { ownerPin: _omitPin, ...publicTenant } = newTenantRecord;

    res.json({
      success: true,
      tenantId,
      tenant: publicTenant,
      message: `Tenant "${businessName}" successfully registered by Super-Admin.`
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
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

    const existingIndex = existingLeads.findIndex((l) => {
      const p1 = l.phone.replace(/[^0-9]/g, "");
      const isSamePhone = cleanPhone && p1 && (p1 === cleanPhone || p1.endsWith(cleanPhone) || cleanPhone.endsWith(p1));
      const isSameEmail = email && l.email && l.email.toLowerCase().trim() === String(email).toLowerCase().trim();
      const isSameRest = l.restaurantName && l.restaurantName.toLowerCase().trim() === String(restaurantName).toLowerCase().trim();
      return isSamePhone || isSameEmail || (isSameRest && l.fullName.toLowerCase().trim() === String(fullName).toLowerCase().trim());
    });

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
      const currentNotifications = (await db.getObject<any[]>("veg-main-001", "system_notifications")) || [];
      const newNotification = {
        id: `notify-lead-${Date.now()}`,
        title: isRescheduled ? "🔄 Walkthrough Re-scheduled" : "🌟 Walkthrough Schedule Confirmed",
        message: `${targetLead.fullName} (${targetLead.restaurantName}) - Slot: ${targetLead.preferredDate} (${targetLead.preferredTime.toUpperCase()}). Address: ${targetLead.address || "N/A"}. Contact: ${targetLead.phone}`,
        timestamp: new Date().toISOString(),
        read: false,
        severity: "info"
      };
      currentNotifications.unshift(newNotification);
      await db.saveObject("veg-main-001", "system_notifications", currentNotifications.slice(0, 50));
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
router.get("/leads/walkthrough", async (req, res) => {
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
router.patch("/leads/walkthrough/:id", async (req, res) => {
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
router.delete("/leads/walkthrough/:id", async (req, res) => {
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
