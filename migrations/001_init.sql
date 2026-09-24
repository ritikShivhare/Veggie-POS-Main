-- VeggiePOS Schema Initialization & Security Configuration
-- Comprehensive multi-tenant schema with constraints, foreign keys, audit timestamps, and ledger

-- 1. Ingredients Table
CREATE TABLE IF NOT EXISTS ingredients (
    id VARCHAR PRIMARY KEY,
    tenant_id VARCHAR NOT NULL,
    name VARCHAR NOT NULL,
    unit VARCHAR,
    "currentStock" NUMERIC NOT NULL DEFAULT 0,
    "minStock" NUMERIC NOT NULL DEFAULT 0,
    "costPerUnit" NUMERIC NOT NULL DEFAULT 0,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT check_ingredients_current_stock CHECK ("currentStock" >= 0),
    CONSTRAINT check_ingredients_min_stock CHECK ("minStock" >= 0),
    CONSTRAINT check_ingredients_cost_per_unit CHECK ("costPerUnit" >= 0),
    CONSTRAINT unique_tenant_ingredient_name UNIQUE (tenant_id, name)
);
CREATE INDEX IF NOT EXISTS idx_ingredients_tenant_id ON ingredients(tenant_id);
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_all ON ingredients;
CREATE POLICY service_role_all ON ingredients FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 2. Menu Items Table
CREATE TABLE IF NOT EXISTS menu_items (
    id VARCHAR PRIMARY KEY,
    tenant_id VARCHAR NOT NULL,
    name VARCHAR NOT NULL,
    "nameHindi" VARCHAR,
    price NUMERIC NOT NULL DEFAULT 0,
    category VARCHAR,
    "imageUrl" VARCHAR,
    "isVegetarian" BOOLEAN DEFAULT true,
    "isAvailable" BOOLEAN DEFAULT true,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT check_menu_items_price CHECK (price >= 0),
    CONSTRAINT unique_tenant_menu_item_name UNIQUE (tenant_id, name)
);
CREATE INDEX IF NOT EXISTS idx_menu_items_tenant_id ON menu_items(tenant_id);
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_all ON menu_items;
CREATE POLICY service_role_all ON menu_items FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 3. Purchases Table
CREATE TABLE IF NOT EXISTS purchases (
    id VARCHAR PRIMARY KEY,
    tenant_id VARCHAR NOT NULL,
    date VARCHAR,
    "ingredientId" VARCHAR NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
    "ingredientName" VARCHAR,
    quantity NUMERIC NOT NULL,
    cost NUMERIC NOT NULL DEFAULT 0,
    supplier VARCHAR,
    "invoiceNumber" VARCHAR,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT check_purchases_quantity CHECK (quantity > 0),
    CONSTRAINT check_purchases_cost CHECK (cost >= 0)
);
CREATE INDEX IF NOT EXISTS idx_purchases_tenant_id ON purchases(tenant_id);
CREATE INDEX IF NOT EXISTS idx_purchases_ingredient ON purchases(tenant_id, "ingredientId");
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_all ON purchases;
CREATE POLICY service_role_all ON purchases FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 4. Recipes Table
CREATE TABLE IF NOT EXISTS recipes (
    "menuItemId" VARCHAR PRIMARY KEY REFERENCES menu_items(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
    tenant_id VARCHAR NOT NULL,
    ingredients JSONB,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT unique_tenant_recipe_menu_item UNIQUE (tenant_id, "menuItemId")
);
CREATE INDEX IF NOT EXISTS idx_recipes_tenant_id ON recipes(tenant_id);
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_all ON recipes;
CREATE POLICY service_role_all ON recipes FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 5. Staff Table
CREATE TABLE IF NOT EXISTS staff (
    id VARCHAR PRIMARY KEY,
    tenant_id VARCHAR NOT NULL,
    name VARCHAR NOT NULL,
    role VARCHAR NOT NULL,
    pin VARCHAR,
    permissions JSONB,
    avatar VARCHAR,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_staff_tenant_id ON staff(tenant_id);
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_all ON staff;
CREATE POLICY service_role_all ON staff FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 6. Orders Table
CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR PRIMARY KEY,
    tenant_id VARCHAR NOT NULL,
    "orderNumber" VARCHAR NOT NULL,
    date VARCHAR,
    type VARCHAR,
    "tableNo" VARCHAR,
    "customerName" VARCHAR,
    items JSONB,
    subtotal NUMERIC NOT NULL DEFAULT 0,
    tax NUMERIC NOT NULL DEFAULT 0,
    total NUMERIC NOT NULL DEFAULT 0,
    status VARCHAR,
    "paymentMethod" VARCHAR,
    "paidAt" VARCHAR,
    "cashierId" VARCHAR REFERENCES staff(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
    "cashierName" VARCHAR,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT check_orders_subtotal CHECK (subtotal >= 0),
    CONSTRAINT check_orders_tax CHECK (tax >= 0),
    CONSTRAINT check_orders_total CHECK (total >= 0),
    CONSTRAINT unique_tenant_order_number UNIQUE (tenant_id, "orderNumber")
);
CREATE INDEX IF NOT EXISTS idx_orders_tenant_id ON orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_orders_cashier ON orders(tenant_id, "cashierId");
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_all ON orders;
CREATE POLICY service_role_all ON orders FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 7. Order Items Table
CREATE TABLE IF NOT EXISTS order_items (
    id VARCHAR PRIMARY KEY,
    tenant_id VARCHAR NOT NULL,
    order_id VARCHAR NOT NULL REFERENCES orders(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
    menu_item_id VARCHAR REFERENCES menu_items(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
    name VARCHAR NOT NULL,
    quantity NUMERIC NOT NULL,
    unit_price NUMERIC NOT NULL,
    subtotal NUMERIC NOT NULL,
    tax NUMERIC DEFAULT 0,
    notes VARCHAR,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT check_order_item_quantity CHECK (quantity > 0),
    CONSTRAINT check_order_item_price CHECK (unit_price >= 0),
    CONSTRAINT check_order_item_subtotal CHECK (subtotal >= 0),
    CONSTRAINT check_order_item_tax CHECK (tax >= 0),
    CONSTRAINT unique_tenant_order_item UNIQUE (tenant_id, order_id, id)
);
CREATE INDEX IF NOT EXISTS idx_order_items_tenant_order ON order_items(tenant_id, order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_tenant_menu ON order_items(tenant_id, menu_item_id);
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_all ON order_items;
CREATE POLICY service_role_all ON order_items FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 8. Payments Table
CREATE TABLE IF NOT EXISTS payments (
    id VARCHAR PRIMARY KEY,
    tenant_id VARCHAR NOT NULL,
    order_id VARCHAR NOT NULL REFERENCES orders(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
    amount NUMERIC NOT NULL,
    payment_method VARCHAR NOT NULL,
    status VARCHAR NOT NULL DEFAULT 'Completed',
    transaction_reference VARCHAR,
    cashier_id VARCHAR REFERENCES staff(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT check_payment_amount CHECK (amount >= 0),
    CONSTRAINT check_payment_status CHECK (status IN ('Pending', 'Completed', 'Failed', 'Refunded')),
    CONSTRAINT unique_tenant_payment UNIQUE (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_payments_tenant_order ON payments(tenant_id, order_id);
CREATE INDEX IF NOT EXISTS idx_payments_tenant_cashier ON payments(tenant_id, cashier_id);
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_all ON payments;
CREATE POLICY service_role_all ON payments FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 9. Inventory Movements Ledger
CREATE TABLE IF NOT EXISTS inventory_movements (
    id VARCHAR PRIMARY KEY,
    tenant_id VARCHAR NOT NULL,
    ingredient_id VARCHAR NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
    movement_type VARCHAR NOT NULL,
    quantity_delta NUMERIC NOT NULL,
    previous_stock NUMERIC NOT NULL,
    new_stock NUMERIC NOT NULL,
    reference_id VARCHAR,
    reason VARCHAR,
    performed_by VARCHAR REFERENCES staff(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT check_movement_type CHECK (movement_type IN ('PURCHASE', 'SALE_DEDUCTION', 'WASTAGE', 'MANUAL_ADJUSTMENT', 'RETURN')),
    CONSTRAINT check_quantity_delta CHECK (quantity_delta != 0),
    CONSTRAINT check_previous_stock CHECK (previous_stock >= 0),
    CONSTRAINT check_new_stock CHECK (new_stock >= 0),
    CONSTRAINT unique_tenant_inventory_movement UNIQUE (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_inv_movements_tenant_ingredient ON inventory_movements(tenant_id, ingredient_id);
CREATE INDEX IF NOT EXISTS idx_inv_movements_tenant_reference ON inventory_movements(tenant_id, reference_id);
CREATE INDEX IF NOT EXISTS idx_inv_movements_tenant_created ON inventory_movements(tenant_id, created_at);
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_all ON inventory_movements;
CREATE POLICY service_role_all ON inventory_movements FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 10. Customers Table
CREATE TABLE IF NOT EXISTS customers (
    id VARCHAR PRIMARY KEY,
    tenant_id VARCHAR NOT NULL,
    name VARCHAR,
    phone VARCHAR,
    email VARCHAR,
    dob VARCHAR,
    anniversary VARCHAR,
    gstin VARCHAR,
    "loyaltyPoints" NUMERIC DEFAULT 0,
    "comingSince" VARCHAR,
    "lastVisited" VARCHAR,
    "totalVisits" INTEGER DEFAULT 0,
    "totalSpend" NUMERIC DEFAULT 0,
    "maxBillAmount" NUMERIC DEFAULT 0,
    "minBillAmount" NUMERIC DEFAULT 0,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT check_customers_loyalty_points CHECK ("loyaltyPoints" >= 0),
    CONSTRAINT check_customers_total_spend CHECK ("totalSpend" >= 0),
    CONSTRAINT unique_tenant_customer_phone UNIQUE (tenant_id, phone)
);
CREATE INDEX IF NOT EXISTS idx_customers_tenant_id ON customers(tenant_id);
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_all ON customers;
CREATE POLICY service_role_all ON customers FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 11. Shifts Table
CREATE TABLE IF NOT EXISTS shifts (
    id VARCHAR PRIMARY KEY,
    tenant_id VARCHAR NOT NULL,
    "staffId" VARCHAR REFERENCES staff(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
    "staffName" VARCHAR,
    role VARCHAR,
    "startTime" VARCHAR,
    "endTime" VARCHAR,
    status VARCHAR,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_shifts_tenant_id ON shifts(tenant_id);
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_all ON shifts;
CREATE POLICY service_role_all ON shifts FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 12. Settings Table
CREATE TABLE IF NOT EXISTS settings (
    tenant_id VARCHAR PRIMARY KEY,
    "autoDeductStock" BOOLEAN DEFAULT true,
    "blockOrdersIfInsufficient" BOOLEAN DEFAULT false,
    "managerCanAddPurchases" BOOLEAN DEFAULT true,
    "managerCanEditRecipes" BOOLEAN DEFAULT true,
    "kdsSoundAlerts" BOOLEAN DEFAULT true,
    "quickPinRequired" BOOLEAN DEFAULT true,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_settings_tenant_id ON settings(tenant_id);
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_all ON settings;
CREATE POLICY service_role_all ON settings FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 13. Tenant Objects Table (General loose object configurations)
CREATE TABLE IF NOT EXISTS tenant_objects (
    tenant_id VARCHAR NOT NULL,
    key VARCHAR NOT NULL,
    value JSONB,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (tenant_id, key)
);
CREATE INDEX IF NOT EXISTS idx_tenant_objects_tenant_id ON tenant_objects(tenant_id);
ALTER TABLE tenant_objects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_all ON tenant_objects;
CREATE POLICY service_role_all ON tenant_objects FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 14. Idempotency Table
CREATE TABLE IF NOT EXISTS idempotency_keys (
    id VARCHAR PRIMARY KEY,
    tenant_id VARCHAR NOT NULL,
    idempotency_key VARCHAR NOT NULL,
    status_code INTEGER NOT NULL,
    response_body JSONB NOT NULL,
    request_path VARCHAR,
    request_method VARCHAR,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    version INTEGER DEFAULT 1,
    CONSTRAINT unique_tenant_idempotency_key UNIQUE (tenant_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_idempotency_tenant_key ON idempotency_keys(tenant_id, idempotency_key);
ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_all ON idempotency_keys;
CREATE POLICY service_role_all ON idempotency_keys FOR ALL TO service_role USING (true) WITH CHECK (true);
