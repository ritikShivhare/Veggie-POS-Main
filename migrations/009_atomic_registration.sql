-- Verified signup is one commit across owner, settings and the tenant registry.
BEGIN;
CREATE OR REPLACE FUNCTION register_restaurant(p_token text,p_code_hash text,p_tenant_id text,p_owner_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE challenges jsonb; challenge jsonb; registry jsonb; tenant jsonb; owner jsonb; idx int;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('saas-admin',0));
  PERFORM pg_advisory_xact_lock(hashtextextended('veg-main-001',0));
  SELECT value INTO challenges FROM tenant_objects WHERE tenant_id='saas-admin' AND key='signup_challenges_v2' FOR UPDATE;
  SELECT value,ordinality::int-1 INTO challenge,idx FROM jsonb_array_elements(COALESCE(challenges,'[]'::jsonb)) WITH ORDINALITY WHERE value->>'pendingToken'=p_token;
  IF challenge IS NULL THEN RETURN jsonb_build_object('success',false,'status',400,'error','OTP_EXPIRED'); END IF;
  IF (challenge->>'attempts')::int>=5 THEN RETURN jsonb_build_object('success',false,'status',429,'error','OTP_ATTEMPTS_EXCEEDED'); END IF;
  IF challenge->>'codeHash' IS DISTINCT FROM p_code_hash THEN
    challenges:=jsonb_set(challenges,ARRAY[idx::text,'attempts'],to_jsonb(COALESCE((challenge->>'attempts')::int,0)+1));
    UPDATE tenant_objects SET value=challenges WHERE tenant_id='saas-admin' AND key='signup_challenges_v2';
    RETURN jsonb_build_object('success',false,'status',401,'error','INVALID_OTP');
  END IF;
  IF challenge->'registeredTenant' IS NOT NULL THEN RETURN jsonb_build_object('success',true,'tenant',challenge->'registeredTenant','ownerId',challenge->>'ownerId'); END IF;
  IF (challenge->>'expiresAt')::bigint < (extract(epoch FROM clock_timestamp())*1000)::bigint THEN RETURN jsonb_build_object('success',false,'status',400,'error','OTP_EXPIRED'); END IF;
  IF p_tenant_id IS NULL OR length(p_tenant_id)>120 OR NULLIF(p_owner_id,'') IS NULL THEN RAISE EXCEPTION 'Invalid registration' USING ERRCODE='22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant_id,0));
  tenant:=jsonb_build_object('id',p_tenant_id,'tenantId',p_tenant_id,'storeCode',p_tenant_id,'name',challenge->>'businessName','status','active','created',to_char(now(),'YYYY-MM-DD'),'region',challenge->>'region','ownerName',challenge->>'ownerName','ownerPhone',challenge->>'ownerPhone','email',challenge->>'email');
  INSERT INTO staff(tenant_id,id,name,role,pin,"passwordHash",permissions,status) VALUES(p_tenant_id,p_owner_id,challenge->>'ownerName','Owner',challenge->>'pin',challenge->>'passwordHash','["billing","inventory","reports","settings","staff","orders"]','active');
  INSERT INTO settings(tenant_id,data) VALUES(p_tenant_id,'{"autoDeductStock":true,"blockOrdersIfInsufficient":true,"managerCanAddPurchases":true,"managerCanEditRecipes":true,"kdsSoundAlerts":false,"quickPinRequired":true,"gstPercentage":5}');
  SELECT COALESCE(value,'[]'::jsonb) INTO registry FROM tenant_objects WHERE tenant_id='veg-main-001' AND key='global_tenants_list' FOR UPDATE;
  INSERT INTO tenant_objects(tenant_id,key,value) VALUES('veg-main-001','global_tenants_list',COALESCE(registry,'[]'::jsonb)||jsonb_build_array(tenant)) ON CONFLICT(tenant_id,key) DO UPDATE SET value=EXCLUDED.value;
  challenge:=challenge||jsonb_build_object('registeredTenant',tenant,'ownerId',p_owner_id);
  challenges:=jsonb_set(challenges,ARRAY[idx::text],challenge);
  UPDATE tenant_objects SET value=challenges WHERE tenant_id='saas-admin' AND key='signup_challenges_v2';
  RETURN jsonb_build_object('success',true,'tenant',tenant,'ownerId',p_owner_id);
END $$;
REVOKE ALL ON FUNCTION register_restaurant(text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION register_restaurant(text,text,text,text) TO service_role;
CREATE OR REPLACE FUNCTION deployment_schema_version() RETURNS integer LANGUAGE sql SECURITY INVOKER SET search_path=public,pg_temp AS $$ SELECT 9; $$;
REVOKE ALL ON FUNCTION deployment_schema_version() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION deployment_schema_version() TO service_role;
COMMIT;
