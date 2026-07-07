-- VeggiePOS Schema Initialization & Security Configuration

-- 1. Ingredients Table
CREATE TABLE IF NOT EXISTS ingredients (
    id VARCHAR PRIMARY KEY,
    tenant_id VARCHAR NOT NULL,
    name VARCHAR,
    unit VARCHAR,
    "currentStock" NUMERIC,
    "minStock" NUMERIC,
    "costPerUnit" NUMERIC
);
CREATE INDEX IF NOT EXISTS idx_ingredients_tenant_id ON ingredients(tenant_id);
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_all ON ingredients;
CREATE POLICY service_role_all ON ingredients FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 2. Menu Items Table
CREATE TABLE IF NOT EXISTS menu_items (
    id VARCHAR PRIMARY KEY,
    tenant_id VARCHAR NOT NULL,
    name VARCHAR,
    "nameHindi" VARCHAR,
    price NUMERIC,
    category VARCHAR,
    "imageUrl" VARCHAR,
    "isVegetarian" BOOLEAN,
    "isAvailable" BOOLEAN
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
    "ingredientId" VARCHAR,
    "ingredientName" VARCHAR,
    quantity NUMERIC,
    cost NUMERIC,
    supplier VARCHAR,
    "invoiceNumber" VARCHAR
);
CREATE INDEX IF NOT EXISTS idx_purchases_tenant_id ON purchases(tenant_id);
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_all ON purchases;
CREATE POLICY service_role_all ON purchases FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 4. Recipes Table
CREATE TABLE IF NOT EXISTS recipes (
    "menuItemId" VARCHAR PRIMARY KEY,
    tenant_id VARCHAR NOT NULL,
    ingredients JSONB
);
CREATE INDEX IF NOT EXISTS idx_recipes_tenant_id ON recipes(tenant_id);
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_all ON recipes;
CREATE POLICY service_role_all ON recipes FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 5. Staff Table
CREATE TABLE IF NOT EXISTS staff (
    id VARCHAR PRIMARY KEY,
    tenant_id VARCHAR NOT NULL,
    name VARCHAR,
    role VARCHAR,
    pin VARCHAR,
    permissions JSONB,
    avatar VARCHAR
);
CREATE INDEX IF NOT EXISTS idx_staff_tenant_id ON staff(tenant_id);
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_all ON staff;
CREATE POLICY service_role_all ON staff FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 6. Orders Table
CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR PRIMARY KEY,
    tenant_id VARCHAR NOT NULL,
    "orderNumber" VARCHAR,
    date VARCHAR,
    type VARCHAR,
    "tableNo" VARCHAR,
    "customerName" VARCHAR,
    items JSONB,
    subtotal NUMERIC,
    tax NUMERIC,
    total NUMERIC,
    status VARCHAR,
    "paymentMethod" VARCHAR,
    "paidAt" VARCHAR,
    "cashierId" VARCHAR,
    "cashierName" VARCHAR
);
CREATE INDEX IF NOT EXISTS idx_orders_tenant_id ON orders(tenant_id);
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_all ON orders;
CREATE POLICY service_role_all ON orders FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 7. Customers Table
CREATE TABLE IF NOT EXISTS customers (
    id VARCHAR PRIMARY KEY,
    tenant_id VARCHAR NOT NULL,
    name VARCHAR,
    phone VARCHAR,
    email VARCHAR,
    dob VARCHAR,
    anniversary VARCHAR,
    gstin VARCHAR,
    "loyaltyPoints" NUMERIC,
    "comingSince" VARCHAR,
    "lastVisited" VARCHAR,
    "totalVisits" INTEGER,
    "totalSpend" NUMERIC,
    "maxBillAmount" NUMERIC,
    "minBillAmount" NUMERIC
);
CREATE INDEX IF NOT EXISTS idx_customers_tenant_id ON customers(tenant_id);
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_all ON customers;
CREATE POLICY service_role_all ON customers FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 8. Shifts Table
CREATE TABLE IF NOT EXISTS shifts (
    id VARCHAR PRIMARY KEY,
    tenant_id VARCHAR NOT NULL,
    "staffId" VARCHAR,
    "staffName" VARCHAR,
    role VARCHAR,
    "startTime" VARCHAR,
    "endTime" VARCHAR,
    status VARCHAR
);
CREATE INDEX IF NOT EXISTS idx_shifts_tenant_id ON shifts(tenant_id);
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_all ON shifts;
CREATE POLICY service_role_all ON shifts FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 9. Settings Table
CREATE TABLE IF NOT EXISTS settings (
    tenant_id VARCHAR PRIMARY KEY,
    "autoDeductStock" BOOLEAN,
    "blockOrdersIfInsufficient" BOOLEAN,
    "managerCanAddPurchases" BOOLEAN,
    "managerCanEditRecipes" BOOLEAN,
    "kdsSoundAlerts" BOOLEAN,
    "quickPinRequired" BOOLEAN
);
CREATE INDEX IF NOT EXISTS idx_settings_tenant_id ON settings(tenant_id);
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_all ON settings;
CREATE POLICY service_role_all ON settings FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 10. Tenant Objects Table (General loose object configurations)
CREATE TABLE IF NOT EXISTS tenant_objects (
    tenant_id VARCHAR NOT NULL,
    key VARCHAR NOT NULL,
    value JSONB,
    updated_at VARCHAR,
    PRIMARY KEY (tenant_id, key)
);
CREATE INDEX IF NOT EXISTS idx_tenant_objects_tenant_id ON tenant_objects(tenant_id);
ALTER TABLE tenant_objects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_all ON tenant_objects;
CREATE POLICY service_role_all ON tenant_objects FOR ALL TO service_role USING (true) WITH CHECK (true);
