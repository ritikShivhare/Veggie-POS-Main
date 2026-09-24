import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { Database } from "../server/features/shared/database";

describe("Schema Improvements, Constraints & Relational Integrity", () => {
  const initSqlPath = path.resolve(process.cwd(), "migrations/001_init.sql");
  const migration005Path = path.resolve(process.cwd(), "migrations/005_schema_improvements.sql");

  const initSql = fs.readFileSync(initSqlPath, "utf-8");
  const migration005Sql = fs.readFileSync(migration005Path, "utf-8");

  it("should define order_items table with required constraints in migrations", () => {
    expect(initSql).toContain("CREATE TABLE IF NOT EXISTS order_items");
    expect(initSql).toContain("REFERENCES orders(id)");
    expect(initSql).toContain("check_order_item_quantity CHECK (quantity > 0)");
    expect(initSql).toContain("check_order_item_price CHECK (unit_price >= 0)");
    expect(initSql).toContain("unique_tenant_order_item UNIQUE (tenant_id, order_id, id)");

    expect(migration005Sql).toContain("CREATE TABLE IF NOT EXISTS order_items");
    expect(migration005Sql).toContain("CHECK (quantity > 0)");
    expect(migration005Sql).toContain("CHECK (unit_price >= 0)");
    expect(migration005Sql).toContain("UNIQUE (tenant_id, order_id, id)");
  });

  it("should define payments table with status and amount checks in migrations", () => {
    expect(initSql).toContain("CREATE TABLE IF NOT EXISTS payments");
    expect(initSql).toContain("REFERENCES orders(id)");
    expect(initSql).toContain("check_payment_amount CHECK (amount >= 0)");
    expect(initSql).toContain("check_payment_status CHECK (status IN ('Pending', 'Completed', 'Failed', 'Refunded'))");
    expect(initSql).toContain("unique_tenant_payment UNIQUE (tenant_id, id)");

    expect(migration005Sql).toContain("CREATE TABLE IF NOT EXISTS payments");
    expect(migration005Sql).toContain("CHECK (amount >= 0)");
    expect(migration005Sql).toContain("unique_tenant_payment");
  });

  it("should define inventory_movements ledger with movement_type and delta constraints", () => {
    expect(initSql).toContain("CREATE TABLE IF NOT EXISTS inventory_movements");
    expect(initSql).toContain("REFERENCES ingredients(id)");
    expect(initSql).toContain("check_movement_type CHECK (movement_type IN ('PURCHASE', 'SALE_DEDUCTION', 'WASTAGE', 'MANUAL_ADJUSTMENT', 'RETURN'))");
    expect(initSql).toContain("check_quantity_delta CHECK (quantity_delta != 0)");
    expect(initSql).toContain("check_previous_stock CHECK (previous_stock >= 0)");
    expect(initSql).toContain("check_new_stock CHECK (new_stock >= 0)");
    expect(initSql).toContain("unique_tenant_inventory_movement UNIQUE (tenant_id, id)");

    expect(migration005Sql).toContain("CREATE TABLE IF NOT EXISTS inventory_movements");
    expect(migration005Sql).toContain("CHECK (quantity_delta != 0)");
  });

  it("should include audit columns (created_at, updated_at, version) across all tenant tables", () => {
    const requiredTables = [
      "ingredients",
      "menu_items",
      "purchases",
      "recipes",
      "staff",
      "orders",
      "customers",
      "shifts",
      "settings",
      "order_items",
      "payments",
      "inventory_movements"
    ];

    for (const table of requiredTables) {
      expect(initSql).toMatch(new RegExp(`CREATE TABLE IF NOT EXISTS ${table}[\\s\\S]*?created_at`));
      expect(initSql).toMatch(new RegExp(`CREATE TABLE IF NOT EXISTS ${table}[\\s\\S]*?updated_at`));
      expect(initSql).toMatch(new RegExp(`CREATE TABLE IF NOT EXISTS ${table}[\\s\\S]*?version`));
    }
  });

  it("should include price, quantity, and stock CHECK constraints", () => {
    expect(initSql).toContain("check_menu_items_price CHECK (price >= 0)");
    expect(initSql).toContain("check_ingredients_current_stock CHECK (\"currentStock\" >= 0)");
    expect(initSql).toContain("check_ingredients_min_stock CHECK (\"minStock\" >= 0)");
    expect(initSql).toContain("check_purchases_quantity CHECK (quantity > 0)");
    expect(initSql).toContain("check_purchases_cost CHECK (cost >= 0)");
    expect(initSql).toContain("check_orders_subtotal CHECK (subtotal >= 0)");
    expect(initSql).toContain("check_orders_total CHECK (total >= 0)");
    expect(initSql).toContain("check_customers_loyalty_points CHECK (\"loyaltyPoints\" >= 0)");
  });

  it("should define composite unique keys per tenant", () => {
    expect(initSql).toContain("unique_tenant_order_number UNIQUE (tenant_id, \"orderNumber\")");
    expect(initSql).toContain("unique_tenant_menu_item_name UNIQUE (tenant_id, name)");
    expect(initSql).toContain("unique_tenant_ingredient_name UNIQUE (tenant_id, name)");
    expect(initSql).toContain("unique_tenant_customer_phone UNIQUE (tenant_id, phone)");
    expect(initSql).toContain("unique_tenant_recipe_menu_item UNIQUE (tenant_id, \"menuItemId\")");
  });

  it("should support orderItems, payments, and inventoryMovements in database engine", async () => {
    const db = Database.getInstance();
    const testTenant = "test-tenant-schema-imp";

    // Save order items
    await db.saveSlice(testTenant, "orderItems", [
      { id: "oi-1", orderId: "ord-1", name: "Paneer Tikka", quantity: 2, unitPrice: 250, subtotal: 500, version: 1 }
    ]);
    const items = await db.getSlice(testTenant, "orderItems");
    expect(items).toHaveLength(1);
    expect((items as any)[0].name).toBe("Paneer Tikka");

    // Save payments
    await db.saveSlice(testTenant, "payments", [
      { id: "pay-1", orderId: "ord-1", amount: 500, paymentMethod: "UPI", status: "Completed", version: 1 }
    ]);
    const payments = await db.getSlice(testTenant, "payments");
    expect(payments).toHaveLength(1);
    expect((payments as any)[0].amount).toBe(500);

    // Save inventory movements
    await db.saveSlice(testTenant, "inventoryMovements", [
      {
        id: "mov-1",
        ingredientId: "ing-1",
        movementType: "SALE_DEDUCTION",
        quantityDelta: -200,
        previousStock: 1000,
        newStock: 800,
        version: 1
      }
    ]);
    const movements = await db.getSlice(testTenant, "inventoryMovements");
    expect(movements).toHaveLength(1);
    expect((movements as any)[0].movementType).toBe("SALE_DEDUCTION");
  });
});
