# Branch reason — Fix 5C: interruption-safe vault persistence

## Problem
In-place steganographic image writes truncate the only vault copy before encoding can finish, and ordinary database mutations write on background goroutines, permitting lost updates and premature success responses.

## Fix
Serialize the complete database read–modify–encrypt–save operations. Prepare and verify steganographic output in memory. Before changing the original file, persist an encrypted, authenticated rollback journal containing its complete pre-write image; verify the journal and sync it. Then update, sync, and verify the original image before removing the journal.

Journals are short-lived, use unrelated random extensionless filenames in the original image directory, and contain no recognizable plaintext image signature. Their embedded original filename, vault identifier, creation time, and old/new image hashes are encrypted and authenticated. They can be opened independently with only the master password and used to reconstruct a deleted or damaged image.

When an image is opened and matching encrypted journals exist, require a recovery decision. Declining restoration leads to a separate keep/delete question, with explicit deletion confirmation. A journal the user elects to keep blocks additional writes rather than being silently overwritten.

## Scope
Preserve existing vault format, cryptography, steganography library, OS keyring, offline file portability, and ordinary UI behavior. No new dependencies, separate background worker, permanent backup system, network access, or OS-specific file replacement.

## Validation
Verify round trips, wrong passwords, tamper rejection, incomplete writes, missing original image, journal discovery, refusing unresolved writes, serialized operations, TOTP saves, and Windows Wails integration. Crash recovery cannot promise durability against every storage-device or filesystem failure.
