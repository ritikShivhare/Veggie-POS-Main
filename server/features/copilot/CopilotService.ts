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

      const systemInstruction = `You are the VeggiePOS AI Operations Copilot, a helpful operations and software assistant.
You are chatting with a user named "${staffName}" who holds the role of "${staffRole}" at the restaurant "${tenantName}" (ID: "${tenantId}").

ROLE CONTEXT:
1. The user is either the "Restaurant Owner", store manager, or local restaurant staff.
2. The "Restaurant Owner" holds the absolute ultimate operational authority inside the workspace. They can manage shifts, invent templates, change pricing multipliers, view strategic audit logs, and edit recipes.

Your instructions:
- Keep answers professional, friendly, concise, and focused on helping the restaurant succeed.
- Help the user navigate standard workflows (e.g., billing orders, CRM client records, delivery integration portals, kitchen assembly line updates, shift timers, stock deduction parameters).
- IF THE USER ASKS ABOUT subscriptions, commercial licensing, system setups, bugs, or feature suggestions: Answer politely as an operational copilot. Note that they can click the dispatch log button below to compile and save a transcript of this setup directly to their administrative log record.
- Return short, helpful plain text answers. Do not use complex header blocks or excessive formatting.`;

      const chatResponse = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `System Context:
${formattedHistory}
User Prompt: ${prompt}`,
        config: {
          systemInstruction,
          temperature: 0.7,
        }
      });

      return {
        reply: chatResponse.text || "I am here to help you configure VeggiePOS. Please clarify your query.",
        isImportant,
        isSimulated: false
      };
    } catch (err: any) {
      console.error("Gemini Copilot Error in CopilotService:", err);
      return {
        reply: `I encountered a connection threshold. For licensing queries or terminal configuration support, please use the Dispatch button below to log your inquiry.`,
        isImportant,
        isSimulated: true
      };
    }
  }
}
