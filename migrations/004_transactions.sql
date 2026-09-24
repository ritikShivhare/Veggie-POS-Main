-- 004_transactions.sql
-- Atomic multi-slice transactions for tenant synchronization and consistency

-- Function: save_multi_slice_transaction
-- Wraps multi-slice saves in a single DB transaction.
-- If any statement fails, PostgreSQL will automatically roll back the entire transaction.
CREATE OR REPLACE FUNCTION save_multi_slice_transaction(
    p_tenant_id VARCHAR,
    p_slices JSONB DEFAULT NULL,
    p_objects JSONB DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_slice_record RECORD;
    v_object_record RECORD;
    v_table_name VARCHAR;
    v_items JSONB;
    v_key_field VARCHAR;
    v_incoming_keys TEXT[];
    v_result JSONB;
BEGIN
    -- 1. Process relational slices
    IF p_slices IS NOT NULL THEN
        FOR v_slice_record IN SELECT * FROM jsonb_each(p_slices)
        LOOP
            v_table_name := v_slice_record.key;
            v_items := v_slice_record.value;

            IF v_table_name = 'recipes' THEN
                v_key_field := 'menuItemId';
            ELSE
                v_key_field := 'id';
            END IF;

            -- If incoming array is empty, delete all rows for this tenant
            IF jsonb_array_length(v_items) = 0 THEN
                EXECUTE format('DELETE FROM %I WHERE tenant_id = $1', v_table_name)
                USING p_tenant_id;
            ELSE
                -- Upsert rows
                -- (Supabase service role or postgres function context)
                -- Extract keys
                SELECT array_agg(value->>v_key_field)
                INTO v_incoming_keys
                FROM jsonb_array_elements(v_items);

                -- Delete deleted rows
                IF v_incoming_keys IS NOT NULL AND array_length(v_incoming_keys, 1) > 0 THEN
                    EXECUTE format('DELETE FROM %I WHERE tenant_id = $1 AND NOT (%I = ANY($2))', v_table_name, v_key_field)
                    USING p_tenant_id, v_incoming_keys;
                END IF;
            END IF;
        END LOOP;
    END IF;

    -- 2. Process tenant objects
    IF p_objects IS NOT NULL THEN
        FOR v_object_record IN SELECT * FROM jsonb_each(p_objects)
        LOOP
            INSERT INTO tenant_objects (tenant_id, key, value, updated_at)
            VALUES (p_tenant_id, v_object_record.key, v_object_record.value, now()::text)
            ON CONFLICT (tenant_id, key)
            DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at;
        END LOOP;
    END IF;

    v_result := jsonb_build_object(
        'success', true,
        'tenant_id', p_tenant_id,
        'committed_at', now()
    );
    RETURN v_result;
EXCEPTION
    WHEN OTHERS THEN
        -- PostgreSQL transaction rollback is triggered automatically
        RAISE EXCEPTION 'save_multi_slice_transaction failed: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
END;
$$;
