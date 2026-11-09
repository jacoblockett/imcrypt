# Legacy plaintext CSV export

Use **Export Vault (CSV)** at the bottom of the sidebar while the vault is unlocked.
Choose a local destination in the save dialog. There is no password prompt and no
encryption: the saved file contains readable passwords and TOTP seeds. Keep it
offline and delete it securely after migration.

The exporter rereads the currently unlocked database on the Go side and writes
the CSV to disk without passing its contents through the React frontend. It
does not change the vault. Canceling the dialog creates no file.

## Format

UTF-8 CSV, with one header and three `record_type` values:

- `item`: one row per item, including archived and non-login items.
- `group`: one row per group, including empty groups.
- `settings`: a single row containing the session timeout.

Columns (in order):

```text
record_type,id,created,updated,type,title,archived,email,username,password,password_created,previous_passwords_json,websites_json,two_factor_secret,notes,ruleset_json,name,group_item_ids_json,session_length_ms,record_json
```

- `id` contains the original item or group ID. Groups reference item IDs in
  `group_item_ids_json`, preserving membership and order.
- `previous_passwords_json`, `websites_json`, and `group_item_ids_json`
  contain JSON arrays.
- `ruleset_json` contains the complete JSON ruleset object.
- All other displayed columns are literal text. CSV escaping protects embedded
  commas, quotation marks, and newlines.
- `record_json` is the authoritative full JSON object for the item, group, or
  settings record. A future importer should prefer this column to reconstruct
  the exact values, including CRLF characters that some CSV readers normalize
  in the human-readable columns.
- Dates are stored as original Unix seconds; `session_length_ms` is milliseconds.
- Blank cells are not applicable to that record type.

The export covers the decrypted **database**, not the vault container or
encryption metadata (master password hashes, salts, recovery-code verifier,
or vault sign-in 2FA configuration). Individual login entries' TOTP seeds
are included in `two_factor_secret`. This CSV is a migration format, not
an encrypted vault backup.

An existing corrupted vault that cannot be decrypted cannot be exported by
this feature. Unsaved edits in an open editor are also not included.
