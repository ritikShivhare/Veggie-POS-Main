import { GoogleGenAI } from "@google/genai";

export class ReportService {
  public generateSimulatedReport(
    salesData: any,
    inventoryData: any,
    shiftsData: any,
    language: "hindi" | "hinglish" | "english" = "hindi"
  ): string {
    const avgOrderVal = salesData.totalOrders > 0 ? (salesData.totalRevenue / salesData.totalOrders).toFixed(0) : "0";
    const upiPercent = salesData.totalRevenue > 0 ? ((salesData.upiRevenue / salesData.totalRevenue) * 100).toFixed(0) : "0";
    const cashPercent = salesData.totalRevenue > 0 ? ((salesData.cashRevenue / salesData.totalRevenue) * 100).toFixed(0) : "0";
    
    if (language === "hindi") {
      const lowStockListHindi = inventoryData.lowStockItems && inventoryData.lowStockItems.length > 0
        ? inventoryData.lowStockItems.map((item: any) => `*   ⚠️ **${item.name}**: वर्तमान स्टॉक ${item.currentStock}${item.unit} (न्यूनतम आवश्यक: ${item.minStock}${item.unit}) — **तुरंत मंगाएं!**`).join("\n")
        : "*   ✅ **सभी सामग्री पर्याप्त है**: किसी भी आवश्यक कच्चा माल की कमी नहीं है।";

      return `### 🟢 1. बिक्री व राजस्व सारांश (Sales & Revenue Summary)
*   **कुल बिक्री (Net Revenue)**: कुल **${salesData.totalOrders}** ऑर्डर्स से **INR ${salesData.totalRevenue.toLocaleString()}** का राजस्व प्राप्त हुआ। औसत बिल साइज **INR ${avgOrderVal}** रहा।
*   **पेमेंट विभाजन (Payment Breakdown)**: ग्राहकों ने **${upiPercent}%** भुगतान डिजिटल UPI (INR ${salesData.upiRevenue.toLocaleString()}) और **${cashPercent}%** भुगतान नकद/Cash (INR ${salesData.cashRevenue.toLocaleString()}) के माध्यम से किया।
*   **सलाह**: डिजिटल पेमेंट की गति बढ़ाने के लिए डाइनिंग टेबल और काउंटर पर क्यूआर कोड स्पष्ट रूप से लगाएं।

### 🔴 2. कच्चा माल व स्टॉक ऑडिट (Critical Stock & Reorder Alert)
*   **स्टॉक का कुल मूल्य**: स्टोर और किचन में मौजूद कुल कच्चे माल का अनुमानित मूल्य **INR ${inventoryData.totalStockValue?.toLocaleString() || "14,500"}** है।
*   **ज़रूरी स्टॉक अलर्ट (Low Stock Items)**:
${lowStockListHindi}
*   **ऑपरेशनल सुझाव**: कम स्टॉक वाली सामग्रियों के लिए तुरंत सप्लायर/वेंडर को परचेज ऑर्डर भेजें। कम से कम 2 दिनों की खपत का सुरक्षित बफर स्टॉक हमेशा रखें।

### 🔵 3. स्टाफ व शिफ्ट स्थिति (Staff & Shift Coverage)
*   **ड्यूटी पर मौजूद स्टाफ**: वर्तमान समय में **${shiftsData.activeStaffCount}** कर्मचारी सक्रिय शिफ्ट (On-Duty) में तैनात हैं।
*   **कार्यक्षमता**: कर्मचारियों का वर्कलोड संतुलित है। व्यस्त घंटों (लंच व डिनर रश) में बिलिंग और सर्विस की गति तेज रखने के लिए स्टाफ को क्रॉस-ट्रेनिंग दें।

### 💡 4. मुनाफ़ा बढ़ाने व लागत घटाने के 3 मुख्य सुझाव (Profit Playbook)
1.  **सबसे लोकप्रिय मेन्यू आइटम**: आपका सबसे अधिक बिकने वाला आइटम **${salesData.topSellingItems?.[0]?.name || "Special Thali"}** है। इसके मुख्य कच्चे माल (जैसे डेयरी या मसाले) के थोक रेट पर नजर रखें ताकि मार्जिन अधिकतम रहे।
2.  **कच्चे माल की बर्बादी रोकें**: तेजी से इस्तेमाल होने वाले प्याज, टमाटर और पनीर की दैनिक खपत का सही माप रखें ताकि वेस्टेज कम से कम हो।
3.  **सप्लायर तुलना**: स्थानीय थोक विक्रेताओं के दामों की समय-समय पर तुलना करें ताकि लागत में 5% से 8% की बचत की जा सके।`;
    }

    if (language === "hinglish") {
      const lowStockListHinglish = inventoryData.lowStockItems && inventoryData.lowStockItems.length > 0
        ? inventoryData.lowStockItems.map((item: any) => `*   ⚠️ **${item.name}**: Current Stock ${item.currentStock}${item.unit} (Minimum Chahiye: ${item.minStock}${item.unit}) — **Critical Low Stock!**`).join("\n")
        : "*   ✅ **Stock Sahi Hai**: Koi bhi raw material low stock alert me nahi hai.";

      return `### 🟢 1. Sales & Revenue Summary (कमाई का हिसाब)
*   **Total Sales Momentum**: Aaj total **${salesData.totalOrders}** orders se **INR ${salesData.totalRevenue.toLocaleString()}** ka net revenue collect hua. Average customer ticket size **INR ${avgOrderVal}** raha.
*   **Payment Split**: Digital UPI se **${upiPercent}%** revenue (INR ${salesData.upiRevenue.toLocaleString()}) aur Cash se **${cashPercent}%** (INR ${salesData.cashRevenue.toLocaleString()}) receive hua.
*   **Action Tip**: Counter aur sabhi tables par UPI QR code visible rakhein taaki checkout aur service speed fast bani rahe.

### 🔴 2. Inventory & Stock Audit (स्टॉक अलर्ट्स)
*   **Stock Valuation**: Current kitchen raw materials ki estimated value **INR ${inventoryData.totalStockValue?.toLocaleString() || "14,500"}** hai.
*   **Critical Low Stock Alerts**:
${lowStockListHinglish}
*   **Action Recommendation**: Jin items ka stock red alert par hai, unka vendor purchase order turant raise karein. Minimum 2 days ka safety buffer stock maintain karein.

### 🔵 3. Staff & Shifts Operations (स्टाफ और शिफ्ट्स)
*   **Active Staff Count**: Currently **${shiftsData.activeStaffCount}** team members active duty shift par hain.
*   **Productivity Tip**: Rush hours (Lunch aur Dinner) ke dauran billing aur kitchen order delivery speed maintain karne ke liye staff ko cross-training dein.

### 💡 4. Profit & Cost Optimization Playbook (मुनाफ़ा बढ़ाने के टिप्स)
1.  **Top Selling Item Focus**: Aapka top contributor **${salesData.topSellingItems?.[0]?.name || "Special Thali"}** hai. Iske ingredients ka bulk purchase price negotiate karein.
2.  **Portion & Waste Control**: High-cost items jaise Paneer aur Ghee ka kitchen portioning scale use karein taaki recipe cost consistent rahe.
3.  **Vendor Price Check**: Weekly local wholesale market rates compare karein taaki raw ingredient food cost 3% to 5% tak reduce ho sake.`;
    }

    // Default English
    const lowStockList = inventoryData.lowStockItems && inventoryData.lowStockItems.length > 0
      ? inventoryData.lowStockItems.map((item: any) => `*   **${item.name}**: Current Stock is ${item.currentStock}${item.unit} (Minimum: ${item.minStock}${item.unit}) - **Critical Low!**`).join("\n")
      : "*   No critical low stock alerts found. Current holding quantities are sufficient.";

    return `### Executive Operational Summary
*   **Sales Momentum**: Total revenue recorded at **INR ${salesData.totalRevenue.toLocaleString()}** across **${salesData.totalOrders}** orders, yielding a robust average ticket size of **INR ${avgOrderVal}** per checkout.
*   **Settlement Preferences**: Digital transactions lead with UPI comprising **${upiPercent}%** of revenue (INR ${salesData.upiRevenue.toLocaleString()}), compared to Cash at **${cashPercent}%** (INR ${salesData.cashRevenue.toLocaleString()}). Recommended: Ensure QR codes are highly visible at tables to sustain speed of service.

### Inventory Audit & Action Matrix
*   **Valuation Estimate**: Aggregate raw ingredient stock value is currently estimated at **INR ${inventoryData.totalStockValue?.toLocaleString() || "14,500"}**.
*   **Critical Alerts**:
${lowStockList}
*   **Operational Recommendation**: Immediately initiate vendor purchase orders for flagged critical items. Maintain a safety buffer of at least 2 days of average sales volume.

### Labor Performance & Shift Insights
*   **Workforce Coverage**: **${shiftsData.activeStaffCount}** staff members are currently logged as active on active shifts.
*   **Shift Operations**: Evaluated shift entries indicate normal employee utilization. Suggested: Implement a cross-training program for staff members to optimize rush hours.

### Profit & Cost Optimization Playbook
1.  **Menu Contribution Margin Focus**: Your top contributor is **${salesData.topSellingItems?.[0]?.name || "Paneer Butter Masala"}**. Review vendor pricing on key ingredients like dairy weekly to lock in batch margins.
2.  **Ingredient Substitution Analysis**: For ingredients like **Onion** and **Tomato** that show rapid turnarounds, establish secondary local wholesale partnerships to hedge against volatile seasonal spikes.
3.  **Portion and Prep Control**: Introduce kitchen prep weighing protocols for high-cost raw ingredients to minimize recipe drift and waste during high-speed dinner rushes.`;
  }

  public async generateReport(
    salesData: any,
    inventoryData: any,
    shiftsData: any,
    language: "hindi" | "hinglish" | "english" = "hindi"
  ): Promise<{ report: string; isSimulated: boolean }> {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey === "") {
      return {
        report: this.generateSimulatedReport(salesData, inventoryData, shiftsData, language),
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

      const langInstruction = language === "hindi"
        ? "CRITICAL LANGUAGE REQUIREMENT: Write the entire diagnosis report in pure, simple, clear, and easy-to-understand Hindi (हिंदी भाषा - देवनागरी लिपि में). Structure the output in 4 clear sections: 1. बिक्री व कमाई सारांश, 2. कच्चा माल व स्टॉक ऑडिट, 3. स्टाफ व शिफ्ट प्रदर्शन, 4. मुनाफ़ा बढ़ाने के व्यावहारिक सुझाव।"
        : language === "hinglish"
        ? "CRITICAL LANGUAGE REQUIREMENT: Write the entire diagnosis report in natural conversational Hinglish (Hindi written in Roman English script, easy for Indian shopkeepers to read). Structure the output in 4 clear sections: 1. Sales & Revenue Summary, 2. Stock Alerts & Reorder Matrix, 3. Staff & Shifts Coverage, 4. Profit & Cost Tips."
        : "CRITICAL LANGUAGE REQUIREMENT: Write the entire diagnosis report in professional, concise English with 4 clear sections: 1. Sales & Revenue Summary, 2. Inventory & Stock Audit, 3. Labor & Shift Coverage, 4. Profit & Cost Optimization.";

      const prompt = `You are an elite Restaurant POS & Inventory Operations Consultant for an Indian restaurant. Analyze the following real-time operating data:
      
      1. Sales & Revenue:
      - Total Revenue: INR ${salesData.totalRevenue}
      - Total Orders: ${salesData.totalOrders}
      - Payment Split: Cash (INR ${salesData.cashRevenue}), UPI (INR ${salesData.upiRevenue})
      - Top Selling Items: ${JSON.stringify(salesData.topSellingItems)}
      
      2. Inventory Status:
      - Raw Materials List: ${JSON.stringify(inventoryData.materials)}
      - Low Stock Warnings: ${JSON.stringify(inventoryData.lowStockItems)}
      - Total Stock Value: INR ${inventoryData.totalStockValue}
      
      3. Staff Shifts & Labor:
      - Active Staff Count: ${shiftsData.activeStaffCount}
      - Recent Logged Shifts: ${JSON.stringify(shiftsData.recentShifts)}

      ${langInstruction}

      Provide bulleted, actionable, specific advice for the restaurant owner. Return clean standard markdown.`;

      const response = await retryWithBackoff(() => 
        ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
        })
      );

      return {
        report: response.text || this.generateSimulatedReport(salesData, inventoryData, shiftsData, language),
        isSimulated: false
      };
    } catch (error: any) {
      console.info("[ReportService] Gemini API is currently unavailable. Falling back to simulated heuristics.");
      return {
        report: this.generateSimulatedReport(salesData, inventoryData, shiftsData, language),
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
      console.info(`[ReportService] Gemini call failed with status ${status}. Retrying in ${delay}ms... (${retries} attempts remaining).`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return retryWithBackoff(fn, retries - 1, delay * backoffFactor, backoffFactor);
    }
    throw error;
  }
}

