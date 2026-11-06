# Compatible security migrations

These timestamped repairs protect older manually-created schemas independently of
the complete application migrations in ../migrations/.

- restrict_legacy_public_rpc_access fixes legacy function search paths and limits
  privileged RPC and snapshot access to the server role.
- hash_legacy_staff_pins converts valid plaintext PINs to pgcrypto bcrypt without
  changing the PIN entered at login. Already-hashed values are excluded.
- hash_legacy_json_pins transforms nested valid PIN copies while preserving other
  JSON values and array order. Its temporary helper is removed within the transaction.

The PIN migrations expect pgcrypto in Supabase's extensions schema. JSON tests
isolate transformation behavior; native bcrypt interoperability requires a separate
PostgreSQL check. Provider-specific applied status belongs in the private report.

This directory does not replace numbered application migrations or prove schema 9
readiness. Follow ../DEPLOYMENT.md and inspect existing references before upgrading.
