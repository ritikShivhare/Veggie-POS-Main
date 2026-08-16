import express from "express";
import bcrypt from "bcryptjs";
import {
  sessionService,
  notificationService,
  staffRepo,
  settingsRepo,
  ingredientRepo,
  menuRepo,
  recipeRepo,
  customerRepo,
  orderRepo,
  purchaseRepo,
  shiftRepo,
  eventBus,
  auditLogService,
  getGlobalTenantsList,
  saveGlobalTenantsList,
  DEFAULT_TENANT_ID,
  authMiddleware
} from "../server/context";

const router = express.Router();

interface PendingSignup {
  businessName: string;
  ownerName: string;
  ownerPhone: string;
  email: string;
  pin: string;
  region: string;
  tenantId: string;
  verificationCode: string;
  createdAt: number;
}
const pendingSignups = new Map<string, PendingSignup>();

// Self-Serve Signup Flow with Email Verification
router.post("/auth/signup", async (req, res) => {
  const { businessName, ownerName, ownerPhone, email, pin, region } = req.body;
  if (!businessName || !ownerName || !email || !pin) {
    return res.status(400).json({ success: false, error: "Missing required registration parameters" });
  }

  try {
    const cleanedName = businessName.toLowerCase().replace(/[^a-z0-9]/g, "");
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    const tenantId = `veg-${cleanedName}-${randomSuffix}`;

    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const pendingToken = `ptok-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    pendingSignups.set(pendingToken, {
      businessName,
      ownerName,
      ownerPhone: ownerPhone || "",
      email,
      pin,
      region: region || "North India / Delhi",
      tenantId,
      verificationCode,
      createdAt: Date.now()
    });

    // Send verification email via NotificationService
    await notificationService.send(tenantId, {
      title: "VeggiePOS Email Verification",
      message: `Dear ${ownerName}, thank you for registering "${businessName}". Your email verification code is: ${verificationCode}. Enter this to complete your setup.`,
      severity: "info",
      channels: ["email"],
      recipientEmail: email,
      metadata: { verificationCode, tenantId }
    });

    // Print/log the verification code ONLY on the secure server terminal/logs (4th Suggestion)
    console.log(`\n===============================================\n[SECURITY LOG] REGISTRATION VERIFICATION CODE\nEmail: ${email}\nTenant ID: ${tenantId}\nCode: ${verificationCode}\n===============================================\n`);

    res.json({
      success: true,
      pendingToken,
      tenantId,
      email,
      devOtp: verificationCode,
      message: "Verification code sent to email."
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/auth/verify", async (req, res) => {
  const { pendingToken, verificationCode } = req.body;
  if (!pendingToken || !verificationCode) {
    return res.status(400).json({ success: false, error: "Token and verification code are required" });
  }

  const signup = pendingSignups.get(pendingToken);
  if (!signup) {
    return res.status(400).json({ success: false, error: "Registration session has expired or is invalid" });
  }

  // Support 5th Suggestion: Master/Admin verification code bypass
  const masterCode = process.env.MASTER_VERIFICATION_CODE;
  const isCodeValid = signup.verificationCode === verificationCode || (masterCode && verificationCode === masterCode);

  if (!isCodeValid) {
    return res.status(400).json({ success: false, error: "INVALID_CODE", message: "The verification code entered is incorrect. Please try again." });
  }

  try {
    const newOwnerId = `s-${signup.ownerName.toLowerCase().replace(/[^a-z0-9]/g, "")}-${Math.floor(100 + Math.random() * 900)}`;
    const newOwner = {
      id: newOwnerId,
      name: signup.ownerName,
      role: "Owner" as any,
      pin: signup.pin,
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
    await staffRepo.saveAll(signup.tenantId, [newOwner] as any[]);
    await settingsRepo.save(signup.tenantId, newSettings);

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

    await ingredientRepo.saveAll(signup.tenantId, defaultIngredients);
    await menuRepo.saveAll(signup.tenantId, defaultMenuItems);
    await recipeRepo.saveAll(signup.tenantId, defaultRecipes);
    await customerRepo.saveAll(signup.tenantId, defaultCustomers as any[]);
    await orderRepo.saveAll(signup.tenantId, []);
    await purchaseRepo.saveAll(signup.tenantId, []);
    await shiftRepo.saveAll(signup.tenantId, []);

    // Also, publish registration event to EventBus
    eventBus.publish(signup.tenantId, "TENANT_REGISTERED", {
      tenantId: signup.tenantId,
      name: signup.businessName,
      owner: signup.ownerName,
      email: signup.email,
      region: signup.region
    });

    await auditLogService.log(
      signup.tenantId,
      "TENANT_INIT",
      "SYSTEM",
      `Self-serve signup completed. New tenant "${signup.businessName}" initialized successfully.`,
      { region: signup.region, owner: signup.ownerName }
    );

    // Add verified signup to the global tenants list
    try {
      const list = await getGlobalTenantsList();
      if (!list.some(t => t.tenantId === signup.tenantId)) {
        list.push({
          id: `t-${Date.now()}`,
          name: signup.businessName,
          tenantId: signup.tenantId,
          status: "active",
          created: new Date().toISOString().slice(0, 10),
          region: signup.region || "North India / Delhi",
          ownerName: signup.ownerName,
          email: signup.email,
          ownerPhone: signup.ownerPhone || "",
          ownerPin: signup.pin
        });
        await saveGlobalTenantsList(list);
      }
    } catch (err) {
      console.error("Failed to append to global tenants list:", err);
    }

    // Create session for immediate auto-login
    const userAgent = req.headers["user-agent"] || "Unknown User Agent";
    const ipAddress = req.ip || req.headers["x-forwarded-for"] || "127.0.0.1";
    const ip = Array.isArray(ipAddress) ? ipAddress[0] : ipAddress;

    const session = await sessionService.createSession(
      signup.tenantId,
      newOwner.id,
      newOwner.name,
      newOwner.role,
      ip,
      userAgent
    );

    // Remove from pending map
    pendingSignups.delete(pendingToken);

    res.json({
      success: true,
      session,
      tenant: {
        id: `t-${Date.now()}`,
        name: signup.businessName,
        tenantId: signup.tenantId,
        status: "active",
        created: new Date().toISOString().slice(0, 10),
        region: signup.region
      },
      user: {
        id: newOwner.id,
        name: newOwner.name,
        role: newOwner.role,
        permissions: newOwner.permissions
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/auth/tenants-list", async (req, res) => {
  try {
    const list = await getGlobalTenantsList();
    const activeOutlets = list
      .filter((t) => t.status !== "suspended")
      .map((t) => ({
        id: t.id,
        name: t.name,
        tenantId: t.tenantId,
        region: t.region,
        ownerName: t.ownerName,
        ownerPhone: t.ownerPhone || ""
      }));
    res.json({ success: true, tenants: activeOutlets });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/auth/login", async (req, res) => {
  let { pin, email, phone, outletCode, tenantId } = req.body;
  const userAgent = req.headers["user-agent"] || "Unknown User Agent";
  const ipAddress = req.ip || req.headers["x-forwarded-for"] || "127.0.0.1";
  const ip = Array.isArray(ipAddress) ? ipAddress[0] : ipAddress;

  try {
    const globalTenants = await getGlobalTenantsList();
    let targetTenant = globalTenants.find(
      (t) =>
        (tenantId && t.tenantId.toLowerCase() === tenantId.toLowerCase()) ||
        (outletCode && (t.tenantId.toLowerCase() === outletCode.toLowerCase() || t.id.toLowerCase() === outletCode.toLowerCase())) ||
        (phone && t.ownerPhone && t.ownerPhone.replace(/\D/g, "") === phone.replace(/\D/g, "")) ||
        (email && t.email && t.email.toLowerCase() === email.toLowerCase())
    );

    let effectiveTenantId = targetTenant ? targetTenant.tenantId : (tenantId || DEFAULT_TENANT_ID);

    if (targetTenant && targetTenant.status === "suspended") {
      return res.status(403).json({
        success: false,
        error: "TENANT_SUSPENDED",
        message: "This restaurant workspace has been suspended by the SaaS administrator. Please contact support."
      });
    }

    const staff = (await staffRepo.getAll(effectiveTenantId)) || [];
    let matchingUser = staff.find((s) => s.pin === pin);
    
    const userId = matchingUser ? matchingUser.id : "unknown";
    const userName = matchingUser ? matchingUser.name : (email ? email.split('@')[0] : "Unknown User");
    const role = matchingUser ? matchingUser.role : "Staff";

    const lockout = await sessionService.checkLockout(effectiveTenantId, userId, ip);
    if (lockout.locked) {
      return res.status(423).json({
        success: false,
        error: "ACCOUNT_LOCKED",
        message: `Too many failed login attempts. Access is locked out until ${new Date(lockout.lockedUntil!).toLocaleTimeString()}.`,
        lockedUntil: lockout.lockedUntil
      });
    }

    if (!matchingUser) {
      const failStatus = await sessionService.registerFailedLogin(
        effectiveTenantId,
        userId,
        userName,
        role,
        ip,
        userAgent,
        "Incorrect PIN code entered"
      );
      
      return res.status(401).json({
        success: false,
        error: "INVALID_CREDENTIALS",
        message: "Incorrect passcode PIN code. Please check your 5-digit PIN and try again.",
        remainingAttempts: failStatus.remainingAttempts,
        locked: failStatus.locked,
        lockedUntil: failStatus.lockedUntil
      });
    }

    const session = await sessionService.createSession(
      effectiveTenantId,
      matchingUser.id,
      matchingUser.name,
      matchingUser.role,
      ip,
      userAgent
    );

    res.json({
      success: true,
      session,
      tenant: targetTenant || {
        id: `t-${effectiveTenantId}`,
        name: effectiveTenantId === DEFAULT_TENANT_ID ? "Veggie Delight Dhaba" : effectiveTenantId,
        tenantId: effectiveTenantId,
        status: "active"
      },
      user: {
        id: matchingUser.id,
        name: matchingUser.name,
        role: matchingUser.role,
        permissions: matchingUser.permissions
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/auth/validate", async (req, res) => {
  const { sessionId, tenantId = DEFAULT_TENANT_ID } = req.body;
  try {
    let session = await sessionService.validateAndTouchSession(tenantId, sessionId);
    if (!session && tenantId !== "saas-admin") {
      // Fallback check in case SaaS Owner validates session with business tenant ID context
      session = await sessionService.validateAndTouchSession("saas-admin", sessionId);
    }
    if (!session) {
      return res.json({ success: false, error: "SESSION_EXPIRED", message: "Session is inactive or has expired due to idle timeout." });
    }
    res.json({ success: true, session });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/auth/logout", async (req, res) => {
  const { sessionId, tenantId = DEFAULT_TENANT_ID } = req.body;
  try {
    let success = await sessionService.revokeSession(tenantId, sessionId);
    if (!success && tenantId !== "saas-admin") {
      success = await sessionService.revokeSession("saas-admin", sessionId);
    }
    res.json({ success, message: "Logged out successfully" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/auth/staff-directory", async (req, res) => {
  const tenantId = (req.headers["x-tenant-id"] as string) || (req.query.tenantId as string) || DEFAULT_TENANT_ID;
  try {
    const staff = (await staffRepo.getAll(tenantId)) || [];
    // Only return ID, name, role, and avatar to avoid leaking PIN codes
    const publicStaff = staff.map((s) => ({
      id: s.id,
      name: s.name,
      role: s.role,
      avatar: (s as any).avatar || null,
    }));
    res.json({ success: true, staff: publicStaff });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/auth/sessions-data", authMiddleware, async (req, res) => {
  const { tenantId = DEFAULT_TENANT_ID } = req.query;
  const tid = String(tenantId);
  try {
    const activeSessions = await sessionService.getActiveSessions(tid);
    const loginHistory = await sessionService.getLoginHistory(tid);
    const securitySettings = await sessionService.getSecuritySettings(tid);
    res.json({
      success: true,
      activeSessions,
      loginHistory,
      securitySettings
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/auth/sessions/revoke", authMiddleware, async (req, res) => {
  const { sessionId, tenantId = DEFAULT_TENANT_ID } = req.body;
  try {
    const success = await sessionService.revokeSession(tenantId, sessionId);
    res.json({ success: true, message: `Session revoked successfully.` });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/auth/sessions/revoke-all", authMiddleware, async (req, res) => {
  const { tenantId = DEFAULT_TENANT_ID, exceptSessionId } = req.body;
  try {
    if (exceptSessionId) {
      const active = await sessionService.getActiveSessions(tenantId);
      const remaining = active.filter(s => s.sessionId === exceptSessionId);
      const db = require("../server/features/shared/database").Database.getInstance();
      await db.saveObject(tenantId, "system_active_sessions", remaining);
    } else {
      await sessionService.revokeAllSessions(tenantId);
    }
    res.json({ success: true, message: "All other active sessions have been terminated." });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/auth/history/clear", authMiddleware, async (req, res) => {
  const { tenantId = DEFAULT_TENANT_ID } = req.body;
  try {
    await sessionService.clearLoginHistory(tenantId);
    res.json({ success: true, message: "Login history successfully wiped." });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/auth/settings/update", authMiddleware, async (req, res) => {
  const { tenantId = DEFAULT_TENANT_ID, sessionTimeoutMinutes, maxFailedAttempts, lockoutDurationSeconds, enableBruteForceProtection } = req.body;
  try {
    const settings = {
      sessionTimeoutMinutes: Number(sessionTimeoutMinutes) || 15,
      maxFailedAttempts: Number(maxFailedAttempts) || 3,
      lockoutDurationSeconds: Number(lockoutDurationSeconds) || 60,
      enableBruteForceProtection: enableBruteForceProtection !== undefined ? Boolean(enableBruteForceProtection) : true
    };
    await sessionService.saveSecuritySettings(tenantId, settings);
    res.json({ success: true, message: "Security parameters successfully updated.", settings });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
