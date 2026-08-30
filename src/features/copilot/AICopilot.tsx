import React, { useState, useRef, useEffect } from "react";
import { RestaurantTenant, StaffMember } from "../shared/types";
import { ApiClient } from "../shared/services/api";
import {
  Sparkles,
  Send,
  X,
  MessageSquare,
  User,
  Cpu
} from "lucide-react";

interface AICopilotProps {
  activeTenant: RestaurantTenant;
  currentStaff: StaffMember | null;
}

interface ChatMessage {
  id: string;
  sender: "user" | "ai";
  text: string;
  timestamp: string;
}

export default function AICopilot({ activeTenant, currentStaff }: AICopilotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  
  // Initial messages
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Initialize welcome message on open or tenant change
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: "msg-welcome",
          sender: "ai",
          text: `Namaste & Welcome to Veggie POS! I am your AI Product & Operations Advisor.

I have full information about our Touch POS Billing, Kitchen KOT/KDS, Recipe Bill of Materials (BOM), Table Floor Management, Pricing Plans, and ROI Leakage Protections.

How can I help you or your restaurant today? (Feel free to ask in English or Hindi!)`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    }
  }, [activeTenant]);

  // Scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text) return;

    if (!textToSend) {
      setInput("");
    }

    const userMsg: ChatMessage = {
      id: `msg-user-${Date.now()}`,
      sender: "user",
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);

    // Call server API for copilot chat
    try {
      const data = await ApiClient.sendCopilotMessage({
        prompt: text,
        history: messages.map(m => ({ sender: m.sender, text: m.text })),
        tenantId: activeTenant.tenantId,
        tenantName: activeTenant.name,
        staffName: currentStaff?.name || "Restaurant Operator",
        staffRole: currentStaff?.role || "Operator"
      });

      setIsTyping(false);

      if (data.success) {
        setMessages(prev => [
          ...prev,
          {
            id: `msg-ai-${Date.now()}`,
            sender: "ai",
            text: data.reply,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
      } else {
        throw new Error(data.error || "Failed to get AI response");
      }
    } catch (err) {
      console.error("Copilot AI Request Error:", err);
      setIsTyping(false);
      
      // Smart offline fallback
      setTimeout(() => {
        let reply = "Veggie POS is the calm command center for restaurants, cafés, QSRs, and cloud kitchens. It combines ultra-fast touch billing, multi-course KOTs, recipe-level inventory deduction, and real-time owner analytics.";
        
        const lowercaseText = text.toLowerCase();
        if (lowercaseText.includes("hindi") || lowercaseText.includes("kya") || lowercaseText.includes("kaise") || lowercaseText.includes("dam") || lowercaseText.includes("price")) {
          reply = `Veggie POS restaurants aur cafés ke liye complete software hai:
1. Fast PIN Billing: Sub-100ms speed se quick bills aur UPI payments.
2. Kitchen KOT & KDS: Stations ke hisab se automatic orders dispatch.
3. Recipe & Stock BOM: Har dish bikne par raw materials gram-to-gram deduct hote hain.
4. Pricing: Starter plan ₹799/month se start hota hai, aur 48 hours me aapka menu live ho jata hai!`;
        } else if (lowercaseText.includes("recipe") || lowercaseText.includes("ingredient") || lowercaseText.includes("stock") || lowercaseText.includes("inventory")) {
          reply = `In Veggie POS, each dish links to raw ingredients via our Bill of Materials (BOM). When a cashier checks out an order at the POS, ingredient quantities (like cheese, coffee beans, sauces) are automatically deducted in real time, preventing inventory leakage.`;
        } else if (lowercaseText.includes("price") || lowercaseText.includes("cost") || lowercaseText.includes("plan") || lowercaseText.includes("pricing")) {
          reply = `Veggie POS offers simple, transparent tiers:
• Starter / Counter: ₹799/mo (billed annually) for single counter QSRs & cafés.
• Growth / Full Dine-In: ₹1,499/mo with table layouts, paced KOTs & recipe BOM.
• Multi-Outlet: ₹2,999/mo for multi-location groups.
All plans include free updates and zero hardware lease lock-ins!`;
        } else if (lowercaseText.includes("hardware") || lowercaseText.includes("printer") || lowercaseText.includes("ipad") || lowercaseText.includes("tablet")) {
          reply = `Veggie POS runs in any modern browser on iPads, Android tablets, Windows laptops, MacBooks, and phones. It connects seamlessly with standard 58mm/80mm ESC/POS thermal receipt and kitchen ticket printers over Bluetooth, USB, and LAN/Wi-Fi.`;
        } else if (lowercaseText.includes("login") || lowercaseText.includes("terminal") || lowercaseText.includes("sign in")) {
          reply = `To access your restaurant's billing terminal, click 'Sign In' in the top navigation bar. Enter your Store Code or Restaurant Name once to connect this device, and then your staff can log in using their 4-digit PIN!`;
        }

        setMessages(prev => [
          ...prev,
          {
            id: `msg-ai-${Date.now()}`,
            sender: "ai",
            text: reply,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
      }, 500);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    handleSend(suggestion);
  };

  return (
    <>
      {/* FLOATING TRIGGER BUBBLE */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-[80] p-4 bg-[#181A18] hover:bg-[#6E8F45] text-[#FBF9F5] rounded-full shadow-2xl flex items-center justify-center gap-2.5 transition-all duration-200 hover:scale-105 active:scale-95 group cursor-pointer border border-[#2E332D]"
        id="ai-copilot-trigger-bubble"
        title="Veggie POS AI Assistant"
      >
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#6E8F45] opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-[#84A955]"></span>
        </span>
        <Sparkles className="w-5 h-5 text-[#84A955] group-hover:rotate-12 transition-transform" />
        <span className="text-xs font-bold font-mono max-w-0 overflow-hidden group-hover:max-w-[160px] transition-all duration-300 whitespace-nowrap pl-0 group-hover:pl-1">
          Ask Veggie AI
        </span>
      </button>

      {/* RIGHT SIDE EXPANDABLE COPILOT DRAWER */}
      {isOpen && (
        <div className="fixed inset-0 z-[999] flex justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={() => setIsOpen(false)}
          />

          {/* Drawer Content */}
          <div className="relative w-full sm:w-[440px] bg-[#FBF9F5] h-full shadow-2xl flex flex-col z-10 border-l border-[#EAE5DA] animate-slide-in">
            
            {/* DRAWER HEADER */}
            <div className="p-4 bg-[#181A18] text-[#FBF9F5] flex flex-col shrink-0 border-b border-[#2E332D]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#6E8F45] flex items-center justify-center text-[#FBF9F5] font-extrabold text-sm">
                    🌿
                  </div>
                  <div>
                    <h3 className="font-serif text-sm font-bold tracking-tight flex items-center gap-1.5 text-[#FBF9F5]">
                      Veggie POS AI Assistant
                      <span className="bg-[#6E8F45]/20 text-[#84A955] text-[9px] px-1.5 py-0.5 rounded font-mono font-bold tracking-widest uppercase">AI</span>
                    </h3>
                    <p className="text-[10px] text-[#A6AEA0] font-medium">Platform & Operations Advisor</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-[#2E332D] text-[#A6AEA0] hover:text-[#FBF9F5] transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* CHAT MESSAGES BODY */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#FBF9F5]">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col max-w-[88%] ${msg.sender === "ai" ? "self-start mr-auto" : "self-end ml-auto"}`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[9px] text-[#787F74] font-mono uppercase tracking-wide">
                      {msg.sender === "ai" ? "Veggie AI Assistant" : "You"}
                    </span>
                    <span className="text-[8px] text-[#A6AEA0] font-mono">• {msg.timestamp}</span>
                  </div>
                  <div
                    className={`p-3.5 rounded-2xl text-xs leading-relaxed whitespace-pre-line shadow-xs border ${
                      msg.sender === "ai"
                        ? "bg-[#F4F0E8] text-[#1C1E1B] border-[#EAE5DA] rounded-tl-none font-sans"
                        : "bg-[#181A18] text-[#FBF9F5] border-[#2E332D] rounded-tr-none font-sans"
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="flex flex-col max-w-[85%] self-start mr-auto">
                  <span className="text-[9px] text-[#787F74] font-mono mb-1">VEGGIE AI IS THINKING...</span>
                  <div className="bg-[#F4F0E8] border border-[#EAE5DA] p-3.5 rounded-2xl rounded-tl-none flex items-center gap-2">
                    <span className="w-2 h-2 bg-[#6E8F45] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 bg-[#6E8F45] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 bg-[#6E8F45] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* SUGGESTIONS PILLS */}
            <div className="p-3 bg-[#F4F0E8] border-t border-[#EAE5DA] shrink-0 flex gap-2 overflow-x-auto whitespace-nowrap scrollbar-none">
              <button
                onClick={() => handleSuggestionClick("Veggie POS ke main features kya hain?")}
                className="px-2.5 py-1.5 bg-[#FBF9F5] border border-[#EAE5DA] hover:border-[#6E8F45] rounded-lg text-[10px] text-[#1C1E1B] font-semibold cursor-pointer transition-all"
              >
                Features in Hindi 🇮🇳
              </button>
              <button
                onClick={() => handleSuggestionClick("How does recipe inventory deduction work?")}
                className="px-2.5 py-1.5 bg-[#FBF9F5] border border-[#EAE5DA] hover:border-[#6E8F45] rounded-lg text-[10px] text-[#1C1E1B] font-semibold cursor-pointer transition-all"
              >
                Recipe BOM Stock 📦
              </button>
              <button
                onClick={() => handleSuggestionClick("What are the pricing plans and hardware requirements?")}
                className="px-2.5 py-1.5 bg-[#FBF9F5] border border-[#EAE5DA] hover:border-[#6E8F45] rounded-lg text-[10px] text-[#1C1E1B] font-semibold cursor-pointer transition-all"
              >
                Pricing & Hardware ⚡
              </button>
            </div>

            {/* SEND MESSAGE FIELD */}
            <div className="p-3 border-t border-[#EAE5DA] bg-[#FBF9F5] shrink-0">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Ask anything about Veggie POS or restaurant operations..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  className="flex-1 bg-[#F4F0E8] border border-[#EAE5DA] focus:bg-[#FBF9F5] focus:outline-none focus:border-[#6E8F45] rounded-xl py-2.5 px-3.5 text-xs text-[#1C1E1B]"
                  id="copilot-text-input-field"
                />
                <button
                  onClick={() => handleSend()}
                  className="p-2.5 bg-[#181A18] hover:bg-[#6E8F45] text-[#FBF9F5] rounded-xl transition cursor-pointer"
                  id="copilot-send-button"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
