-- Hash numeric PIN copies in legacy JSON without changing business records,
-- array order, existing hashes, or unrelated string fields.
-- Requires Supabase's pgcrypto extension in the extensions schema.
BEGIN;
CREATE FUNCTION public.hash_legacy_json_pins(payload jsonb) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE field record; result jsonb; updated_value jsonb;
BEGIN
  IF jsonb_typeof(payload)='array' THEN
    SELECT COALESCE(jsonb_agg(public.hash_legacy_json_pins(value) ORDER BY ordinal),'[]'::jsonb)
    INTO result FROM jsonb_array_elements(payload) WITH ORDINALITY AS elements(value,ordinal);
    RETURN result;
  ELSIF jsonb_typeof(payload)='object' THEN
    result:='{}'::jsonb;
    FOR field IN SELECT key,value FROM jsonb_each(payload) LOOP
      IF field.key IN ('pin','ownerPin','managerPin')
         AND jsonb_typeof(field.value)='string'
         AND field.value #>> '{}' ~ '^[0-9]{4,6}$' THEN
        updated_value:=to_jsonb(extensions.crypt(field.value #>> '{}',extensions.gen_salt('bf',10)));
      ELSE
        updated_value:=public.hash_legacy_json_pins(field.value);
      END IF;
      result:=result || jsonb_build_object(field.key,updated_value);
    END LOOP;
    RETURN result;
  END IF;
  RETURN payload;
END $$;
REVOKE ALL ON FUNCTION public.hash_legacy_json_pins(jsonb) FROM PUBLIC,anon,authenticated;
UPDATE public.tenant_objects SET value=public.hash_legacy_json_pins(value)
WHERE jsonb_path_exists(value,'$.**.pin ? (@ like_regex "^[0-9]{4,6}$")')
   OR jsonb_path_exists(value,'$.**.ownerPin ? (@ like_regex "^[0-9]{4,6}$")')
   OR jsonb_path_exists(value,'$.**.managerPin ? (@ like_regex "^[0-9]{4,6}$")');
DO $$ BEGIN
  IF to_regclass('public.restaurant_sync') IS NOT NULL THEN
    UPDATE public.restaurant_sync SET data=public.hash_legacy_json_pins(data)
    WHERE jsonb_path_exists(data,'$.**.pin ? (@ like_regex "^[0-9]{4,6}$")')
       OR jsonb_path_exists(data,'$.**.ownerPin ? (@ like_regex "^[0-9]{4,6}$")')
       OR jsonb_path_exists(data,'$.**.managerPin ? (@ like_regex "^[0-9]{4,6}$")');
  END IF;
END $$;
DROP FUNCTION public.hash_legacy_json_pins(jsonb);
COMMIT;
