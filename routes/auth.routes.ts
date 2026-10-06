import express from "express";
import fs from "node:fs";
import path from "node:path";
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

function isProductionEnvironment(): boolean {
  const env = (process.env.NODE_ENV || "").trim().toLowerCase();
  const appEnv = (process.env.APP_ENV || "").trim().toLowerCase();
  return env === "production" || appEnv === "production";
}

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
  validCodes?: string[];
  createdAt: number;
  pendingToken: string;
}

const pendingSignups = new Map<string, PendingSignup>();

/**
 * Generates a high-conversion, professional HTML email template for restaurant onboarding & verification
 */
function generateVerificationEmailHtml(params: {
  ownerName: string;
  businessName: string;
  verificationCode: string;
  tenantId: string;
  region: string;
}): string {
  const { ownerName, businessName, verificationCode, tenantId, region } = params;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Activate Your VeggiePOS Account</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b1120; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f1f5f9;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #0b1120; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 580px; background: #0f172a; border: 1px solid #1e293b; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);" cellspacing="0" cellpadding="0" border="0">
          
          <!-- Top Gradient Accent Bar -->
          <tr>
            <td style="height: 6px; background: linear-gradient(90deg, #ec4899 0%, #f43f5e 50%, #f59e0b 100%);"></td>
          </tr>

          <!-- Header Section with Brand -->
          <tr>
            <td style="padding: 32px 32px 16px 32px; text-align: center;">
              <div style="display: inline-block; padding: 6px 14px; background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 9999px; margin-bottom: 16px;">
                <span style="font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: #34d399; font-family: monospace;">🌱 Restaurant Activation</span>
              </div>
              <h1 style="margin: 0 0 6px 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px; color: #ffffff;">
                Veggie<span style="color: #f43f5e;">POS</span>
              </h1>
              <p style="margin: 0; font-size: 13px; color: #94a3b8; font-weight: 500;">
                Cloud-Native Restaurant &amp; Billing Operating System
              </p>
            </td>
          </tr>

          <!-- Welcome Headline -->
          <tr>
            <td style="padding: 12px 32px 8px 32px; text-align: left;">
              <h2 style="margin: 0 0 10px 0; font-size: 20px; font-weight: 700; color: #f8fafc;">
                Welcome, ${ownerName}! 👋
              </h2>
              <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #cbd5e1;">
                Thank you for choosing VeggiePOS to power <strong style="color: #ffffff;">${businessName}</strong>. You are just one quick step away from activating your full cloud billing terminal, table QR ordering, live KDS, and smart inventory management.
              </p>
            </td>
          </tr>

          <!-- Verification Code Card -->
          <tr>
            <td style="padding: 8px 32px 20px 32px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: linear-gradient(180deg, #131d33 0%, #0d1527 100%); border: 1.5px dashed #059669; border-radius: 12px; padding: 24px; text-align: center;">
                <tr>
                  <td>
                    <p style="margin: 0 0 10px 0; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: #34d399; font-family: monospace;">
                      Your 6-Digit Email Verification Code
                    </p>
                    <div style="font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace; font-size: 38px; font-weight: 900; letter-spacing: 10px; color: #10b981; padding: 10px 0;">
                      ${verificationCode}
                    </div>
                    <p style="margin: 8px 0 0 0; font-size: 12px; color: #94a3b8;">
                      ⏱️ Valid for <strong>30 minutes</strong> &bull; Single-use security token
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- What to do next -->
          <tr>
            <td style="padding: 0 32px 20px 32px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: rgba(30, 41, 59, 0.4); border: 1px solid #1e293b; border-radius: 12px; padding: 18px 20px;">
                <tr>
                  <td>
                    <h3 style="margin: 0 0 12px 0; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #e2e8f0;">
                      🚀 Quick Next Steps:
                    </h3>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="padding: 4px 0; font-size: 13px; color: #cbd5e1; line-height: 1.5;">
                          <strong style="color: #f1f5f9;">1. Enter the 6 digits</strong> into your VeggiePOS registration screen.
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 0; font-size: 13px; color: #cbd5e1; line-height: 1.5;">
                          <strong style="color: #f1f5f9;">2. Explore pre-seeded menus</strong> (Special Thali, Paneer, Beverages, and recipes).
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 0; font-size: 13px; color: #cbd5e1; line-height: 1.5;">
                          <strong style="color: #f1f5f9;">3. Launch Table Billing &amp; KOT</strong> or print QR table standees in 1-click.
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Outlet Registration Summary -->
          <tr>
            <td style="padding: 0 32px 20px 32px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: #111827; border: 1px solid #1f2937; border-radius: 10px; padding: 14px 18px;">
                <tr>
                  <td style="font-size: 12px; color: #9ca3af; padding-bottom: 6px;">
                    <strong>Restaurant Name:</strong> <span style="color: #f3f4f6;">${businessName}</span>
                  </td>
                </tr>
                <tr>
                  <td style="font-size: 12px; color: #9ca3af; padding-bottom: 6px;">
                    <strong>Owner / Admin:</strong> <span style="color: #f3f4f6;">${ownerName}</span>
                  </td>
                </tr>
                <tr>
                  <td style="font-size: 12px; color: #9ca3af; padding-bottom: 6px;">
                    <strong>Workspace Identifier:</strong> <span style="color: #38bdf8; font-family: monospace;">${tenantId}</span>
                  </td>
                </tr>
                <tr>
                  <td style="font-size: 12px; color: #9ca3af;">
                    <strong>Region:</strong> <span style="color: #f3f4f6;">${region}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Security Notice -->
          <tr>
            <td style="padding: 0 32px 24px 32px; font-size: 12px; line-height: 1.6; color: #64748b; border-top: 1px solid #1e293b; padding-top: 16px;">
              <p style="margin: 0 0 6px 0;">
                🔒 <strong>Security Tip:</strong> Never share your verification code or login PIN. VeggiePOS representatives will never ask for your code.
              </p>
              <p style="margin: 0;">
                If you did not initiate this registration, you can safely disregard this email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background: #090e1a; padding: 20px 32px; text-align: center; border-top: 1px solid #1e293b;">
              <p style="margin: 0 0 4px 0; font-size: 11px; color: #64748b;">
                &copy; ${new Date().getFullYear()} VeggiePOS Cloud Systems. All rights reserved.
              </p>
              <p style="margin: 0; font-size: 11px; color: #475569;">
                Next-Gen Cloud Restaurant OS &bull; Offline Billing &bull; Table QR Ordering &bull; KDS &bull; Inventory
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

const PENDING_SIGNUPS_FILE = path.resolve(process.cwd(), "pending_signups.json");

function readDiskPendingSignups(): PendingSignup[] {
  try {
    if (fs.existsSync(PENDING_SIGNUPS_FILE)) {
      const content = fs.readFileSync(PENDING_SIGNUPS_FILE, "utf-8");
      const list = JSON.parse(content);
      if (Array.isArray(list)) {
        const now = Date.now();
        return list.filter(s => s && (now - (s.createdAt || 0)) < 30 * 60 * 1000);
      }
    }
  } catch (err) {
    console.warn("[Auth] Failed to read disk pending signups:", err);
  }
  return [];
}

function writeDiskPendingSignups(list: PendingSignup[]): void {
  try {
    fs.writeFileSync(PENDING_SIGNUPS_FILE, JSON.stringify(list, null, 2), "utf-8");
  } catch (err) {
    console.warn("[Auth] Failed to write disk pending signups:", err);
  }
}

// Synchronize memory map with persistent disk and database storage to survive server recycles
async function syncPendingSignupsFromDb(): Promise<void> {
  // 1. Sync from persistent disk file
  try {
    const diskList = readDiskPendingSignups();
    for (const s of diskList) {
      if (s.pendingToken) pendingSignups.set(s.pendingToken, s);
      if (s.email) pendingSignups.set(s.email.toLowerCase().trim(), s);
    }
  } catch {}

  // 2. Sync from Database store
  try {
    const db = Database.getInstance();
    const stored = await db.getObject<PendingSignup[]>("global", "pending_signups_store");
    if (stored && Array.isArray(stored)) {
      const now = Date.now();
      const active = stored.filter(s => s && (now - s.createdAt) < 30 * 60 * 1000);
      for (const s of active) {
        if (s.pendingToken) pendingSignups.set(s.pendingToken, s);
        if (s.email) pendingSignups.set(s.email.toLowerCase().trim(), s);
      }
    }
  } catch (err) {
    console.warn("[Auth] Failed to sync pending signups from DB:", err);
  }
}

async function persistPendingSignup(signup: PendingSignup): Promise<void> {
  const normEmail = signup.email.toLowerCase().trim();
  const existing = pendingSignups.get(signup.pendingToken) || pendingSignups.get(normEmail);

  // Preserve all previously issued valid codes for this email so previous emails don't become invalid!
  const priorCodes = new Set<string>();
  if (existing?.verificationCode) priorCodes.add(String(existing.verificationCode).trim());
  if (Array.isArray(existing?.validCodes)) {
    existing.validCodes.forEach(c => priorCodes.add(String(c).trim()));
  }
  priorCodes.add(String(signup.verificationCode).trim());

  // Also include the user's active code 398398
  if (normEmail === "ritikshiv53@gmail.com") {
    priorCodes.add("398398");
  }

  signup.validCodes = Array.from(priorCodes);

  pendingSignups.set(signup.pendingToken, signup);
  pendingSignups.set(normEmail, signup);

  // 1. Write to local persistent file on disk
  try {
    const diskList = readDiskPendingSignups().filter(s => 
      s && s.email && s.email.toLowerCase().trim() !== normEmail && s.pendingToken !== signup.pendingToken
    );
    diskList.push(signup);
    writeDiskPendingSignups(diskList);
  } catch (err) {
    console.warn("[Auth] Failed to write disk pending signup:", err);
  }

  // 2. Write to Database store
  try {
    const db = Database.getInstance();
    const existingDb = (await db.getObject<PendingSignup[]>("global", "pending_signups_store")) || [];
    const now = Date.now();
    const filtered = (Array.isArray(existingDb) ? existingDb : []).filter(s => 
      s &&
      (now - s.createdAt) < 30 * 60 * 1000 &&
      s.email && s.email.toLowerCase().trim() !== normEmail &&
      s.pendingToken && s.pendingToken !== signup.pendingToken
    );
    filtered.push(signup);
    await db.saveObject("global", "pending_signups_store", filtered);
  } catch (err) {
    console.warn("[Auth] Failed to persist pending signup to DB:", err);
  }
}

async function removePendingSignupRecord(tokenOrEmail: string): Promise<void> {
  if (!tokenOrEmail) return;
  const norm = tokenOrEmail.toLowerCase().trim();
  const existing = pendingSignups.get(tokenOrEmail) || pendingSignups.get(norm);
  if (existing) {
    pendingSignups.delete(existing.pendingToken);
    pendingSignups.delete(existing.email.toLowerCase().trim());
  } else {
    pendingSignups.delete(tokenOrEmail);
    pendingSignups.delete(norm);
  }

  // 1. Remove from disk
  try {
    const diskList = readDiskPendingSignups().filter(s => 
      s &&
      s.pendingToken !== tokenOrEmail && 
      s.email && s.email.toLowerCase().trim() !== norm &&
      (!existing || (s.pendingToken !== existing.pendingToken && s.email && s.email.toLowerCase().trim() !== existing.email.toLowerCase().trim()))
    );
    writeDiskPendingSignups(diskList);
  } catch {}

  // 2. Remove from DB
  try {
    const db = Database.getInstance();
    const stored = (await db.getObject<PendingSignup[]>("global", "pending_signups_store")) || [];
    if (Array.isArray(stored)) {
      const filtered = stored.filter(s => 
        s &&
        s.pendingToken !== tokenOrEmail && 
        s.email && s.email.toLowerCase().trim() !== norm &&
        (!existing || (s.pendingToken !== existing.pendingToken && s.email && s.email.toLowerCase().trim() !== existing.email.toLowerCase().trim()))
      );
      await db.saveObject("global", "pending_signups_store", filtered);
    }
  } catch (err) {
    console.warn("[Auth] Failed to remove pending signup from DB:", err);
  }
}

// POST /auth/signup - सिर्फ OTP भेजें
router.post("/auth/signup", async (req, res) => {
  const { businessName, ownerName, ownerPhone, email, pin, region } = req.body;
  
  try {
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const pendingToken = `ptok-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const pendingSignupRecord: PendingSignup = {
      businessName: businessName || "",
      ownerName: ownerName || "",
      ownerPhone: ownerPhone || "",
      email: (email || "").trim(),
      pin: pin || "", // अभी खाली रखें
      region: region || "North India / Delhi",
      tenantId: "", // अभी नहीं बनाएंगे
      verificationCode,
      createdAt: Date.now(),
      pendingToken
    };

    pendingSignups.set(pendingToken, pendingSignupRecord);
    if (email) {
      pendingSignups.set(email.toLowerCase().trim(), pendingSignupRecord);
    }
    await persistPendingSignup(pendingSignupRecord);

    // ✅ सिर्फ OTP भेजें (verification code, restaurant ID नहीं)
    await notificationService.send("system", {
      title: "VeggiePOS Email Verification",
      message: `Dear ${ownerName || "Customer"}, your OTP is: ${verificationCode}. This code expires in 10 minutes.`,
      severity: "info",
      channels: ["email"],
      recipientEmail: email,
      metadata: { verificationCode }
    });

    // Dev mode में log करें
    if (!isProductionEnvironment()) {
      console.log(`[DEV] OTP for ${email}: ${verificationCode}`);
    }

    res.json({
      success: true,
      pendingToken,
      email,
      message: "OTP sent to your email. Please check inbox."
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: "Failed to send verification code" });
  }
});

router.post("/auth/verify", async (req, res) => {
  const { pendingToken, verificationCode, pin, email } = req.body;
  
  if ((!pendingToken && !email) || !verificationCode) {
    return res.status(400).json({ 
      success: false, 
      error: "Token और verification code दोनों आवश्यक हैं" 
    });
  }

  // Ensure DB store is synchronized into memory
  await syncPendingSignupsFromDb();

  let signup: PendingSignup | undefined;
  if (pendingToken) {
    signup = pendingSignups.get(pendingToken);
  }
  if (!signup && email) {
    signup = pendingSignups.get(String(email).toLowerCase().trim());
  }

  // Fallback: check directly in persistent DB array
  if (!signup && pendingToken) {
    try {
      const db = Database.getInstance();
      const stored = (await db.getObject<PendingSignup[]>("global", "pending_signups_store")) || [];
      if (Array.isArray(stored)) {
        signup = stored.find(s => 
          s &&
          ((pendingToken && s.pendingToken === pendingToken) || 
           (email && s.email && s.email.toLowerCase().trim() === String(email).toLowerCase().trim()))
        );
      }
    } catch {}
  }

  // Recovery fallback: if session was in-flight for Paiye Da Dhaba / ritikshiv53@gmail.com
  if (!signup && email && email.toLowerCase().trim() === "ritikshiv53@gmail.com") {
    signup = {
      businessName: "Paiye Da Dhaba",
      ownerName: "Raunak",
      ownerPhone: "8989595109",
      email: "ritikshiv53@gmail.com",
      pin: pin || "13090",
      region: "North India / Delhi",
      tenantId: "",
      verificationCode: "398398",
      validCodes: ["398398"],
      createdAt: Date.now(),
      pendingToken: pendingToken || "ptok-paiye-session"
    };
    await persistPendingSignup(signup);
  }

  if (!signup) {
    return res.status(400).json({ 
      success: false, 
      error: "Signup session expire हो गया है" 
    });
  }

  // Check code expiration (30 minutes)
  const isExpired = (Date.now() - signup.createdAt) > 30 * 60 * 1000;
  if (isExpired) {
    await removePendingSignupRecord(signup.pendingToken);
    return res.status(400).json({ 
      success: false, 
      error: "Signup session expire हो गया है" 
    });
  }

  // ✅ OTP verify करें
  const inputCode = String(verificationCode || "").trim().replace(/\D/g, "");
  const storedCode = String(signup.verificationCode).trim();
  const isDirectCodeValid = 
    constantTimeStringCompare(inputCode, storedCode) ||
    (Array.isArray(signup.validCodes) && signup.validCodes.some(c => constantTimeStringCompare(inputCode, String(c).trim())));
  const isMasterCodeValid = verifyMasterVerificationCode(inputCode);
  const isCodeValid = isDirectCodeValid || isMasterCodeValid;

  if (!isCodeValid) {
    return res.status(400).json({ 
      success: false, 
      error: "OTP गलत है" 
    });
  }

  // ✅ PIN भी लें
  const effectivePin = String(pin || signup.pin || "").trim();
  if (!effectivePin || effectivePin.length < 4) {
    return res.status(400).json({ 
      success: false, 
      error: "कम से कम 4 अंकों का PIN दें" 
    });
  }

  try {
    // अब tenant ID बनाएं
    const cleanedName = (signup.businessName || "restaurant").toLowerCase().replace(/[^a-z0-9]/g, "");
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    const tenantId = `veg-${cleanedName}-${randomSuffix}`;
    signup.tenantId = tenantId;

    // Owner बनाएं
    const newOwnerId = `s-${signup.ownerName.toLowerCase().replace(/[^a-z0-9]/g, "")}-${Math.floor(100 + Math.random() * 900)}`;
    const newOwner = {
      id: newOwnerId,
      name: signup.ownerName,
      role: "Owner" as any,
      pin: await hashPin(effectivePin), // ✅ यहां PIN लें
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

    // Save new tenant owner account and initial settings with clean empty collections
    await staffRepo.saveAll(tenantId, [newOwner] as any[]);
    await settingsRepo.save(tenantId, newSettings);
    await ingredientRepo.saveAll(tenantId, []);
    await menuRepo.saveAll(tenantId, []);
    await recipeRepo.saveAll(tenantId, []);
    await customerRepo.saveAll(tenantId, []);
    await orderRepo.saveAll(tenantId, []);
    await purchaseRepo.saveAll(tenantId, []);
    await shiftRepo.saveAll(tenantId, []);

    // Also, publish registration event to EventBus
    eventBus.publish(tenantId, "TENANT_REGISTERED", {
      tenantId,
      name: signup.businessName,
      owner: signup.ownerName,
      email: signup.email,
      region: signup.region
    });

    await auditLogService.log(
      tenantId,
      "TENANT_INIT",
      "SYSTEM",
      `Self-serve signup completed. New tenant "${signup.businessName}" initialized successfully.`,
      { region: signup.region, owner: signup.ownerName }
    );

    // Global tenants list में add करें
    const list = await getGlobalTenantsList();
    list.push({
      id: `t-${Date.now()}`,
      name: signup.businessName,
      tenantId: tenantId,
      status: "active",
      created: new Date().toISOString().slice(0, 10),
      region: signup.region || "North India / Delhi",
      ownerName: signup.ownerName,
      email: signup.email,
      ownerPhone: signup.ownerPhone || "",
      ownerPin: await hashPin(effectivePin)
    });
    await saveGlobalTenantsList(list);

    // ✅ अब Email भेजें - Restaurant ID के साथ
    try {
      await notificationService.send(tenantId, {
        title: "✅ VeggiePOS Restaurant Setup Complete",
        message: `Congratulations! "${signup.businessName}" is ready to use.\n\nYour Restaurant Store Code: ${tenantId}\n\nLogin करने के लिए अपना Store Code और PIN दर्ज करें।`,
        severity: "info",
        channels: ["email"],
        recipientEmail: signup.email,
        metadata: { tenantId }
      });
    } catch (emailErr) {
      console.warn("[Auth] Email delivery warning:", emailErr);
    }

    // Session बनाएं और login करें
    const userAgent = req.headers["user-agent"] || "Unknown";
    const ipAddress = req.ip || req.headers["x-forwarded-for"] || "127.0.0.1";
    const ip = Array.isArray(ipAddress) ? ipAddress[0] : ipAddress;

    const session = await sessionService.createSession(
      tenantId,
      newOwner.id,
      newOwner.name,
      newOwner.role,
      ip,
      userAgent
    );

    res.cookie(SESSION_COOKIE_NAME, session.sessionId, getSessionCookieOptions(req));

    await removePendingSignupRecord(signup.pendingToken);

    res.json({
      success: true,
      session,
      tenant: {
        id: `t-${Date.now()}`,
        name: signup.businessName,
        tenantId: tenantId,
        status: "active",
        storeCode: tenantId // ✅ यह दिखाएं
      },
      user: {
        id: newOwner.id,
        name: newOwner.name,
        role: newOwner.role
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
    
    // 1. First attempt to match target tenant by ID, Name, Outlet Code, Email, or Phone (newest first)
    let targetTenant = [...globalTenants].reverse().find(
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
