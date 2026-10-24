-- Metadata-only fixture for a database created before the checked-in migrations.
-- Contains no production rows, tenant names, credentials or project identifiers.
CREATE TABLE public."customers" (
"id" character varying NOT NULL,
"tenant_id" character varying NOT NULL,
"name" character varying,
"phone" character varying,
"email" character varying,
"dob" character varying,
"anniversary" character varying,
"gstin" character varying,
"loyaltyPoints" numeric,
"comingSince" character varying,
"lastVisited" character varying,
"totalVisits" integer,
"totalSpend" numeric,
"maxBillAmount" numeric,
"minBillAmount" numeric,
"version" integer DEFAULT 1,
"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public."idempotency_keys" (
"id" character varying NOT NULL,
"tenant_id" character varying NOT NULL,
"idempotency_key" character varying NOT NULL,
"status_code" integer NOT NULL,
"response_body" jsonb NOT NULL,
"request_path" character varying,
"request_method" character varying,
"created_at" timestamp with time zone DEFAULT now(),
"updated_at" timestamp with time zone DEFAULT now(),
"version" integer DEFAULT 1);
CREATE TABLE public."ingredients" (
"id" character varying NOT NULL,
"tenant_id" character varying NOT NULL,
"name" character varying,
"unit" character varying,
"currentStock" numeric,
"minStock" numeric,
"costPerUnit" numeric,
"version" integer DEFAULT 1,
"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public."inventory_movements" (
"id" character varying NOT NULL,
"tenant_id" character varying NOT NULL,
"ingredient_id" character varying NOT NULL,
"movement_type" character varying NOT NULL,
"quantity_delta" numeric NOT NULL,
"previous_stock" numeric NOT NULL,
"new_stock" numeric NOT NULL,
"reference_id" character varying,
"reason" character varying,
"performed_by" character varying,
"version" integer DEFAULT 1,
"created_at" timestamp with time zone DEFAULT now(),
"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public."menu_items" (
"id" character varying NOT NULL,
"tenant_id" character varying NOT NULL,
"name" character varying,
"nameHindi" character varying,
"price" numeric,
"category" character varying,
"imageUrl" character varying,
"isVegetarian" boolean,
"isAvailable" boolean,
"version" integer DEFAULT 1,
"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public."order_items" (
"id" character varying NOT NULL,
"tenant_id" character varying NOT NULL,
"order_id" character varying NOT NULL,
"menu_item_id" character varying,
"name" character varying NOT NULL,
"quantity" numeric NOT NULL,
"unit_price" numeric NOT NULL,
"subtotal" numeric NOT NULL,
"tax" numeric DEFAULT 0,
"notes" character varying,
"version" integer DEFAULT 1,
"created_at" timestamp with time zone DEFAULT now(),
"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public."orders" (
"id" character varying NOT NULL,
"tenant_id" character varying NOT NULL,
"orderNumber" character varying,
"date" character varying,
"type" character varying,
"tableNo" character varying,
"customerName" character varying,
"items" jsonb,
"subtotal" numeric,
"tax" numeric,
"total" numeric,
"status" character varying,
"paymentMethod" character varying,
"paidAt" character varying,
"cashierId" character varying,
"cashierName" character varying,
"version" integer DEFAULT 1,
"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public."payments" (
"id" character varying NOT NULL,
"tenant_id" character varying NOT NULL,
"order_id" character varying NOT NULL,
"amount" numeric NOT NULL,
"payment_method" character varying NOT NULL,
"status" character varying DEFAULT 'Completed'::character varying NOT NULL,
"transaction_reference" character varying,
"cashier_id" character varying,
"version" integer DEFAULT 1,
"created_at" timestamp with time zone DEFAULT now(),
"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public."purchases" (
"id" character varying NOT NULL,
"tenant_id" character varying NOT NULL,
"date" character varying,
"ingredientId" character varying,
"ingredientName" character varying,
"quantity" numeric,
"cost" numeric,
"supplier" character varying,
"invoiceNumber" character varying,
"version" integer DEFAULT 1,
"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public."recipes" (
"menuItemId" character varying NOT NULL,
"tenant_id" character varying NOT NULL,
"ingredients" jsonb);
CREATE TABLE public."settings" (
"tenant_id" character varying NOT NULL,
"autoDeductStock" boolean,
"blockOrdersIfInsufficient" boolean,
"managerCanAddPurchases" boolean,
"managerCanEditRecipes" boolean,
"kdsSoundAlerts" boolean,
"quickPinRequired" boolean);
CREATE TABLE public."shifts" (
"id" character varying NOT NULL,
"tenant_id" character varying NOT NULL,
"staffId" character varying,
"staffName" character varying,
"role" character varying,
"startTime" character varying,
"endTime" character varying,
"status" character varying,
"version" integer DEFAULT 1,
"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public."staff" (
"id" character varying NOT NULL,
"tenant_id" character varying NOT NULL,
"name" character varying,
"role" character varying,
"pin" character varying,
"permissions" jsonb,
"avatar" character varying,
"version" integer DEFAULT 1,
"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public."tenant_objects" (
"tenant_id" character varying NOT NULL,
"key" character varying NOT NULL,
"value" jsonb,
"updated_at" character varying);
ALTER TABLE public."customers" ADD CONSTRAINT "customers_pkey" PRIMARY KEY (id);
ALTER TABLE public."idempotency_keys" ADD CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY (id);
ALTER TABLE public."idempotency_keys" ADD CONSTRAINT "unique_tenant_idempotency_key" UNIQUE (tenant_id, idempotency_key);
ALTER TABLE public."ingredients" ADD CONSTRAINT "ingredients_pkey" PRIMARY KEY (id);
ALTER TABLE public."inventory_movements" ADD CONSTRAINT "check_movement_type" CHECK (((movement_type)::text = ANY ((ARRAY['PURCHASE'::character varying, 'SALE_DEDUCTION'::character varying, 'WASTAGE'::character varying, 'MANUAL_ADJUSTMENT'::character varying, 'RETURN'::character varying])::text[])));
ALTER TABLE public."inventory_movements" ADD CONSTRAINT "check_new_stock" CHECK ((new_stock >= (0)::numeric));
ALTER TABLE public."inventory_movements" ADD CONSTRAINT "check_previous_stock" CHECK ((previous_stock >= (0)::numeric));
ALTER TABLE public."inventory_movements" ADD CONSTRAINT "check_quantity_delta" CHECK ((quantity_delta <> (0)::numeric));
ALTER TABLE public."inventory_movements" ADD CONSTRAINT "inventory_movements_pkey" PRIMARY KEY (id);
ALTER TABLE public."inventory_movements" ADD CONSTRAINT "unique_tenant_inventory_movement" UNIQUE (tenant_id, id);
ALTER TABLE public."menu_items" ADD CONSTRAINT "menu_items_pkey" PRIMARY KEY (id);
ALTER TABLE public."order_items" ADD CONSTRAINT "check_order_item_price" CHECK ((unit_price >= (0)::numeric));
ALTER TABLE public."order_items" ADD CONSTRAINT "check_order_item_quantity" CHECK ((quantity > (0)::numeric));
ALTER TABLE public."order_items" ADD CONSTRAINT "check_order_item_subtotal" CHECK ((subtotal >= (0)::numeric));
ALTER TABLE public."order_items" ADD CONSTRAINT "check_order_item_tax" CHECK ((tax >= (0)::numeric));
ALTER TABLE public."order_items" ADD CONSTRAINT "order_items_pkey" PRIMARY KEY (id);
ALTER TABLE public."order_items" ADD CONSTRAINT "unique_tenant_order_item" UNIQUE (tenant_id, order_id, id);
ALTER TABLE public."orders" ADD CONSTRAINT "orders_pkey" PRIMARY KEY (id);
ALTER TABLE public."payments" ADD CONSTRAINT "check_payment_amount" CHECK ((amount >= (0)::numeric));
ALTER TABLE public."payments" ADD CONSTRAINT "check_payment_status" CHECK (((status)::text = ANY ((ARRAY['Pending'::character varying, 'Completed'::character varying, 'Failed'::character varying, 'Refunded'::character varying])::text[])));
ALTER TABLE public."payments" ADD CONSTRAINT "payments_pkey" PRIMARY KEY (id);
ALTER TABLE public."payments" ADD CONSTRAINT "unique_tenant_payment" UNIQUE (tenant_id, id);
ALTER TABLE public."purchases" ADD CONSTRAINT "purchases_pkey" PRIMARY KEY (id);
ALTER TABLE public."recipes" ADD CONSTRAINT "recipes_pkey" PRIMARY KEY ("menuItemId");
ALTER TABLE public."settings" ADD CONSTRAINT "settings_pkey" PRIMARY KEY (tenant_id);
ALTER TABLE public."shifts" ADD CONSTRAINT "shifts_pkey" PRIMARY KEY (id);
ALTER TABLE public."staff" ADD CONSTRAINT "staff_pkey" PRIMARY KEY (id);
ALTER TABLE public."tenant_objects" ADD CONSTRAINT "tenant_objects_pkey" PRIMARY KEY (tenant_id, key);
ALTER TABLE public."inventory_movements" ADD CONSTRAINT "inventory_movements_ingredient_id_fkey" FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE public."inventory_movements" ADD CONSTRAINT "inventory_movements_performed_by_fkey" FOREIGN KEY (performed_by) REFERENCES staff(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE public."order_items" ADD CONSTRAINT "order_items_menu_item_id_fkey" FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE public."order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE public."payments" ADD CONSTRAINT "payments_cashier_id_fkey" FOREIGN KEY (cashier_id) REFERENCES staff(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE public."payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE public."customers" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public."customers" TO service_role;
ALTER TABLE public."idempotency_keys" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public."idempotency_keys" TO service_role;
ALTER TABLE public."ingredients" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public."ingredients" TO service_role;
ALTER TABLE public."inventory_movements" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public."inventory_movements" TO service_role;
ALTER TABLE public."menu_items" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public."menu_items" TO service_role;
ALTER TABLE public."order_items" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public."order_items" TO service_role;
ALTER TABLE public."orders" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public."orders" TO service_role;
ALTER TABLE public."payments" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public."payments" TO service_role;
ALTER TABLE public."purchases" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public."purchases" TO service_role;
ALTER TABLE public."recipes" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public."recipes" TO service_role;
ALTER TABLE public."settings" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public."settings" TO service_role;
ALTER TABLE public."shifts" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public."shifts" TO service_role;
ALTER TABLE public."staff" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public."staff" TO service_role;
ALTER TABLE public."tenant_objects" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public."tenant_objects" TO service_role;
-- Existing installations may never have created set_tenant_context().
