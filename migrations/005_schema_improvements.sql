-- Migration 005: Schema Improvements, Constraints, Ledgers & Relational Integrity
-- 1. order_items table
-- 2. payments table
-- 3. inventory_movements ledger
-- 4. created_at / updated_at / version across all tables
-- 5. Foreign keys with cascading/set-null behavior
-- 6. CHECK constraints for price, quantity, stock
-- 7. Composite unique keys per tenant

-- =========================================================================
-- 1. Audit Columns (created_at, updated_at, version) on Existing Tables
-- =========================================================================
ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

ALTER TABLE purchases ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

ALTER TABLE recipes ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

ALTER TABLE staff ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE staff ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE staff ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE orders ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

ALTER TABLE customers ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE customers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE customers ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

ALTER TABLE shifts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

ALTER TABLE settings ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE settings ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

-- =========================================================================
-- 2. New Table: order_items
-- Normalized relational table for items belonging to an order
-- =========================================================================
CREATE TABLE IF NOT EXISTS order_items (
    id VARCHAR PRIMARY KEY,
    tenant_id VARCHAR NOT NULL,
    order_id VARCHAR NOT NULL,
    menu_item_id VARCHAR,
    name VARCHAR NOT NULL,
    quantity NUMERIC NOT NULL,
    unit_price NUMERIC NOT NULL,
    subtotal NUMERIC NOT NULL,
    tax NUMERIC DEFAULT 0,
    notes VARCHAR,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    version INTEGER DEFAULT 1,
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

-- =========================================================================
-- 3. New Table: payments
-- Normalized payment log for tracking order payments, splits, UPI, cash, cards
-- =========================================================================
CREATE TABLE IF NOT EXISTS payments (
    id VARCHAR PRIMARY KEY,
    tenant_id VARCHAR NOT NULL,
    order_id VARCHAR NOT NULL,
    amount NUMERIC NOT NULL,
    payment_method VARCHAR NOT NULL,
    status VARCHAR NOT NULL DEFAULT 'Completed',
    transaction_reference VARCHAR,
    cashier_id VARCHAR,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    version INTEGER DEFAULT 1,
    CONSTRAINT check_payment_amount CHECK (amount >= 0),
    CONSTRAINT check_payment_status CHECK (status IN ('Pending', 'Completed', 'Failed', 'Refunded')),
    CONSTRAINT unique_tenant_payment UNIQUE (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_payments_tenant_order ON payments(tenant_id, order_id);
CREATE INDEX IF NOT EXISTS idx_payments_tenant_cashier ON payments(tenant_id, cashier_id);
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_all ON payments;
CREATE POLICY service_role_all ON payments FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =========================================================================
-- 4. New Table: inventory_movements (Stock Ledger)
-- Immutable ledger recording all incoming, outgoing, and adjustment stock events
-- =========================================================================
CREATE TABLE IF NOT EXISTS inventory_movements (
    id VARCHAR PRIMARY KEY,
    tenant_id VARCHAR NOT NULL,
    ingredient_id VARCHAR NOT NULL,
    movement_type VARCHAR NOT NULL,
    quantity_delta NUMERIC NOT NULL,
    previous_stock NUMERIC NOT NULL,
    new_stock NUMERIC NOT NULL,
    reference_id VARCHAR,
    reason VARCHAR,
    performed_by VARCHAR,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    version INTEGER DEFAULT 1,
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

-- =========================================================================
-- 5. Foreign Key Constraints (Idempotent execution with deferrable checks)
-- =========================================================================
DO $$
BEGIN
    -- Foreign key: order_items -> orders
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_order_items_order') THEN
        ALTER TABLE order_items
            ADD CONSTRAINT fk_order_items_order
            FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
    END IF;

    -- Foreign key: order_items -> menu_items
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_order_items_menu_item') THEN
        ALTER TABLE order_items
            ADD CONSTRAINT fk_order_items_menu_item
            FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;
    END IF;

    -- Foreign key: payments -> orders
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_payments_order') THEN
        ALTER TABLE payments
            ADD CONSTRAINT fk_payments_order
            FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
    END IF;

    -- Foreign key: payments -> staff
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_payments_cashier') THEN
        ALTER TABLE payments
            ADD CONSTRAINT fk_payments_cashier
            FOREIGN KEY (cashier_id) REFERENCES staff(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;
    END IF;

    -- Foreign key: inventory_movements -> ingredients
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_inv_movements_ingredient') THEN
        ALTER TABLE inventory_movements
            ADD CONSTRAINT fk_inv_movements_ingredient
            FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
    END IF;

    -- Foreign key: inventory_movements -> staff
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_inv_movements_staff') THEN
        ALTER TABLE inventory_movements
            ADD CONSTRAINT fk_inv_movements_staff
            FOREIGN KEY (performed_by) REFERENCES staff(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;
    END IF;

    -- Foreign key: purchases -> ingredients
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_purchases_ingredient') THEN
        ALTER TABLE purchases
            ADD CONSTRAINT fk_purchases_ingredient
            FOREIGN KEY ("ingredientId") REFERENCES ingredients(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
    END IF;

    -- Foreign key: recipes -> menu_items
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_recipes_menu_item') THEN
        ALTER TABLE recipes
            ADD CONSTRAINT fk_recipes_menu_item
            FOREIGN KEY ("menuItemId") REFERENCES menu_items(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
    END IF;

    -- Foreign key: shifts -> staff
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_shifts_staff') THEN
        ALTER TABLE shifts
            ADD CONSTRAINT fk_shifts_staff
            FOREIGN KEY ("staffId") REFERENCES staff(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
    END IF;

    -- Foreign key: orders -> staff (cashier)
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_orders_cashier') THEN
        ALTER TABLE orders
            ADD CONSTRAINT fk_orders_cashier
            FOREIGN KEY ("cashierId") REFERENCES staff(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;
    END IF;
END $$;

-- =========================================================================
-- 6. CHECK Constraints for Price, Quantity, Stock, and Totals
-- =========================================================================
DO $$
BEGIN
    -- menu_items: price non-negative
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_menu_items_price') THEN
        ALTER TABLE menu_items ADD CONSTRAINT check_menu_items_price CHECK (price >= 0);
    END IF;

    -- ingredients: currentStock non-negative, minStock non-negative, costPerUnit non-negative
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_ingredients_current_stock') THEN
        ALTER TABLE ingredients ADD CONSTRAINT check_ingredients_current_stock CHECK ("currentStock" >= 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_ingredients_min_stock') THEN
        ALTER TABLE ingredients ADD CONSTRAINT check_ingredients_min_stock CHECK ("minStock" >= 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_ingredients_cost_per_unit') THEN
        ALTER TABLE ingredients ADD CONSTRAINT check_ingredients_cost_per_unit CHECK ("costPerUnit" >= 0);
    END IF;

    -- purchases: quantity positive, cost non-negative
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_purchases_quantity') THEN
        ALTER TABLE purchases ADD CONSTRAINT check_purchases_quantity CHECK (quantity > 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_purchases_cost') THEN
        ALTER TABLE purchases ADD CONSTRAINT check_purchases_cost CHECK (cost >= 0);
    END IF;

    -- orders: subtotal non-negative, tax non-negative, total non-negative
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_orders_subtotal') THEN
        ALTER TABLE orders ADD CONSTRAINT check_orders_subtotal CHECK (subtotal >= 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_orders_tax') THEN
        ALTER TABLE orders ADD CONSTRAINT check_orders_tax CHECK (tax >= 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_orders_total') THEN
        ALTER TABLE orders ADD CONSTRAINT check_orders_total CHECK (total >= 0);
    END IF;

    -- customers: loyaltyPoints non-negative, totalSpend non-negative
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_customers_loyalty_points') THEN
        ALTER TABLE customers ADD CONSTRAINT check_customers_loyalty_points CHECK ("loyaltyPoints" >= 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_customers_total_spend') THEN
        ALTER TABLE customers ADD CONSTRAINT check_customers_total_spend CHECK ("totalSpend" >= 0);
    END IF;
END $$;

-- =========================================================================
-- 7. Composite Unique Keys per Tenant
-- =========================================================================
DO $$
BEGIN
    -- orders: unique orderNumber per tenant
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_tenant_order_number') THEN
        ALTER TABLE orders ADD CONSTRAINT unique_tenant_order_number UNIQUE (tenant_id, "orderNumber");
    END IF;

    -- menu_items: unique item name per tenant
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_tenant_menu_item_name') THEN
        ALTER TABLE menu_items ADD CONSTRAINT unique_tenant_menu_item_name UNIQUE (tenant_id, name);
    END IF;

    -- ingredients: unique ingredient name per tenant
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_tenant_ingredient_name') THEN
        ALTER TABLE ingredients ADD CONSTRAINT unique_tenant_ingredient_name UNIQUE (tenant_id, name);
    END IF;

    -- customers: unique phone per tenant
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_tenant_customer_phone') THEN
        ALTER TABLE customers ADD CONSTRAINT unique_tenant_customer_phone UNIQUE (tenant_id, phone);
    END IF;

    -- recipes: unique recipe per tenant and menuItemId
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_tenant_recipe_menu_item') THEN
        ALTER TABLE recipes ADD CONSTRAINT unique_tenant_recipe_menu_item UNIQUE (tenant_id, "menuItemId");
    END IF;
END $$;
