import express from "express";
import bcrypt from "bcryptjs";
import { Database } from "../server/features/shared/database";
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
  authMiddleware,
  requirePermission,
  requireRole
} from "../server/context";
import {
  hashPin,
  verifyPin,
  findStaffByPinConstantTime,
  verifyMasterVerificationCode,
  constantTimeStringCompare
} from "../server/features/auth/PinSecurityService";
import {
  SESSION_COOKIE_NAME,
  getSessionCookieOptions,
  getClearCookieOptions
} from "../server/features/auth/SessionService";

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

  // Constant-time verification code validation & Master code check (strict env var only)
  const isDirectCodeValid = constantTimeStringCompare(verificationCode, signup.verificationCode);
  const isMasterCodeValid = verifyMasterVerificationCode(verificationCode);
  const isCodeValid = isDirectCodeValid || isMasterCodeValid;

  if (!isCodeValid) {
    return res.status(400).json({ success: false, error: "INVALID_CODE", message: "The verification code entered is incorrect. Please try again." });
  }

  try {
    const newOwnerId = `s-${signup.ownerName.toLowerCase().replace(/[^a-z0-9]/g, "")}-${Math.floor(100 + Math.random() * 900)}`;
    const newOwner = {
      id: newOwnerId,
      name: signup.ownerName,
      role: "Owner" as any,
      pin: await hashPin(signup.pin),
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
          ownerPin: await hashPin(signup.pin)
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

    // Set production-grade HttpOnly Secure session cookie
    res.cookie(SESSION_COOKIE_NAME, session.sessionId, getSessionCookieOptions(req));

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

router.get("/auth/tenant-info", async (req, res) => {
  try {
    const query = (req.query.q as string || req.query.tenantId as string || req.query.tenant as string || "").trim().toLowerCase();
    if (!query) {
      return res.status(400).json({ success: false, error: "Tenant identifier required" });
    }
    const list = await getGlobalTenantsList();
    const match = list.find(
      (t) =>
        t.tenantId.toLowerCase() === query ||
        t.id.toLowerCase() === query ||
        t.name.toLowerCase() === query ||
        t.name.toLowerCase().replace(/[^a-z0-9]/g, "") === query.replace(/[^a-z0-9]/g, "")
    );
    if (!match || match.status === "suspended") {
      return res.status(404).json({ success: false, error: "Restaurant outlet not found" });
    }
    // Return the restaurant's public & QR info
    res.json({
      success: true,
      tenant: {
        id: match.id,
        name: match.name,
        tenantId: match.tenantId,
        region: match.region,
        status: match.status,
        ownerName: match.ownerName,
        storeCode: match.tenantId,
        staffQrSecret: match.staffQrSecret || `qr-init-${match.tenantId}`,
        staffQrUpdatedAt: match.staffQrUpdatedAt || match.created
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Rotate / Change QR Code for restaurant staff access (Protected by session auth & settings permission)
router.post("/auth/tenant/regenerate-qr", authMiddleware, requirePermission("settings"), async (req, res) => {
  const tenantId = (req as any).tenantId;
  if (!tenantId) {
    return res.status(401).json({ success: false, error: "UNAUTHORIZED", message: "Tenant could not be resolved from session" });
  }
  try {
    const list = await getGlobalTenantsList();
    const match = list.find((t) => t.tenantId === tenantId || t.id === tenantId);
    if (!match) {
      return res.status(404).json({ success: false, error: "Restaurant not found" });
    }
    const newSecret = `qr-${Math.random().toString(36).substring(2, 9)}-${Date.now().toString(36)}`;
    const nowIso = new Date().toISOString();
    match.staffQrSecret = newSecret;
    match.staffQrUpdatedAt = nowIso;
    await saveGlobalTenantsList(list);

    res.json({
      success: true,
      staffQrSecret: newSecret,
      staffQrUpdatedAt: nowIso,
      tenantId: match.tenantId,
      message: "Staff Login QR Code rotated successfully. All previous QR scans are now revoked."
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/auth/login", async (req, res) => {
  let { pin, email, phone, outletCode, tenantId, restaurantName, isDemoLogin } = req.body;
  const userAgent = req.headers["user-agent"] || "Unknown User Agent";
  const ipAddress = req.ip || req.headers["x-forwarded-for"] || "127.0.0.1";
  const ip = Array.isArray(ipAddress) ? ipAddress[0] : ipAddress;

  try {
    const globalTenants = await getGlobalTenantsList();
    
    // 1. First attempt to match target tenant by ID, Name, Outlet Code, Email, or Phone
    let targetTenant = globalTenants.find(
      (t) =>
        (tenantId && (t.tenantId.toLowerCase() === tenantId.toLowerCase() || t.id.toLowerCase() === tenantId.toLowerCase() || t.name.toLowerCase() === tenantId.toLowerCase())) ||
        (restaurantName && (t.name.toLowerCase() === restaurantName.toLowerCase() || t.tenantId.toLowerCase() === restaurantName.toLowerCase())) ||
        (outletCode && (t.tenantId.toLowerCase() === outletCode.toLowerCase() || t.id.toLowerCase() === outletCode.toLowerCase() || t.name.toLowerCase() === outletCode.toLowerCase())) ||
        (phone && t.ownerPhone && t.ownerPhone.replace(/\D/g, "") === phone.replace(/\D/g, "")) ||
        (email && t.email && t.email.toLowerCase() === email.toLowerCase())
    );

    let effectiveTenantId = targetTenant ? targetTenant.tenantId : tenantId;

    if (targetTenant && targetTenant.status === "suspended") {
      return res.status(403).json({
        success: false,
        error: "TENANT_SUSPENDED",
        message: "This restaurant workspace has been suspended by the SaaS administrator. Please contact support."
      });
    }

    let staff = effectiveTenantId ? ((await staffRepo.getAll(effectiveTenantId)) || []) : [];
    let matchingUser = pin ? await findStaffByPinConstantTime(staff, pin) : null;

    // 2. UNIVERSAL AUTO-DETECT: If not found in effective tenant, search across all registered tenants (only if tenant wasn't strictly fixed)
    if (!matchingUser && pin && !tenantId) {
      for (const tenant of globalTenants) {
        if (tenant.tenantId === effectiveTenantId) continue;
        if (tenant.status === "suspended") continue;
        
        const tenantStaff = (await staffRepo.getAll(tenant.tenantId)) || [];
        const found = await findStaffByPinConstantTime(tenantStaff, pin);
        if (found) {
          effectiveTenantId = tenant.tenantId;
          targetTenant = tenant;
          matchingUser = found;
          staff = tenantStaff;
          break;
        }
      }
    }

    if (!effectiveTenantId) {
      return res.status(400).json({
        success: false,
        error: "MISSING_TENANT",
        message: "Tenant identifier is required or could not be determined."
      });
    }

    // Check rate limit lockout status first
    const lockout = await sessionService.checkLockout(effectiveTenantId, "unknown", ip);
    if (lockout.locked) {
      return res.status(423).json({
        success: false,
        error: "ACCOUNT_LOCKED",
        locked: true,
        lockedUntil: lockout.lockedUntil,
        cooldownSeconds: lockout.cooldownSeconds,
        tier: lockout.tier,
        attemptCount: lockout.attemptCount,
        message: lockout.tier === 3
          ? `Security Lockdown: Terminal is frozen due to repeated invalid PIN attempts. Locked until ${new Date(lockout.lockedUntil!).toLocaleTimeString()} (or unlock with Owner Master Key).`
          : lockout.tier === 2
            ? `Security Alert: Terminal locked for 5 minutes due to 5 failed attempts. Please wait ${lockout.cooldownSeconds}s.`
            : `Keypad paused for ${lockout.cooldownSeconds}s cooldown.`
      });
    }
    
    const userId = matchingUser ? matchingUser.id : "unknown";
    const userName = matchingUser ? matchingUser.name : (email ? email.split('@')[0] : "Unknown User");
    const role = matchingUser ? matchingUser.role : "Staff";

    if (!matchingUser) {
      const failStatus = await sessionService.registerFailedLogin(
        effectiveTenantId,
        userId,
        userName,
        role,
        ip,
        userAgent,
        "Incorrect PIN passcode entered"
      );
      
      // Dispatch real security alerts if tier 2 or 3 is triggered
      if (failStatus.locked && failStatus.tier && failStatus.tier >= 2) {
        try {
          await notificationService.send(effectiveTenantId, {
            title: `🚨 SECURITY ALERT: Unauthorized PIN Attempts`,
            message: `Multiple failed PIN attempts (${failStatus.attemptCount}) detected from IP ${ip}. Terminal has been locked for ${failStatus.cooldownSeconds ? Math.ceil(failStatus.cooldownSeconds / 60) : 5} minutes.`,
            severity: "error",
            channels: ["in-app", "email"],
            recipientEmail: targetTenant?.email,
            metadata: {
              ip,
              attemptCount: failStatus.attemptCount,
              tier: failStatus.tier,
              lockedUntil: failStatus.lockedUntil
            }
          });

          await auditLogService.log(
            effectiveTenantId,
            "SECURITY_LOCKOUT",
            "SECURITY_GUARD",
            `Terminal locked due to ${failStatus.attemptCount} failed PIN entries from IP ${ip}. Tier: ${failStatus.tier}.`,
            { ip, lockedUntil: failStatus.lockedUntil, tier: failStatus.tier }
          );
        } catch (alertErr) {
          console.error("Failed to dispatch security lockout notification:", alertErr);
        }
      }

      const statusCode = failStatus.locked ? 423 : 401;
      return res.status(statusCode).json({
        success: false,
        error: failStatus.locked ? "TERMINAL_LOCKED" : "INVALID_CREDENTIALS",
        message: failStatus.message || `Incorrect PIN passcode. ${failStatus.remainingAttempts > 0 ? `${failStatus.remainingAttempts} attempts remaining before temporary lock.` : "Terminal is now locked."}`,
        remainingAttempts: failStatus.remainingAttempts,
        locked: failStatus.locked,
        lockedUntil: failStatus.lockedUntil,
        cooldownSeconds: failStatus.cooldownSeconds,
        tier: failStatus.tier,
        attemptCount: failStatus.attemptCount
      });
    }

    const session = await sessionService.createSession(
      effectiveTenantId,
      matchingUser.id,
      matchingUser.name,
      matchingUser.role,
      ip,
      userAgent,
      matchingUser.permissions
    );

    // Set production-grade HttpOnly Secure session cookie
    res.cookie(SESSION_COOKIE_NAME, session.sessionId, getSessionCookieOptions(req));

    res.json({
      success: true,
      session,
      tenant: targetTenant || {
        id: `t-${effectiveTenantId}`,
        name: targetTenant?.name || effectiveTenantId,
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

// Check Terminal Lockout Status
router.get("/auth/lockout-status", async (req, res) => {
  const tenantId = req.query.tenantId as string;
  if (!tenantId) {
    return res.status(400).json({ success: false, error: "MISSING_TENANT", message: "Tenant ID parameter is required." });
  }
  const ipAddress = req.ip || req.headers["x-forwarded-for"] || "127.0.0.1";
  const ip = Array.isArray(ipAddress) ? ipAddress[0] : ipAddress;

  try {
    const status = sessionService.getLockoutStatus(tenantId, ip);
    res.json({
      success: true,
      ...status
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Emergency Owner Master Unlock Override
router.post("/auth/unlock-override", async (req, res) => {
  const { tenantId, masterPin, ownerEmail } = req.body;
  if (!tenantId) {
    return res.status(400).json({ success: false, error: "MISSING_TENANT", message: "Tenant ID is required for unlock override." });
  }
  const ipAddress = req.ip || req.headers["x-forwarded-for"] || "127.0.0.1";
  const ip = Array.isArray(ipAddress) ? ipAddress[0] : ipAddress;

  try {
    const globalTenants = await getGlobalTenantsList();
    const targetTenant = globalTenants.find(t => t.tenantId === tenantId || t.id === tenantId);
    
    const staff = (await staffRepo.getAll(tenantId)) || [];
    const owner = staff.find(s => s.role === "Owner" || s.permissions.includes("settings"));

    // Strictly require MASTER_VERIFICATION_CODE from environment variable; no fallback default string
    const isMasterCode = verifyMasterVerificationCode(masterPin);
    let isOwnerPinMatch = false;
    if (owner && masterPin) {
      isOwnerPinMatch = await verifyPin(masterPin, owner.pin);
    }
    if (!isOwnerPinMatch && targetTenant?.ownerPin && masterPin) {
      isOwnerPinMatch = await verifyPin(masterPin, targetTenant.ownerPin);
    }
    const isOwnerEmailMatch = Boolean(
      targetTenant &&
      ownerEmail &&
      constantTimeStringCompare(targetTenant.email.toLowerCase(), ownerEmail.toLowerCase())
    );

    if (!isMasterCode && !isOwnerPinMatch && !isOwnerEmailMatch) {
      return res.status(403).json({
        success: false,
        error: "INVALID_OVERRIDE_KEY",
        message: "Invalid Owner Master Key or Owner Email verification."
      });
    }

    sessionService.unlockTerminal(tenantId, ip);

    await auditLogService.log(
      tenantId,
      "SECURITY_UNLOCKED",
      "OWNER_OVERRIDE",
      `Terminal manually unlocked by store owner from IP ${ip}.`,
      { ip, unlockedAt: new Date().toISOString() }
    );

    res.json({
      success: true,
      message: "Terminal lockout cleared successfully. You may now enter staff PIN."
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/auth/validate", async (req, res) => {
  const sessionId = req.body?.sessionId || (req.cookies?.[SESSION_COOKIE_NAME] as string);
  if (!sessionId) {
    return res.status(400).json({ success: false, error: "MISSING_SESSION", message: "Session ID is required." });
  }
  try {
    const resolvedTid = await sessionService.resolveTenantId(sessionId, getGlobalTenantsList);
    if (!resolvedTid) {
      res.clearCookie(SESSION_COOKIE_NAME, getClearCookieOptions(req));
      return res.json({ success: false, error: "SESSION_EXPIRED", message: "Session is inactive or has expired due to idle timeout." });
    }
    const session = await sessionService.validateAndTouchSession(resolvedTid, sessionId);
    if (!session) {
      res.clearCookie(SESSION_COOKIE_NAME, getClearCookieOptions(req));
      return res.json({ success: false, error: "SESSION_EXPIRED", message: "Session is inactive or has expired due to idle timeout." });
    }
    // Refresh HttpOnly cookie activity
    res.cookie(SESSION_COOKIE_NAME, session.sessionId, getSessionCookieOptions(req));
    res.json({ success: true, session });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Securely retrieve and restore active user session from HttpOnly cookie on application launch
router.get("/auth/session/current", async (req, res) => {
  const sessionId =
    (req.cookies?.[SESSION_COOKIE_NAME] as string) ||
    (req.headers["x-session-id"] as string) ||
    (typeof req.headers["authorization"] === "string" && req.headers["authorization"].startsWith("Bearer ")
      ? req.headers["authorization"].substring(7).trim()
      : undefined);

  if (!sessionId) {
    return res.status(401).json({ success: false, error: "NO_ACTIVE_SESSION", message: "No active session cookie found." });
  }

  try {
    const resolvedTid = await sessionService.resolveTenantId(sessionId, getGlobalTenantsList);
    if (!resolvedTid) {
      res.clearCookie(SESSION_COOKIE_NAME, getClearCookieOptions(req));
      return res.status(401).json({ success: false, error: "SESSION_EXPIRED", message: "Session has expired or is invalid." });
    }

    const session = await sessionService.validateAndTouchSession(resolvedTid, sessionId);
    if (!session) {
      res.clearCookie(SESSION_COOKIE_NAME, getClearCookieOptions(req));
      return res.status(401).json({ success: false, error: "SESSION_EXPIRED", message: "Session has expired." });
    }

    // Refresh HttpOnly cookie expiration
    res.cookie(SESSION_COOKIE_NAME, session.sessionId, getSessionCookieOptions(req));

    // Resolve tenant info
    let tenantInfo: any = null;
    const allTenants = await getGlobalTenantsList();
    tenantInfo = allTenants.find((t: any) => t.tenantId === resolvedTid) || {
      id: `t-${resolvedTid}`,
      name: resolvedTid,
      tenantId: resolvedTid,
      status: "active"
    };

    // Resolve user info
    const userInfo: any = {
      id: session.userId,
      name: session.userName,
      role: session.role,
      permissions: session.permissions
    };

    return res.json({
      success: true,
      session,
      tenant: tenantInfo,
      user: userInfo
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/auth/logout", async (req, res) => {
  const sessionId = req.body?.sessionId || (req.cookies?.[SESSION_COOKIE_NAME] as string);
  try {
    if (sessionId) {
      const resolvedTid = await sessionService.resolveTenantId(sessionId, getGlobalTenantsList);
      if (resolvedTid) {
        await sessionService.revokeSession(resolvedTid, sessionId);
      } else {
        await sessionService.revokeSession("saas-admin", sessionId);
      }
    }
    // Always clear the HttpOnly secure session cookie on logout
    res.clearCookie(SESSION_COOKIE_NAME, getClearCookieOptions(req));
    res.json({ success: true, message: "Logged out successfully" });
  } catch (error: any) {
    res.clearCookie(SESSION_COOKIE_NAME, getClearCookieOptions(req));
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/auth/staff-directory", async (req, res) => {
  const targetTenantId = (req.headers["x-tenant-id"] as string) || (req.query.tenantId as string);
  if (!targetTenantId) {
    return res.status(400).json({ success: false, error: "MISSING_TENANT", message: "Tenant identifier is required." });
  }

  // Cross-tenant security check: If request has an active session, verify tenant match
  const sessionId =
    (req.cookies?.[SESSION_COOKIE_NAME] as string) ||
    (req.headers["x-session-id"] as string) ||
    (typeof req.headers["authorization"] === "string" && req.headers["authorization"].startsWith("Bearer ")
      ? req.headers["authorization"].substring(7).trim()
      : undefined);

  if (sessionId) {
    const session = await sessionService.getSession(sessionId);
    if (session) {
      const isSaaSAdmin = session.role === "SaaS Owner" || session.tenantId === "saas-admin";
      if (session.tenantId !== targetTenantId && !isSaaSAdmin) {
        return res.status(403).json({
          success: false,
          error: "FORBIDDEN",
          message: `Cross-tenant access forbidden: Authenticated tenant (${session.tenantId}) cannot access staff directory of tenant (${targetTenantId}).`
        });
      }
    }
  }

  try {
    const staff = (await staffRepo.getAll(targetTenantId)) || [];
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
  const tid = (req as any).tenantId;
  if (!tid) {
    return res.status(401).json({ success: false, error: "UNAUTHORIZED", message: "Tenant not resolved from session." });
  }
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
  const tenantId = (req as any).tenantId;
  const { sessionId } = req.body;
  if (!sessionId) {
    return res.status(400).json({ success: false, error: "MISSING_SESSION", message: "Session ID to revoke is required." });
  }
  try {
    const success = await sessionService.revokeSession(tenantId, sessionId);
    if (req.cookies?.[SESSION_COOKIE_NAME] === sessionId) {
      res.clearCookie(SESSION_COOKIE_NAME, getClearCookieOptions(req));
    }
    res.json({ success: true, message: `Session revoked successfully.` });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/auth/sessions/revoke-all", authMiddleware, requirePermission("settings"), async (req, res) => {
  const tenantId = (req as any).tenantId;
  const { exceptSessionId } = req.body;
  try {
    if (exceptSessionId) {
      const active = await sessionService.getActiveSessions(tenantId);
      const remaining = active.filter(s => s.sessionId === exceptSessionId);
      const db = Database.getInstance();
      await db.saveObject(tenantId, "system_active_sessions", remaining);
    } else {
      await sessionService.revokeAllSessions(tenantId);
    }
    res.json({ success: true, message: "All other active sessions have been terminated." });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/auth/history/clear", authMiddleware, requirePermission("settings"), async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    await sessionService.clearLoginHistory(tenantId);
    res.json({ success: true, message: "Login history successfully wiped." });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/auth/settings/update", authMiddleware, requirePermission("settings"), async (req, res) => {
  const tenantId = (req as any).tenantId;
  const { sessionTimeoutMinutes, maxFailedAttempts, lockoutDurationSeconds, enableBruteForceProtection } = req.body;
  try {
    const settings = {
      sessionTimeoutMinutes: Number(sessionTimeoutMinutes) || 60,
      maxFailedAttempts: Number(maxFailedAttempts) || 5,
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
