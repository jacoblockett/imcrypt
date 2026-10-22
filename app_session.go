package main

import (
	"bytes"
	"fmt"
	"time"

	"imcrypt_v3/backend/crypto"
	"imcrypt_v3/backend/key"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// Snapshot handoff has a short deadline. Authorization is revoked immediately;
// only snapshot encryption may use the remaining key during this interval.
const snapshotGracePeriod = 15 * time.Second
const maxSessionSnapshot = 32 << 20

func (a *App) lockSession(generation uint64) {
	a.authMu.Lock()
	if a.authGeneration != generation || (!a.passwordVerified && !a.vaultUnlocked) {
		a.authMu.Unlock()
		return
	}
	a.authGeneration++
	lockGeneration := a.authGeneration
	a.passwordVerified, a.vaultUnlocked = false, false
	a.aet = nil
	a.snapshotPending = true
	a.snapshotGrace = time.AfterFunc(snapshotGracePeriod, func() {
		a.authMu.Lock()
		defer a.authMu.Unlock()
		if a.authGeneration != lockGeneration || !a.snapshotPending {
			return
		}
		a.snapshotPending = false
		a.snapshotGrace = nil
		_ = key.Delete()
	})
	a.authMu.Unlock()

	runtime.EventsEmit(a.ctx, "e_authlock")
}

// LockSession exposes the same reversible lock without waiting for expiry.
func (a *App) LockSession() []any {
	a.authMu.Lock()
	generation := a.authGeneration
	unlocked := a.vaultUnlocked
	a.authMu.Unlock()
	if !unlocked {
		return []any{"vault is locked"}
	}
	a.lockSession(generation)
	return []any{nil}
}

func (a *App) discardSnapshot() {
	a.authMu.Lock()
	defer a.authMu.Unlock()
	a.snapshot = nil
	a.snapshotID = nil
	a.snapshotPending = false
	if a.snapshotGrace != nil {
		a.snapshotGrace.Stop()
		a.snapshotGrace = nil
	}
}

func snapshotKey(k key.Data) []byte {
	// Never reuse the database encryption key for transient session data.
	purpose := append([]byte("imcrypt:session:v1:"), k.Id...)
	return crypto.GenerateHMAC(purpose, k.Key)
}

// SuspendSession is only available after the backend has already revoked
// normal vault access. It encrypts a working-state snapshot before deleting
// the password-derived credential from the OS keyring.
func (a *App) SuspendSession(plaintext string) []any {
	a.authMu.Lock()
	defer a.authMu.Unlock()

	if !a.snapshotPending || a.vaultUnlocked || a.passwordVerified {
		return []any{"session is not awaiting suspension"}
	}
	defer func() {
		a.snapshotPending = false
		if a.snapshotGrace != nil {
			a.snapshotGrace.Stop()
			a.snapshotGrace = nil
		}
		_ = key.Delete()
	}()
	if len(plaintext) == 0 || len(plaintext) > maxSessionSnapshot {
		return []any{"invalid session snapshot size"}
	}
	k, err := key.Get()
	if err != nil {
		return []any{err.Error()}
	}
	ciphertext, err := crypto.Encrypt([]byte(plaintext), snapshotKey(k))
	if err != nil {
		return []any{err.Error()}
	}
	a.snapshot = ciphertext
	a.snapshotID = bytes.Clone(k.Id)
	return []any{nil}
}

// ResumeSession succeeds only after full master-password and, if configured,
// TOTP authentication. Snapshot contents never reach an unauthenticated page.
func (a *App) ResumeSession() []any {
	a.authMu.Lock()
	defer a.authMu.Unlock()

	if !a.vaultUnlocked || !a.passwordVerified {
		return []any{"vault is locked"}
	}
	if len(a.snapshot) == 0 {
		return []any{nil, ""}
	}
	k, err := key.Get()
	if err != nil {
		return []any{err.Error()}
	}
	if !bytes.Equal(k.Id, a.snapshotID) {
		return []any{"session belongs to a different vault"}
	}
	plaintext, err := crypto.Decrypt(a.snapshot, snapshotKey(k))
	if err != nil {
		return []any{fmt.Sprintf("unable to decrypt saved session: %v", err)}
	}
	a.snapshot = nil
	a.snapshotID = nil
	return []any{nil, string(plaintext)}
}
