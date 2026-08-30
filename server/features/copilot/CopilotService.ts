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
      // Missing key - use a smart rule-based conversational responder
      let reply = "";
      if (lowercasePrompt.includes("hi") || lowercasePrompt.includes("hello")) {
        reply = `Hello ${staffName}! How can I assist you with ${tenantName}'s operations today? You can ask about recipe setups, ingredients tracking, and billing configs.`;
      } else if (isImportant) {
        reply = `This concern involves technical configurations or operations parameters. I have flagged this as an "Administrative Issue" for log archiving. You can click "Log & Dispatch Transcript to Admin" below to instantly log this conversation.`;
      } else if (lowercasePrompt.includes("recipe") || lowercasePrompt.includes("ingredient") || lowercasePrompt.includes("stock")) {
        reply = `In VeggiePOS, you map recipe weights in the 'Inventory & Recipes' tab. If 'Auto-Deduct Stock' is enabled in Settings, ingredients are automatically subtracted when checked out at the POS Billing terminal. Store managers can log vendor supplies, while only the Restaurant Owner has full editing rights.`;
      } else {
        reply = `Thank you for asking! I can help with general terminal navigation, shift logging, and digital UPI configurations. For customized reports or premium terminal setups, please use the dispatch button below to archive your query.`;
      }

      return {
        reply,
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

      const chatResponse = await retryWithBackoff(() => 
        ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: `System Context:
${formattedHistory}
User Prompt: ${prompt}`,
          config: {
            systemInstruction,
            temperature: 0.7,
          }
        })
      );

      return {
        reply: chatResponse.text || "I am here to help you configure VeggiePOS. Please clarify your query.",
        isImportant,
        isSimulated: false
      };
    } catch (err: any) {
      console.info("[CopilotService] Gemini Copilot connection threshold hit. Falling back to friendly local heuristics/offline mode.");
      return {
        reply: `I encountered a connection threshold. For licensing queries or terminal configuration support, please use the Dispatch button below to log your inquiry.`,
        isImportant,
        isSimulated: true
      };
    }
  }
}

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  retries = 3,
  delay = 1000,
  backoffFactor = 2
): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const status = error?.status || error?.code || error?.statusCode;
    const message = typeof error?.message === "string" ? error.message : JSON.stringify(error);
    const isRetryable = status === 503 || status === 429 || 
                        message.includes("503") || message.includes("429") || 
                        message.includes("high demand") || message.includes("UNAVAILABLE") ||
                        message.includes("temporary") || message.includes("Unavailable");
    
    if (retries > 0 && isRetryable) {
      console.info(`[CopilotService] Gemini call failed with status ${status}. Retrying in ${delay}ms... (${retries} attempts remaining).`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return retryWithBackoff(fn, retries - 1, delay * backoffFactor, backoffFactor);
    }
    throw error;
  }
}

