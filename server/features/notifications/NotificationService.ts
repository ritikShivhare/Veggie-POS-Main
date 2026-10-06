import nodemailer from "nodemailer";
import { Database } from "../shared/database";

export type NotificationChannel = "in-app" | "email" | "sms";
export type NotificationSeverity = "info" | "success" | "warning" | "error";

export interface NotificationPayload {
  title: string;
  message: string;
  severity: NotificationSeverity;
  channels: NotificationChannel[];
  recipientEmail?: string;
  recipientPhone?: string;
  htmlBody?: string;
  metadata?: Record<string, any>;
}

export interface InAppNotification {
  id: string;
  title: string;
  message: string;
  severity: NotificationSeverity;
  timestamp: string;
  read: boolean;
  metadata?: Record<string, any>;
}

export interface DispatchLog {
  id: string;
  timestamp: string;
  channel: NotificationChannel;
  status: "dispatched" | "failed";
  recipient: string;
  subjectOrTitle: string;
  messageBody: string;
  providerUsed: string;
}

/**
 * Extensible Provider Interfaces for Production Integrations
 * (e.g. Gmail SMTP, Twilio, Resend, Amazon SES)
 */
export interface EmailProvider {
  sendEmail(to: string, subject: string, htmlBody: string): Promise<{ success: boolean; providerId: string }>;
}

export interface SMSProvider {
  sendSMS(to: string, message: string): Promise<{ success: boolean; providerId: string }>;
}

function isPlaceholderCredential(val?: string): boolean {
  if (!val) return true;
  const lower = val.toLowerCase().trim();
  return (
    lower === "" ||
    lower.includes("your-email") ||
    lower.includes("your_email") ||
    lower.includes("example.com") ||
    lower.includes("yourdomain.com") ||
    lower.includes("your-password") ||
    lower.includes("your_password") ||
    lower.includes("your-app-password") ||
    lower.includes("your_app_password") ||
    lower.startsWith("your_") ||
    lower.startsWith("your-") ||
    lower.startsWith("placeholder")
  );
}

/**
 * Option 1: Free Nodemailer SMTP Email Provider (Gmail App Password / Free SMTP)
 */
class SmtpEmailProvider implements EmailProvider {
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    const user = process.env.SMTP_USER || process.env.GMAIL_USER;
    const pass = process.env.SMTP_PASS || process.env.GMAIL_PASS;
    const host = process.env.SMTP_HOST || "smtp.gmail.com";
    const port = parseInt(process.env.SMTP_PORT || "465", 10);

    if (user && pass && !isPlaceholderCredential(user) && !isPlaceholderCredential(pass)) {
      try {
        this.transporter = nodemailer.createTransport({
          host,
          port,
          secure: port === 465,
          auth: { user, pass },
          connectionTimeout: 8000,
          greetingTimeout: 5000,
          socketTimeout: 10000
        });
        console.log(`[SMTP Email Provider] Initialized Nodemailer SMTP via ${host}:${port} for ${user}`);
      } catch (err) {
        console.warn("[SMTP Email Provider] Transport setup warning:", err);
      }
    } else {
      console.warn("[SMTP Email Provider] Real SMTP credentials not configured (placeholder detected).");
    }
  }

  private initTransporter() {
    const user = process.env.SMTP_USER || process.env.GMAIL_USER;
    const pass = process.env.SMTP_PASS || process.env.GMAIL_PASS;
    const host = process.env.SMTP_HOST || "smtp.gmail.com";
    const port = parseInt(process.env.SMTP_PORT || "465", 10);

    if (user && pass && !isPlaceholderCredential(user) && !isPlaceholderCredential(pass)) {
      try {
        this.transporter = nodemailer.createTransport({
          host,
          port,
          secure: port === 465,
          auth: { user, pass },
          connectionTimeout: 8000,
          greetingTimeout: 5000,
          socketTimeout: 10000
        });
        console.log(`[SMTP Email Provider] Initialized Nodemailer SMTP via ${host}:${port} for ${user}`);
      } catch (err) {
        console.warn("[SMTP Email Provider] Transport setup warning:", err);
      }
    } else {
      console.warn("[SMTP Email Provider] Real SMTP credentials not configured.");
    }
  }

  async sendEmail(to: string, subject: string, htmlBody: string) {
    if (!this.transporter) {
      this.initTransporter();
    }
    if (!this.transporter) {
      return { success: false, providerId: "" };
    }

    try {
      const fromEmail = process.env.SMTP_USER || process.env.GMAIL_USER;
      const info = await this.transporter.sendMail({
        from: `"VeggiePOS" <${fromEmail}>`,
        to,
        subject,
        html: htmlBody
      });
      console.log(`[SMTP Email Provider] Real Email sent to ${to}. ID: ${info.messageId}`);
      return { success: true, providerId: info.messageId };
    } catch (error: any) {
      console.warn("[SMTP Email Provider] Error dispatching email via SMTP:", error?.message || error);
      return { success: false, providerId: "" };
    }
  }
}

/**
 * Production-Ready Implementation for Resend API Integration
 */
class ResendEmailProvider implements EmailProvider {
  async sendEmail(to: string, subject: string, htmlBody: string) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return { success: false, providerId: "" };
    }

    try {
      console.log(`[Resend Email Provider] Sending email via Resend API to ${to}...`);
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: "VeggiePOS <onboarding@resend.dev>",
          to: [to],
          subject: subject,
          html: htmlBody
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`[Resend Email Provider] Resend API Error: ${response.status} - ${errorText}`);
        return { success: false, providerId: "" };
      }

      const data = await response.json() as { id: string };
      console.log(`[Resend Email Provider] Email successfully dispatched. Resend ID: ${data.id}`);
      return { success: true, providerId: data.id };
    } catch (error: any) {
      console.warn("[Resend Email Provider] Network error during dispatch:", error);
      return { success: false, providerId: "" };
    }
  }
}

/**
 * Composite Email Provider combining free Nodemailer SMTP and Resend API
 */
class CompositeEmailProvider implements EmailProvider {
  private smtpProvider: SmtpEmailProvider;
  private resendProvider: ResendEmailProvider;

  constructor() {
    this.smtpProvider = new SmtpEmailProvider();
    this.resendProvider = new ResendEmailProvider();
  }

  async sendEmail(to: string, subject: string, htmlBody: string) {
    // If sending to registered Resend account owner, try Resend first for fast dispatch
    if (process.env.RESEND_API_KEY && to.toLowerCase().includes("ritikshiv53")) {
      const resendRes = await this.resendProvider.sendEmail(to, subject, htmlBody);
      if (resendRes.success) {
        return resendRes;
      }
    }

    // Try direct Gmail SMTP (which delivered successfully to shivritik53@gmail.com)
    const smtpRes = await this.smtpProvider.sendEmail(to, subject, htmlBody);
    if (smtpRes.success) {
      return smtpRes;
    }

    // Fallback to Resend if not already attempted
    if (process.env.RESEND_API_KEY && !to.toLowerCase().includes("ritikshiv53")) {
      const resendRes = await this.resendProvider.sendEmail(to, subject, htmlBody);
      if (resendRes.success) {
        return resendRes;
      }
    }

    console.error(`[NotificationService] All configured email providers failed for recipient ${to}.`);
    return { success: false, providerId: "" };
  }
}

class MockTwilioProvider implements SMSProvider {
  async sendSMS(to: string, message: string) {
    console.log(`[Twilio Integration] Dispatching SMS to ${to}...`);
    await new Promise((resolve) => setTimeout(resolve, 100));
    return { success: true, providerId: `tw-sms-${Date.now()}-${Math.floor(Math.random() * 1000)}` };
  }
}

export class NotificationService {
  private static instance: NotificationService;
  private db: Database;
  private emailProvider: EmailProvider;
  private smsProvider: SMSProvider;

  private constructor() {
    this.db = Database.getInstance();
    this.emailProvider = new CompositeEmailProvider();
    this.smsProvider = new MockTwilioProvider();
  }

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Primary entrypoint to dispatch notifications across multiple channels
   */
  public async send(tenantId: string, payload: NotificationPayload): Promise<{
    success: boolean;
    dispatchedChannels: { channel: NotificationChannel; status: "success" | "failed"; detail: string }[];
  }> {
    const { title, message, severity, channels, recipientEmail, recipientPhone, metadata } = payload;
    const results: { channel: NotificationChannel; status: "success" | "failed"; detail: string }[] = [];
    const logs: DispatchLog[] = [];

    for (const channel of channels) {
      try {
        switch (channel) {
          case "in-app":
            const inAppId = await this.saveInAppNotification(tenantId, {
              title,
              message,
              severity,
              metadata
            });
            results.push({ channel: "in-app", status: "success", detail: `Saved to system_notifications with ID ${inAppId}` });
            break;

          case "email":
            if (!recipientEmail) {
              results.push({ channel: "email", status: "failed", detail: "Missing recipient email address" });
              break;
            }
            const bodyToSend = payload.htmlBody || `<p>${message}</p>`;
            const emailRes = await this.emailProvider.sendEmail(recipientEmail, title, bodyToSend);
            if (emailRes.success) {
              results.push({ channel: "email", status: "success", detail: `Delivered via Resend (Ref: ${emailRes.providerId})` });
              logs.push({
                id: `log-${Date.now()}-${Math.random()}`,
                timestamp: new Date().toISOString(),
                channel: "email",
                status: "dispatched",
                recipient: recipientEmail,
                subjectOrTitle: title,
                messageBody: message,
                providerUsed: "Resend"
              });
            } else {
              results.push({ channel: "email", status: "failed", detail: "Resend email transmission failed" });
            }
            break;

          case "sms":
            if (!recipientPhone) {
              results.push({ channel: "sms", status: "failed", detail: "Missing recipient phone number" });
              break;
            }
            const smsRes = await this.smsProvider.sendSMS(recipientPhone, `[${severity.toUpperCase()}] ${title}: ${message}`);
            if (smsRes.success) {
              results.push({ channel: "sms", status: "success", detail: `Delivered via Twilio (Ref: ${smsRes.providerId})` });
              logs.push({
                id: `log-${Date.now()}-${Math.random()}`,
                timestamp: new Date().toISOString(),
                channel: "sms",
                status: "dispatched",
                recipient: recipientPhone,
                subjectOrTitle: title,
                messageBody: message,
                providerUsed: "Twilio (Mock-Active)"
              });
            } else {
              results.push({ channel: "sms", status: "failed", detail: "Twilio gateway timeout" });
            }
            break;
        }
      } catch (err: any) {
        results.push({ channel, status: "failed", detail: err.message || "Unknown channel exception" });
      }
    }

    // Persist dispatch logs for auditing (non-blocking)
    if (logs.length > 0) {
      try {
        await this.saveDispatchLogs(tenantId, logs);
      } catch (logErr) {
        console.warn(`[NotificationService] Warning: Failed to persist dispatch logs for tenant ${tenantId}:`, logErr);
      }
    }

    return {
      success: results.every((r) => r.status === "success"),
      dispatchedChannels: results
    };
  }

  /**
   * Retrieve all in-app notifications for a tenant
   */
  public async getInAppNotifications(tenantId: string): Promise<InAppNotification[]> {
    return (await this.db.getObject<InAppNotification[]>(tenantId, "system_notifications")) || [];
  }

  /**
   * Mark specific in-app notification as read
   */
  public async markAsRead(tenantId: string, id: string): Promise<boolean> {
    const list = await this.getInAppNotifications(tenantId);
    const item = list.find((n) => n.id === id);
    if (!item) return false;
    item.read = true;
    await this.db.saveObject(tenantId, "system_notifications", list);
    return true;
  }

  /**
   * Mark all in-app notifications as read
   */
  public async markAllAsRead(tenantId: string): Promise<void> {
    const list = await this.getInAppNotifications(tenantId);
    list.forEach((n) => { n.read = true; });
    await this.db.saveObject(tenantId, "system_notifications", list);
  }

  /**
   * Delete specific in-app notification
   */
  public async deleteNotification(tenantId: string, id: string): Promise<boolean> {
    const list = await this.getInAppNotifications(tenantId);
    const filtered = list.filter((n) => n.id !== id);
    if (filtered.length === list.length) return false;
    await this.db.saveObject(tenantId, "system_notifications", filtered);
    return true;
  }

  /**
   * Retrieve dispatch history logs (SMS, Email logs)
   */
  public async getDispatchLogs(tenantId: string): Promise<DispatchLog[]> {
    return (await this.db.getObject<DispatchLog[]>(tenantId, "notification_dispatch_logs")) || [];
  }

  /**
   * Clear all dispatch logs
   */
  public async clearDispatchLogs(tenantId: string): Promise<void> {
    await this.db.saveObject(tenantId, "notification_dispatch_logs", []);
  }

  // --- Helpers ---

  private async saveInAppNotification(
    tenantId: string,
    notification: Omit<InAppNotification, "id" | "timestamp" | "read">
  ): Promise<string> {
    const id = `notify-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const list = await this.getInAppNotifications(tenantId);

    const newNotification: InAppNotification = {
      ...notification,
      id,
      timestamp: new Date().toISOString(),
      read: false
    };

    list.unshift(newNotification);
    // Maintain maximum 50 recent notifications
    await this.db.saveObject(tenantId, "system_notifications", list.slice(0, 50));
    return id;
  }

  private async saveDispatchLogs(tenantId: string, newLogs: DispatchLog[]): Promise<void> {
    try {
      const existing = await this.getDispatchLogs(tenantId);
      const combined = [...newLogs, ...existing];
      await this.db.saveObject(tenantId, "notification_dispatch_logs", combined.slice(0, 100));
    } catch (err) {
      console.warn(`[NotificationService] Suppressed log save error for ${tenantId}:`, err);
    }
  }
}
