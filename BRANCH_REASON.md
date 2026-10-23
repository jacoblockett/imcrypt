# Fix 7: Argon2id master-password derivation

New vaults use Argon2id (64 MiB, 3 passes, 4 lanes, 16-byte salt).
Legacy vaults, identified by the absent gob KDFVersion field, continue to use
the original PBKDF2 derivation for reads and writes. No automatic migration
or master-password policy change occurs.

The second PBKDF2 stage is intentionally retained because it operates during
normal vault reads and writes; replacing it with a memory-hard KDF would
introduce repeated latency. The encrypted database authenticates new-format
KDF metadata using AES-GCM associated data.

Recovery journals use their original format for legacy vaults and a distinct
versioned header for Argon2id vaults. Either version remains recoverable
using only the master password, independent of the OS keyring.

This branch-specific rationale must be removed before merging into main.
