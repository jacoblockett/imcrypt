# Branch reason — Fix 5B: protection against crash-persistent credentials

## Problem

The current OS keyring can retain an Imcrypt credential after an unexpected process termination, including a credential sufficient to decrypt a captured vault file. Restart cleanup cannot protect the interval before Imcrypt next starts.

## Intended work (deferred)

Investigate and, only after separate approval, implement a portable way to prevent a leftover OS keyring entry from being a directly reusable vault credential. One research candidate is to store a session-wrapped credential in the existing keyring while keeping a fresh wrapping secret process-local, but its realistic memory-dump and crash tradeoffs must be validated first.

Keep password-only, fully offline, cross-platform file portability; preserve Imcrypt's vault format and one-login UX if feasible. Do not claim that copying both a live session's memory and matching ciphertext can be rendered harmless.

## Scope boundary

Do not implement 5A error-handling work or 5C vault-write integrity work here. No implementation changes yet; this branch records the reserved scope.
