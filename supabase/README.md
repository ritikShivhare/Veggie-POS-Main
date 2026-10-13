# Compatible hosted security repairs

These timestamped migrations are separate from the complete application schema in
`../migrations/`. They can protect an older manually-created database before it is
ready for the breaking tenant-key and atomic-registration upgrade.

| Migration | Purpose | Hosted status on 2026-10-13 |
| --- | --- | --- |
| `20261013041414_restrict_legacy_public_rpc_access.sql` | Server-only legacy RPC execution; fixed function search paths; close public snapshot access | Applied and verified |
| `20261013041918_hash_legacy_staff_pins.sql` | Hash plaintext staff PINs with pgcrypto bcrypt, preserving the entered PIN | Applied and verified: all 31 staff PINs are bcrypt hashes |
| `20261013060807_hash_legacy_json_pins.sql` | Hash nested legacy PIN copies without altering other snapshot fields | Locally tested; not applied: provider returned `Invalid or expired requestState` twice |

The filenames of the two completed repairs match Supabase's actual migration
history. The third filename is a local pending migration created by the CLI.
Do not mark it as applied without running it and verifying the result.

The PIN migrations expect Supabase's existing `pgcrypto` extension in the
`extensions` schema. Already-hashed values are excluded. JSON migration tests
stub the cryptographic function to verify nested data preservation and array order;
native PostgreSQL bcrypt interoperability was checked separately against bcryptjs.

Running only this directory does **not** install deployment schema version 9.
First resolve the old data reported by `../migrations/PREFLIGHT.sql`, then follow
`../DEPLOYMENT.md` to apply application migrations 008 and 009. Do not connect
the old deployed server to the real database while it still has the audited
authentication and authorization flaws.
