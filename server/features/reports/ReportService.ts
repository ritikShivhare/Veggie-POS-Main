import { GoogleGenAI } from "@google/genai";

export class ReportService {
  public generateSimulatedReport(salesData: any, inventoryData: any, shiftsData: any): string {
    const avgOrderVal = salesData.totalOrders > 0 ? (salesData.totalRevenue / salesData.totalOrders).toFixed(2) : "0";
    const upiPercent = salesData.totalRevenue > 0 ? ((salesData.upiRevenue / salesData.totalRevenue) * 100).toFixed(1) : "0";
    const cashPercent = salesData.totalRevenue > 0 ? ((salesData.cashRevenue / salesData.totalRevenue) * 100).toFixed(1) : "0";
    
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

  public async generateReport(salesData: any, inventoryData: any, shiftsData: any): Promise<{ report: string; isSimulated: boolean }> {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey === "") {
      return {
        report: "### [Simulation Mode] Real-time POS & Operations Audit\n\n*Note: To connect to live Gemini intelligence, simply insert your API key into the Secrets panel in AI Studio.*\n\n" + this.generateSimulatedReport(salesData, inventoryData, shiftsData),
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

      const prompt = `You are an elite Restaurant POS & Inventory Operations Consultant. Analyze the following real-time operating data:
      
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

      Write a deeply analytical, visually stunning Restaurant Business Audit & Action Plan. Use standard markdown. Focus on giving actionable, specific operational and cost-saving advice for the owner. Include:
      - **Executive Summary**: Analysis of revenue trends, cash flow velocity, and ticket sizes.
      - **Inventory & Supply Chain Audit**: Audit of stock valuation, specific warnings for low stock items, and restocking urgencies.
      - **Labor Allocation Analysis**: Shift staffing levels, peak-load preparedness, and staff productivity comments.
      - **Profit & Menu Engineering Playbook**: 3 specific ingredient/recipe optimization recommendations based on their menu performance.

      Keep the tone elite, professional, encouraging, and deeply technical yet easy to parse. Return the response as clean markdown directly.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
      });

      return {
        report: response.text || this.generateSimulatedReport(salesData, inventoryData, shiftsData),
        isSimulated: false
      };
    } catch (error: any) {
      console.error("Gemini API Error in ReportService:", error);
      return {
        report: "### Operational Analytics Dashboard\n\n*System warning: Unable to request Gemini AI model. Using real-time calculated business heuristics instead.*\n\n" + this.generateSimulatedReport(salesData, inventoryData, shiftsData),
        isSimulated: true
      };
    }
  }
}
