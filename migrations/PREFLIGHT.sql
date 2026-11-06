-- READ ONLY: run against the existing database before migration 008.
-- Every count below must be zero; restore/correct references before upgrading.
-- Missing historical records must not be invented or deleted to pass these checks.
WITH recipe_items AS (
  SELECT r.tenant_id,item
  FROM public.recipes r
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(r.ingredients)='array' THEN r.ingredients ELSE '[]'::jsonb END
  ) AS ingredient(item)
)
SELECT
  (SELECT count(*) FROM public.recipes r WHERE NOT EXISTS (
    SELECT 1 FROM public.menu_items m WHERE m.tenant_id=r.tenant_id AND m.id=r."menuItemId"
  )) AS orphan_recipes,
  (SELECT count(*) FROM recipe_items r WHERE item->>'ingredientId' IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.ingredients i WHERE i.tenant_id=r.tenant_id AND i.id=r.item->>'ingredientId'
  )) AS orphan_recipe_ingredients,
  (SELECT count(*) FROM public.shifts s WHERE s."staffId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.staff f WHERE f.tenant_id=s.tenant_id AND f.id=s."staffId"
  )) AS orphan_shifts,
  (SELECT count(*) FROM public.purchases p WHERE p."ingredientId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.ingredients i WHERE i.tenant_id=p.tenant_id AND i.id=p."ingredientId"
  )) AS orphan_purchases,
  (SELECT count(*) FROM public.orders o WHERE o."cashierId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.staff f WHERE f.tenant_id=o.tenant_id AND f.id=o."cashierId"
  )) AS orphan_order_cashiers,
  (SELECT count(*) FROM (
    SELECT tenant_id,order_id FROM public.payments WHERE status IN ('Completed','Refunded')
    GROUP BY tenant_id,order_id HAVING count(*)>1
  ) duplicate_settlements) AS duplicate_settlements;

-- Inspect only the affected references, without exposing PINs or owner passwords.
SELECT r.tenant_id,r."menuItemId" AS missing_menu_item
FROM public.recipes r WHERE NOT EXISTS (
  SELECT 1 FROM public.menu_items m WHERE m.tenant_id=r.tenant_id AND m.id=r."menuItemId"
);
SELECT s.tenant_id,s.id AS shift_id,s."staffId" AS missing_staff
FROM public.shifts s WHERE s."staffId" IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM public.staff f WHERE f.tenant_id=s.tenant_id AND f.id=s."staffId"
);
