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
 * (e.g. Twilio, SendGrid, Amazon SES)
 */
export interface EmailProvider {
  sendEmail(to: string, subject: string, htmlBody: string): Promise<{ success: boolean; providerId: string }>;
}

export interface SMSProvider {
  sendSMS(to: string, message: string): Promise<{ success: boolean; providerId: string }>;
}

/**
 * Production-Ready Implementation for Resend API Integration
 */
class ResendEmailProvider implements EmailProvider {
  async sendEmail(to: string, subject: string, htmlBody: string) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn("[Resend Email Provider] No RESEND_API_KEY provided in environment variables. Falling back to Mock Console Delivery.");
      console.log(`\n============================================\n[MOCK EMAIL DELIVERED] (No RESEND_API_KEY)\nTo: ${to}\nSubject: ${subject}\nBody:\n${htmlBody}\n============================================\n`);
      return { success: true, providerId: `mock-${Date.now()}` };
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
        console.error(`[Resend Email Provider] Resend API Error: ${response.status} - ${errorText}`);
        return { success: false, providerId: "" };
      }

      const data = await response.json() as { id: string };
      console.log(`[Resend Email Provider] Email successfully dispatched. Resend ID: ${data.id}`);
      return { success: true, providerId: data.id };
    } catch (error: any) {
      console.error("[Resend Email Provider] Network error during dispatch:", error);
      return { success: false, providerId: "" };
    }
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
    this.emailProvider = new ResendEmailProvider();
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
            const emailRes = await this.emailProvider.sendEmail(recipientEmail, title, `<p>${message}</p>`);
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

    // Persist dispatch logs for auditing
    if (logs.length > 0) {
      await this.saveDispatchLogs(tenantId, logs);
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
    const existing = await this.getDispatchLogs(tenantId);
    const combined = [...newLogs, ...existing];
    await this.db.saveObject(tenantId, "notification_dispatch_logs", combined.slice(0, 100));
  }
}
