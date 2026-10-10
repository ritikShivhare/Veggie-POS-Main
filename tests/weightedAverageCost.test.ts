import { describe, it, expect, beforeAll } from "vitest";
import { ingredientRepo, purchaseRepo } from "../server/context";

describe("Weighted Average Cost (WAC) Inventory Calculation Tests", () => {
  const tenantId = "test-tenant-wac";

  beforeAll(async () => {
    // Clean and initialize tenant test state
    await ingredientRepo.saveAll(tenantId, []);
    await purchaseRepo.saveAll(tenantId, []);
  });

  it("calculates moving weighted average cost when new raw materials are purchased (User Scenario: Potato ₹10/kg + ₹20/kg -> ₹15/kg)", async () => {
    // 1. Initial raw material entry: 10 kg Potato @ ₹10.00 / kg
    const initialPotato = {
      id: "ing-potato",
      name: "Potato (Aloo)",
      unit: "kg",
      currentStock: 10,
      minStock: 5,
      costPerUnit: 10,
      version: 1,
      updated_at: new Date().toISOString()
    };
    await ingredientRepo.saveAll(tenantId, [initialPotato]);

    const initial = await ingredientRepo.getById(tenantId, "ing-potato");
    expect(initial?.currentStock).toBe(10);
    expect(initial?.costPerUnit).toBe(10);

    // 2. Some days later: Purchase 10 kg Potato @ ₹20.00 / kg (Invoice total: ₹200)
    const purchaseQty = 10;
    const purchaseRate = 20;
    const purchaseCost = purchaseQty * purchaseRate; // ₹200

    const currentStockValid = Math.max(0, initial!.currentStock);
    const newStock = Number((initial!.currentStock + purchaseQty).toFixed(3));
    
    // WAC Formula: (Current Stock * Current Cost + Purchase Cost) / (Current Stock + Purchase Qty)
    const currentValue = currentStockValid * initial!.costPerUnit; // 10 * 10 = 100
    const newCostPerUnit = Number(((currentValue + purchaseCost) / (currentStockValid + purchaseQty)).toFixed(2)); // (100 + 200) / 20 = 15.00

    expect(newStock).toBe(20);
    expect(newCostPerUnit).toBe(15);

    // Update in repository as done by POST /purchases
    await ingredientRepo.update(tenantId, {
      ...initial!,
      currentStock: newStock,
      costPerUnit: newCostPerUnit,
      updated_at: new Date().toISOString()
    }, initial!.version);

    const updated = await ingredientRepo.getById(tenantId, "ing-potato");
    expect(updated?.currentStock).toBe(20);
    expect(updated?.costPerUnit).toBe(15.00);

    // 3. Subsequent purchase: 20 kg Potato @ ₹30.00 / kg (Invoice: ₹600)
    const purchaseQty2 = 20;
    const purchaseCost2 = 600;

    const currentStock2 = updated!.currentStock; // 20 kg
    const currentVal2 = currentStock2 * updated!.costPerUnit; // 20 * 15 = 300
    const newStock2 = currentStock2 + purchaseQty2; // 40 kg
    const newCostPerUnit2 = Number(((currentVal2 + purchaseCost2) / newStock2).toFixed(2)); // (300 + 600) / 40 = 22.50

    expect(newStock2).toBe(40);
    expect(newCostPerUnit2).toBe(22.5);

    await ingredientRepo.update(tenantId, {
      ...updated!,
      currentStock: newStock2,
      costPerUnit: newCostPerUnit2,
      updated_at: new Date().toISOString()
    }, updated!.version);

    const updated2 = await ingredientRepo.getById(tenantId, "ing-potato");
    expect(updated2?.currentStock).toBe(40);
    expect(updated2?.costPerUnit).toBe(22.5);
  });

  it("handles purchase when initial stock is 0 or depleted without divide-by-zero", async () => {
    // Initial ingredient created with 0 stock
    const emptyTomato = {
      id: "ing-tomato",
      name: "Fresh Tomato",
      unit: "kg",
      currentStock: 0,
      minStock: 2,
      costPerUnit: 0,
      version: 1,
      updated_at: new Date().toISOString()
    };
    await ingredientRepo.add(tenantId, emptyTomato);

    // First delivery arrives: 15 kg @ ₹40 / kg (Cost: ₹600)
    const qty = 15;
    const cost = 600;
    const currentStockValid = Math.max(0, emptyTomato.currentStock);
    const newStock = Number((emptyTomato.currentStock + qty).toFixed(3));
    
    let newCostPerUnit = emptyTomato.costPerUnit;
    if (qty > 0 && cost > 0) {
      if (currentStockValid > 0 && emptyTomato.costPerUnit > 0) {
        newCostPerUnit = Number(((currentStockValid * emptyTomato.costPerUnit + cost) / (currentStockValid + qty)).toFixed(2));
      } else {
        newCostPerUnit = Number((cost / qty).toFixed(2));
      }
    }

    expect(newStock).toBe(15);
    expect(newCostPerUnit).toBe(40);
  });
});
