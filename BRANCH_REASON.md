# Branch reason — Fix 5C: vault data integrity on crashes and write failures

## Problem

`backend/file/file.go` truncates the existing image before steganographically writing a replacement, so process termination or write failure can corrupt the only vault copy. `app.go` also starts database writes in goroutines and returns success before persistence, allowing out-of-order writes and missing error propagation.

## Intended work (deferred)

After a separate design review and approval: make vault updates interruption-safe (such as a validated same-directory temporary-file replacement), serialize database mutations and disk writes in order, surface write errors truthfully, and ensure normal shutdown does not discard pending saves. Preserve existing data format, offline behavior, UX, and supported platforms.

## Scope boundary

Do not make keyring/session-credential changes from 5A or 5B. No implementation changes yet; this branch records the reserved scope.
