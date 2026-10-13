import express from "express";
import crypto from "node:crypto";
import rateLimit from "express-rate-limit";
import { publicStaff, publicTenant, digest, validPin } from "../server/features/shared/security";

import bcrypt from "bcryptjs";
import { Database,handleApiError } from "../server/features/shared/database";
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
  codeHash: string;
  passwordHash: string;
  attempts: number;
  createdAt: number;
  expiresAt: number;
  lastSentAt?: number;
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
  <title>Activate Your Aatmyam POS Account</title>
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
                Thank you for choosing Aatmyam POS to power <strong style="color: #ffffff;">${businessName}</strong>. You are just one quick step away from activating your full cloud billing terminal, table QR ordering, live KDS, and smart inventory management.
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
                          <strong style="color: #f1f5f9;">1. Enter the 6 digits</strong> into your Aatmyam POS registration screen.
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
                🔒 <strong>Security Tip:</strong> Never share your verification code or login PIN. Aatmyam POS representatives will never ask for your code.
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
                &copy; ${new Date().getFullYear()} Aatmyam POS Cloud Systems. All rights reserved.
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

// Pending challenges are protected server records; no disk/plaintext credentials.
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false });
router.use(['/auth/signup','/auth/resend-otp','/auth/verify','/auth/unlock-override'], authLimiter);
async function syncPendingSignupsFromDb(): Promise<void> {
  const records = await Database.getInstance().getObject<PendingSignup[]>('saas-admin', 'signup_challenges_v2') || [];
  pendingSignups.clear();
  for (const s of records) if (s.expiresAt > Date.now()) {
    pendingSignups.set(s.pendingToken, s);
  }
}
async function persistPendingSignup(signup: PendingSignup): Promise<void> {
  await Database.getInstance().runTransaction('saas-admin', async trx => {
    const all = await Database.getInstance().getObject<PendingSignup[]>('saas-admin','signup_challenges_v2') || [];
    if((all.find(s=>s.pendingToken===signup.pendingToken) as any)?.registeredTenant) throw Object.assign(new Error("Registration is already complete."),{status:409});
    await trx.saveObject('signup_challenges_v2', [...all.filter(s => s.expiresAt > Date.now() && s.pendingToken !== signup.pendingToken), signup]);
  });
  pendingSignups.set(signup.pendingToken, signup);
}
async function removePendingSignupRecord(token: string): Promise<void> {
  await Database.getInstance().runTransaction('saas-admin', async trx => {
    const all = await Database.getInstance().getObject<PendingSignup[]>('saas-admin','signup_challenges_v2') || [];
    await trx.saveObject('signup_challenges_v2', all.filter(s => s.pendingToken !== token && s.expiresAt > Date.now()));
  });
  pendingSignups.delete(token);
}

// POST /auth/signup - सिर्फ OTP भेजें
router.post("/auth/signup", async (req, res) => {
  const { businessName, ownerName, ownerPhone, email, pin, region, password } = req.body;

  try {
    if (typeof businessName !== 'string' || !businessName.trim() || businessName.length > 160 ||
        typeof ownerName !== 'string' || !ownerName.trim() || ownerName.length > 120 ||
        typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
        !validPin(pin) || typeof password !== 'string' || password.length < 8 || password.length > 128) {
      return res.status(422).json({success:false,message:'Name, valid email, 4–6 digit PIN and password of at least 8 characters are required.'});
    }
    const targetEmail = email.trim().toLowerCase();
    if (!targetEmail) {
      return res.status(400).json({ success: false, message: "Valid email address is required." });
    }

    const verificationCode = crypto.randomInt(100000,1000000).toString();
    const pendingToken = crypto.randomBytes(32).toString("hex");

    const pendingSignupRecord: PendingSignup = {
      businessName: businessName || "",
      ownerName: ownerName || "",
      ownerPhone: ownerPhone || "",
      email: targetEmail,
      pin: await hashPin(pin),
      region: region || "North India / Delhi",
      tenantId: "",
      codeHash: digest(verificationCode),
      passwordHash: await bcrypt.hash(password, 12),
      attempts: 0,
      createdAt: Date.now(),
      expiresAt: Date.now() + 10 * 60 * 1000,
      lastSentAt: Date.now(),
      pendingToken
    };



    const sendResult = await notificationService.send("system", {
      title: "Aatmyam POS Email Verification Code",
      message: "Your verification code expires in 10 minutes. Never share it.",
      severity: "info",
      channels: ["email"],
      recipientEmail: targetEmail,
      htmlBody: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="display: inline-block; width: 48px; height: 48px; border-radius: 12px; background: linear-gradient(135deg, #10b981, #059669); line-height: 48px; color: #ffffff; font-weight: 800; font-size: 20px;">V</div>
            <h2 style="color: #0f172a; margin: 12px 0 4px; font-size: 20px;">Verify Your Email</h2>
            <p style="color: #64748b; font-size: 13px; margin: 0;">Aatmyam POS Account Setup</p>
          </div>
          <p style="color: #334155; font-size: 14px; line-height: 1.5;">Enter the following 6-digit verification code to complete your restaurant registration:</p>
          <div style="background: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 12px; padding: 18px; text-align: center; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #059669; font-family: 'Courier New', Courier, monospace;">${verificationCode}</span>
          </div>
          <p style="color: #64748b; font-size: 12px; line-height: 1.5;">This code expires in <strong>10 minutes</strong>. Never share this code with anyone.</p>
          <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0 16px;" />
          <p style="color: #94a3b8; font-size: 11px; text-align: center; margin: 0;">Sent to ${targetEmail} for Aatmyam POS Security</p>
        </div>
      `
    });

    const emailSent = sendResult.dispatchedChannels.some(
      (c) => c.channel === "email" && c.status === "success"
    );

    if (!emailSent) {

      return res.status(500).json({
        success: false,
        error: "EMAIL_SEND_FAILED",
        message: "Unable to send verification email. Please try again."
      });
    }

    await persistPendingSignup(pendingSignupRecord);
    res.json({
      success: true,
      pendingToken,
      email: targetEmail,
      message: "Verification code sent to your email."
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: "EMAIL_SEND_FAILED", message: "Unable to send verification email. Please try again." });
  }
});

// Endpoint to resend Email OTP
router.post("/auth/resend-otp", async (req, res) => {
  try {
  const { pendingToken, email } = req.body;
  if (!pendingToken) {
    return res.status(400).json({
      success: false,
      message: "Verification token or email is required."
    });
  }

  await syncPendingSignupsFromDb();

  let signup: PendingSignup | undefined;
  if (pendingToken) signup = pendingSignups.get(pendingToken);


  if (!signup && pendingToken) {
    try {
      const db = Database.getInstance();
      const stored = (await db.getObject<PendingSignup[]>("saas-admin", "signup_challenges_v2")) || [];
      if (Array.isArray(stored)) {
        signup = stored.find(s => s && (s.pendingToken === pendingToken));
      }
    } catch {}
  }

  if (!signup) {
    return res.status(400).json({
      success: false,
      message: "Verification code expired. Please request a new code."
    });
  }

  // Cooldown check (15 seconds)
  if (signup.lastSentAt && (Date.now() - signup.lastSentAt < 15000)) {
    const waitSec = Math.ceil((15000 - (Date.now() - signup.lastSentAt)) / 1000);
    return res.status(429).json({
      success: false,
      message: `Please wait ${waitSec} seconds before requesting another code.`
    });
  }

  // 1. Generate completely new 6-digit OTP
  const newOtp = crypto.randomInt(100000,1000000).toString();

  // 2. Replace previous OTP and update expiration to 10 minutes
  signup = { ...signup, codeHash: digest(newOtp), attempts: 0 };
  signup.createdAt = Date.now();
  signup.expiresAt = Date.now() + 10 * 60 * 1000;
  signup.lastSentAt = Date.now();

  // 3. Send new OTP to user's email
  const sendResult = await notificationService.send("system", {
    title: "Aatmyam POS Email Verification (Resent)",
    message: "A replacement verification code expires in 10 minutes. Never share it.",
    severity: "info",
    channels: ["email"],
    recipientEmail: signup.email,
    htmlBody: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="display: inline-block; width: 48px; height: 48px; border-radius: 12px; background: linear-gradient(135deg, #10b981, #059669); line-height: 48px; color: #ffffff; font-weight: 800; font-size: 20px;">V</div>
          <h2 style="color: #0f172a; margin: 12px 0 4px; font-size: 20px;">Verify Your Email (New Code)</h2>
          <p style="color: #64748b; font-size: 13px; margin: 0;">Aatmyam POS Account Setup</p>
        </div>
        <p style="color: #334155; font-size: 14px; line-height: 1.5;">Enter the following new 6-digit verification code to complete your restaurant registration:</p>
        <div style="background: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 12px; padding: 18px; text-align: center; margin: 20px 0;">
          <span style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #059669; font-family: 'Courier New', Courier, monospace;">${newOtp}</span>
        </div>
        <p style="color: #64748b; font-size: 12px; line-height: 1.5;">This code expires in <strong>10 minutes</strong>. Only the newest code is valid.</p>
        <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0 16px;" />
        <p style="color: #94a3b8; font-size: 11px; text-align: center; margin: 0;">Sent to ${signup.email} for Aatmyam POS Security</p>
      </div>
    `
  });

  const emailSent = sendResult.dispatchedChannels.some(
    (c) => c.channel === "email" && c.status === "success"
  );

  if (!emailSent) {
    return res.status(500).json({
      success: false,
      message: "Unable to send verification email. Please try again."
    });
  }

  await persistPendingSignup(signup);
  return res.json({
    success: true,
    pendingToken: signup.pendingToken,
    message: "Verification code sent to your email."
  });
  } catch (error) { handleApiError(res,error); }
});

router.post("/auth/verify",async(req,res)=>{
  const {pendingToken,verificationCode}=req.body;
  if(typeof pendingToken!=="string" || pendingToken.length>100 || !/^\d{6}$/.test(String(verificationCode || ""))) return res.status(400).json({success:false,error:"INVALID_VERIFICATION_INPUT"});
  try {
    const tenantId=`aatm-${crypto.randomUUID()}`;
    const result=await Database.getInstance().registerRestaurant(pendingToken,digest(String(verificationCode)),tenantId,crypto.randomUUID());
    if(!result.success) return res.status(result.status || 400).json(result);
    const owner=await staffRepo.getById(result.tenant.tenantId,result.ownerId);
    const session=await sessionService.createSession(result.tenant.tenantId,owner.id,owner.name,owner.role,req.ip || "unknown",req.headers["user-agent"] || "Unknown",owner.permissions);
    res.cookie(SESSION_COOKIE_NAME,session.sessionId,getSessionCookieOptions(req));
    return res.json({success:true,session,tenant:publicTenant(result.tenant),user:publicStaff(owner)});
  } catch(error) {handleApiError(res,error);}
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
  let { pin, password, email, phone, outletCode, tenantId, restaurantName, isDemoLogin } = req.body;
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

    if (!targetTenant) return res.status(404).json({ success:false, error:"TENANT_NOT_FOUND", message:"Register and verify this restaurant before signing in." });
    let staff = effectiveTenantId ? ((await staffRepo.getAll(effectiveTenantId)) || []) : [];
    staff=staff.filter(s=>s.status!=="inactive" && s.status!=="suspended");
    let matchingUser = validPin(pin) ? await findStaffByPinConstantTime(staff, pin) : null;
    if (typeof password==="string" && password.length<=128) {
      const owner=staff.find(s=>s.role==="Owner");
      if ((owner as any)?.passwordHash && await bcrypt.compare(password,(owner as any).passwordHash)) matchingUser=owner;
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
      tenant: publicTenant(targetTenant) || {
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

    if (!isMasterCode && !isOwnerPinMatch) {
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
      tenant: publicTenant(tenantInfo),
      user: userInfo
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/auth/change-pin",authMiddleware,rateLimit({windowMs:15*60*1000,limit:10,standardHeaders:true,legacyHeaders:false}),async(req,res)=>{
  try {
    const tenantId=(req as any).tenantId,staffId=(req as any).session.userId;
    if(!validPin(req.body.newPin)) return res.status(400).json({success:false,error:"INVALID_PIN"});
    await Database.getInstance().runTransaction(tenantId,async()=>{
      const staff=await staffRepo.getById(tenantId,staffId);
      if(!staff || !await verifyPin(req.body.currentPin,staff.pin)) throw Object.assign(new Error("Current PIN is incorrect."),{status:401});
      const others=(await staffRepo.getAll(tenantId)).filter(s=>s.id!==staffId);
      if(await findStaffByPinConstantTime(others,req.body.newPin)) throw Object.assign(new Error("Choose a unique PIN."),{status:400});
      await staffRepo.update(tenantId,{...staff,pin:req.body.newPin});
      await sessionService.revokeAllSessions(tenantId);
    });
    res.clearCookie(SESSION_COOKIE_NAME,getClearCookieOptions(req));res.json({success:true,message:"PIN changed. Log in again."});
  }catch(error){handleApiError(res,error);}
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
    const publicStaff = staff.filter(s=>s.status!=='inactive' && s.status!=='suspended').map((s) => ({
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

router.get("/auth/sessions-data", authMiddleware, requireRole("Owner"), async (req, res) => {
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
      activeSessions: activeSessions.map(({sessionId, ...s}) => ({...s, managementId: digest(sessionId), isCurrent:sessionId===(req as any).session.sessionId})),
      loginHistory,
      securitySettings
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/auth/sessions/revoke", authMiddleware, requireRole("Owner"), async (req, res) => {
  try {
  const tenantId = (req as any).tenantId;
  const active = await sessionService.getActiveSessions(tenantId);
  const sessionId = active.find(s => digest(s.sessionId) === req.body.managementId)?.sessionId;
  if (!sessionId) {
    return res.status(400).json({ success: false, error: "MISSING_SESSION", message: "Session ID to revoke is required." });
  }
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
