import { GoogleGenAI } from "@google/genai";
import { PLAN_LIMITS } from "../../../shared/planCatalog";

const pricingSummary = Object.values(PLAN_LIMITS)
  .map((plan) => `• ${plan.label}: ₹${plan.price}/30 days. Owner + ${plan.staffCount} active staff; ${plan.monthlyOrders < 0 ? "unlimited (fair use)" : plan.monthlyOrders} orders/30-day cycle.`)
  .join("\n");

export class CopilotService {
  public async handleChat(
    prompt: string,
    history: any[],
    tenantId: string,
    tenantName: string,
    staffName: string,
    staffRole: string
  ): Promise<{ reply: string; isImportant: boolean; isSimulated: boolean }> {
    const IMPORTANT_KEYWORDS = [
      "license", "billing", "subscription", "price", "pay", "payment",
      "bug", "error", "sync", "crash", "broken", "custom", "integration",
      "contact", "suggest", "feature", "contract", "owner", "admin", "abuse", "security"
    ];
    const lowercasePrompt = (prompt || "").toLowerCase();
    const isImportant = IMPORTANT_KEYWORDS.some(word => lowercasePrompt.includes(word));
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || !process.env.GEMINI_MODEL) {
      return {
        reply: this.getRuleBasedReply(lowercasePrompt, staffName, tenantName, isImportant),
        isImportant,
        isSimulated: true
      };
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const formattedHistory = (history || [])
        .map((h: any) => `${h.sender === "user" ? "User" : "Assistant"}: ${h.text}`)
        .join("\n");

      const systemInstruction = `You are the Aatmyam POS help assistant. Current functionality: one outlet per restaurant, menu billing, manual Cash/UPI settlement, kitchen Pending/Preparing/Ready status, recipe stock deduction, purchase logging, staff PINs and roles, customer points, sales summaries. Offline commands work in an already logged-in browser tab and need later server acceptance. Login and session restoration require internet. Printing uses the browser print dialog; no automatic cash-drawer or ESC/POS connection is configured. Swiggy/Zomato and SMS are not integrated. Provider-managed backups require setup. Plans: ${pricingSummary}. Do not claim certification, accuracy, uptime or automatic refunds. Respond briefly in English or Hindi/Hinglish. For account, privacy and billing questions ask the restaurant owner or service administrator. User context: ${staffName}, ${tenantName}, ${staffRole}.`;

      // Try primary model gemini-3.8-flash, falling back to gemini-flash-latest if needed
      let chatResponseText: string | undefined;

      try {
        const response = await executeWithRetry(() =>
          ai.models.generateContent({
            model: process.env.GEMINI_MODEL!,
            contents: `System Context:
${formattedHistory}
User Prompt: ${prompt}`,
            config: {
              systemInstruction,
              temperature: 0.7,
            }
          })
        );
        chatResponseText = response?.text;
      } catch {
        // Fallback model attempt
        try {
          const fallbackResponse = await executeWithRetry(() =>
            ai.models.generateContent({
              model: process.env.GEMINI_MODEL!,
              contents: `System Context:
${formattedHistory}
User Prompt: ${prompt}`,
              config: {
                systemInstruction,
                temperature: 0.7,
              }
            }),
            1,
            500
          );
          chatResponseText = fallbackResponse?.text;
        } catch {
          chatResponseText = undefined;
        }
      }

      if (chatResponseText && chatResponseText.trim().length > 0) {
        return {
          reply: chatResponseText,
          isImportant,
          isSimulated: false
        };
      }

      return {
        reply: this.getRuleBasedReply(lowercasePrompt, staffName, tenantName, isImportant),
        isImportant,
        isSimulated: true
      };
    } catch {
      return {
        reply: this.getRuleBasedReply(lowercasePrompt, staffName, tenantName, isImportant),
        isImportant,
        isSimulated: true
      };
    }
  }

  private getRuleBasedReply(
    lowercasePrompt: string,
    staffName: string,
    tenantName: string,
    isImportant: boolean
  ): string {
    if (lowercasePrompt.includes("hi") || lowercasePrompt.includes("hello") || lowercasePrompt.includes("namaste")) {
      return `Hello ${staffName}! How can I assist you with ${tenantName}'s operations today? You can ask about recipe setups, ingredients tracking, billing configurations, KOT, and table floor plans.`;
    }
    if (lowercasePrompt.includes("price") || lowercasePrompt.includes("plan") || lowercasePrompt.includes("cost") || lowercasePrompt.includes("subscription")) {
      return `Aatmyam POS monthly plans:\n${pricingSummary}\nDeployment timing and device compatibility need to be checked for your setup.`;
    }
    if (lowercasePrompt.includes("kot") || lowercasePrompt.includes("kds") || lowercasePrompt.includes("kitchen")) {
      return `Aatmyam POS Kitchen Order Tickets (KOT) feature visual station color-coding (Starters, Mains, Desserts), multi-course holding/firing, kitchen latency timers, and direct thermal printing via USB, Bluetooth, or LAN.`;
    }
    if (lowercasePrompt.includes("recipe") || lowercasePrompt.includes("ingredient") || lowercasePrompt.includes("stock") || lowercasePrompt.includes("inventory")) {
      return `In Aatmyam POS, you map recipe weights in the 'Inventory & Recipes' tab. When an order is processed, ingredients are automatically deducted down to grams/milliliters based on your Recipe Bill of Materials (BOM). Store managers can log vendor supplies, while the Owner has full master editing rights.`;
    }
    if (lowercasePrompt.includes("table") || lowercasePrompt.includes("floor") || lowercasePrompt.includes("dine")) {
      return `Our Table Floor Plan features live color-coded table states (Vacant, Occupied, Dining, Billing) across customizable zones (Indoor, Patio, Terrace, Bar) with quick multi-server ordering.`;
    }
    if (lowercasePrompt.includes("swiggy") || lowercasePrompt.includes("zomato") || lowercasePrompt.includes("online")) {
      return `The Online Order Aggregator provides a unified inbox for Swiggy, Zomato, and Direct Orders with one-click acceptance and automatic KOT dispatch to the kitchen.`;
    }
    if (lowercasePrompt.includes("hardware") || lowercasePrompt.includes("printer") || lowercasePrompt.includes("device")) {
      return `Aatmyam POS is 100% browser-based (PWA) and runs on iPads, Android tablets, Windows/Mac laptops, and mobile phones. It connects to standard ESC/POS 58mm/80mm thermal receipt printers without proprietary hardware lock-ins.`;
    }
    if (isImportant) {
      return `This concern involves technical configurations or operations parameters. I have flagged this as an "Administrative Issue" for log archiving. You can click "Log & Dispatch Transcript to Admin" below to instantly log this conversation.`;
    }
    return `Thank you for asking! I can help with general terminal navigation, shift logging, recipe BOM, digital UPI/cash billing, and analytics. How can I assist ${staffName} today?`;
  }
}

async function executeWithRetry<T>(
  fn: () => Promise<T>,
  retries = 2,
  delay = 500,
  backoffFactor = 2
): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const status = error?.status || error?.code || error?.statusCode;
    const message = typeof error?.message === "string" ? error.message : "";
    const isRetryable =
      status === 503 ||
      status === 429 ||
      message.includes("503") ||
      message.includes("429") ||
      message.includes("high demand") ||
      message.includes("UNAVAILABLE") ||
      message.includes("Unavailable");

    if (retries > 0 && isRetryable) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return executeWithRetry(fn, retries - 1, delay * backoffFactor, backoffFactor);
    }
    throw error;
  }
}

