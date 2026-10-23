# Branch reason — Fix 5B: crash-persistent credential protection

## Problem

Imcrypt stores a directly reusable password-derived vault credential in the OS keyring. A crash or forced termination may prevent cleanup; on Windows, the credential is stored persistently. Someone with access to the leftover keyring credential and a matching vault file can decrypt the file without the user's master password. Deletion attempts and startup cleanup do not guarantee that credential is unavailable after a crash.

## Fix

Preserve the existing `key.Set/Get/Delete` API and the cross-platform OS keyring. On each `Set`, generate a fresh random 256-bit process-local wrapping key, encrypt the existing credential using the project's AES-GCM helper, and store only ciphertext in the OS keyring. `Get` unwraps it for authorized database operations. `Delete` drops the process-local wrapping key even if OS credential removal fails. A fresh master-password login replaces any leftover keyring ciphertext without a separate recovery procedure.

## Scope and guarantees

The vault file format, master-password derivation, TOTP, offline portability, UI, and immediate-save behavior remain unchanged. No hardware, network service, new dependency, fallback credential cache, extra password prompts, or new user-facing recovery controls.

The purpose is to make a **keyring-only** credential recovered after process termination insufficient to decrypt a vault. This does **not** protect a matching vault and live process-memory dump captured together, nor guarantee zero traces of keys remain in garbage-collected memory. Multi-instance interactions with the shared OS keyring entry are not redesigned here.

## Acceptance

Validate wrapped-key round trips, fresh key per login, leftover ciphertext after simulated crash, failed OS deletion, failed credential replacement, tampering, password/TOTP authentication, timeout-and-snapshot restoration, and vault operations. Normal login, logout, and crash restart must not gain new friction.
