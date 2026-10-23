package main

import (
	"bytes"
	"time"

	"imcrypt_v3/backend/crypto"
	"imcrypt_v3/backend/key"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

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
	return crypto.GenerateHMAC(append([]byte("imcrypt:session:v1:"), k.Id...), k.Key)
}

// SuspendSession can encrypt one state snapshot during the timeout handoff.
// Vault operations are already unauthorized before this method can be called.
func (a *App) SuspendSession(state string) []any {
	a.authMu.Lock()
	defer a.authMu.Unlock()
	if !a.snapshotPending || a.passwordVerified || a.vaultUnlocked {
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
	if len(state) == 0 || len(state) > maxSessionSnapshot {
		return []any{"invalid session snapshot size"}
	}
	k, err := key.Get()
	if err != nil {
		return []any{err.Error()}
	}
	encrypted, err := crypto.Encrypt([]byte(state), snapshotKey(k))
	if err != nil {
		return []any{err.Error()}
	}
	a.snapshot = encrypted
	a.snapshotID = bytes.Clone(k.Id)
	return []any{nil}
}

// ResumeSession returns the encrypted draft only after full reauthentication.
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
		return []any{"session belongs to another vault"}
	}
	state, err := crypto.Decrypt(a.snapshot, snapshotKey(k))
	if err != nil {
		return []any{err.Error()}
	}
	a.snapshot = nil
	a.snapshotID = nil
	return []any{nil, string(state)}
}
