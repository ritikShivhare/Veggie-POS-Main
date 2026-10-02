import { GoogleGenAI } from "@google/genai";

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

    if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey === "") {
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

      const systemInstruction = `You are the Veggie POS AI Assistant & Product Advisor, embedded directly on the Veggie POS platform.
You have comprehensive, authoritative knowledge about both the Veggie POS restaurant management software application and the entire marketing platform.

KEY PRODUCT KNOWLEDGE:
1. Core Modules:
   - Touch POS Billing & Fast PIN Terminal: Sub-100ms multi-server table-side or counter ordering, quick cash/UPI/card split bills, dynamic modifier groups.
   - Kitchen Order Tickets (KOT) & KDS: Visual station color-coding (Starters, Mains, Desserts), multi-course holding/firing, kitchen latency timers.
   - Live Recipe Bill of Materials (BOM) & Inventory: Automatic stock deduction per item sold down to grams/milliliters, purchase order logging, vendor management, low-stock threshold alerts.
   - Table Floor Plan: Color-coded live table states (Vacant, Occupied, Dining, Billing), custom table zones (Indoor, Patio, Terrace, Bar).
   - Online Order Aggregator: Direct Swiggy/Zomato/Direct Order centralized inbox with one-click acceptance and automatic KOT printing.
   - Staff PIN & Role Permissions: 4-digit staff PINs with granular roles (Owner, Manager, Cashier, Server, Chef), cash drawer pop audit logs, shift rosters & drawer reconciliation.
   - Business Analytics & Reports: Real-time net sales, hourly demand heatmaps, category margin breakdowns, top selling dishes, staff sales performance, Z-Reports.
   - Multi-Tenant & Multi-Outlet: Centralized brand dashboard for managing menus, recipes, and outlet performance across chains.

2. Hardware & Architecture:
   - 100% browser-based (PWA): Runs on existing iPads, Android tablets, Windows/Mac laptops, and phones.
   - Zero proprietary hardware lock-ins. Works with standard ESC/POS 58mm/80mm thermal receipt and kitchen printers (Bluetooth, USB, Network/LAN).
   - Offline-resilient local sync.

3. Pricing Plans:
   - Starter / Counter: ₹799/month (billed annually) or ₹999/month for single counters, cafés, and bakeries.
   - Growth / Full Dine-In: ₹1,499/month (billed annually) or ₹1,899/month with table floor plan, KOT pacing, live recipe BOM, and staff PIN audit.
   - Multi-Outlet / Enterprise: ₹2,999/month (billed annually) or ₹3,499/month with centralized catalog management, cross-outlet inventory transfers, and priority 24/7 hotline.

4. Onboarding:
   - 48-Hour Rapid Go-Live Guarantee with menu onboarding specialists.
   - Free 15-minute personalized live walkthrough without aggressive sales pressure.

COMMUNICATION STYLE:
- Professional, welcoming, concise, and hospitality-focused.
- Support both English and Hindi/Hinglish naturally if the user asks in Hindi or Hinglish.
- If asked how to login or access the staff terminal, explain that store users can click 'Sign In' at the top right, enter their Store Code or Restaurant Name to link their device, and enter their 4-digit staff PIN to start billing.`;

      // Try primary model gemini-3.8-flash, falling back to gemini-flash-latest if needed
      let chatResponseText: string | undefined;

      try {
        const response = await executeWithRetry(() =>
          ai.models.generateContent({
            model: "gemini-3.8-flash",
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
              model: "gemini-flash-latest",
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
      return `VeggiePOS plans include:\n• Starter / Counter: ₹799/month (billed annually) for single counters, cafés, and bakeries.\n• Growth / Full Dine-In: ₹1,499/month (billed annually) with table floor plan, KOT pacing, live recipe BOM, and staff PIN audit.\n• Multi-Outlet / Enterprise: ₹2,999/month with centralized catalog management and cross-outlet inventory transfers.\nAll plans include zero hardware lock-in and 48-hour rapid go-live!`;
    }
    if (lowercasePrompt.includes("kot") || lowercasePrompt.includes("kds") || lowercasePrompt.includes("kitchen")) {
      return `VeggiePOS Kitchen Order Tickets (KOT) feature visual station color-coding (Starters, Mains, Desserts), multi-course holding/firing, kitchen latency timers, and direct thermal printing via USB, Bluetooth, or LAN.`;
    }
    if (lowercasePrompt.includes("recipe") || lowercasePrompt.includes("ingredient") || lowercasePrompt.includes("stock") || lowercasePrompt.includes("inventory")) {
      return `In VeggiePOS, you map recipe weights in the 'Inventory & Recipes' tab. When an order is processed, ingredients are automatically deducted down to grams/milliliters based on your Recipe Bill of Materials (BOM). Store managers can log vendor supplies, while the Owner has full master editing rights.`;
    }
    if (lowercasePrompt.includes("table") || lowercasePrompt.includes("floor") || lowercasePrompt.includes("dine")) {
      return `Our Table Floor Plan features live color-coded table states (Vacant, Occupied, Dining, Billing) across customizable zones (Indoor, Patio, Terrace, Bar) with quick multi-server ordering.`;
    }
    if (lowercasePrompt.includes("swiggy") || lowercasePrompt.includes("zomato") || lowercasePrompt.includes("online")) {
      return `The Online Order Aggregator provides a unified inbox for Swiggy, Zomato, and Direct Orders with one-click acceptance and automatic KOT dispatch to the kitchen.`;
    }
    if (lowercasePrompt.includes("hardware") || lowercasePrompt.includes("printer") || lowercasePrompt.includes("device")) {
      return `VeggiePOS is 100% browser-based (PWA) and runs on iPads, Android tablets, Windows/Mac laptops, and mobile phones. It connects to standard ESC/POS 58mm/80mm thermal receipt printers without proprietary hardware lock-ins.`;
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

