-- ONLY veggi Pos (zeebnbkqfueprhwjfhbs), after all app writers are stopped.
-- Authorized dummy-data cleanup; backup verification waived by owner.
-- This is an operator-run script, NOT an automatic schema migration.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
DO $guard$
BEGIN
  IF public.deployment_schema_version() IS DISTINCT FROM 9 THEN
    RAISE EXCEPTION 'Expected deployment schema version 9';
  END IF;
END;
$guard$;
LOCK TABLE public.payments, public.order_items, public.inventory_movements,
 public.purchases, public.recipes, public.shifts, public.orders, public.customers,
 public.ingredients, public.menu_items, public.staff, public.settings,
 public.idempotency_keys, public.tenant_objects, public.tenant_revisions
 IN ACCESS EXCLUSIVE MODE;
SELECT 'BEFORE' AS checkpoint,
 (SELECT count(*) FROM public.staff) AS staff,
 (SELECT count(*) FROM public.orders) AS orders,
 (SELECT count(*) FROM public.tenant_objects) AS tenant_objects;
DELETE FROM public.payments;
DELETE FROM public.order_items;
DELETE FROM public.inventory_movements;
DELETE FROM public.purchases;
DELETE FROM public.recipes;
DELETE FROM public.shifts;
DELETE FROM public.orders;
DELETE FROM public.customers;
DELETE FROM public.ingredients;
DELETE FROM public.menu_items;
DELETE FROM public.staff;
DELETE FROM public.settings;
DELETE FROM public.idempotency_keys;
DELETE FROM public.tenant_objects;
-- Optional retired full-state sync table, absent on fresh installations.
DO $legacy$
BEGIN
 IF to_regclass('public.restaurant_sync') IS NOT NULL THEN
   DELETE FROM public.restaurant_sync;
 END IF;
END;
$legacy$;
-- Delete revisions LAST: the DELETE triggers above increment them.
DELETE FROM public.tenant_revisions;
DO $verify$
DECLARE t text; remaining bigint;
BEGIN
 FOREACH t IN ARRAY ARRAY['payments','order_items','inventory_movements','purchases',
 'recipes','shifts','orders','customers','ingredients','menu_items','staff','settings',
 'idempotency_keys','tenant_objects','tenant_revisions'] LOOP
  EXECUTE format('SELECT count(*) FROM public.%I',t) INTO remaining;
  IF remaining <> 0 THEN RAISE EXCEPTION 'Cleanup incomplete: % has % rows',t,remaining; END IF;
 END LOOP;
END;
$verify$;
SELECT 'AFTER' AS checkpoint,
 (SELECT count(*) FROM public.staff) AS staff,
 (SELECT count(*) FROM public.orders) AS orders,
 (SELECT count(*) FROM public.tenant_objects) AS tenant_objects,
 (SELECT count(*) FROM public.tenant_revisions) AS tenant_revisions,
 public.deployment_schema_version() AS schema_version;
COMMIT;
