package main

import (
	"bytes"
	"fmt"

	"imcrypt_v3/backend/key"
	"imcrypt_v3/backend/storage"
)

// The Go backend owns authentication; frontend route guards are not authority.
func (a *App) authState() (bool, bool) {
	a.authMu.Lock()
	defer a.authMu.Unlock()
	return a.passwordVerified, a.vaultUnlocked
}

func (a *App) setAuth(verified, unlocked bool) {
	a.authMu.Lock()
	defer a.authMu.Unlock()
	a.passwordVerified, a.vaultUnlocked = verified, unlocked
}

func (a *App) invalidateAuth() {
	a.authMu.Lock()
	defer a.authMu.Unlock()
	a.authGeneration++
	a.passwordVerified, a.vaultUnlocked = false, false
	if a.aet != nil {
		a.aet.Stop()
		a.aet = nil
	}
	if a.snapshotGrace != nil {
		a.snapshotGrace.Stop()
		a.snapshotGrace = nil
	}
	a.snapshotPending = false
	_ = key.Delete()
}

// A code validated before expiry must not reauthorize an expired session.
func (a *App) completeSecondFactor() bool {
	a.authMu.Lock()
	defer a.authMu.Unlock()
	if !a.passwordVerified || a.snapshotPending {
		return false
	}
	a.vaultUnlocked = true
	return true
}

func (a *App) requireUnlocked() error {
	_, unlocked := a.authState()
	if !unlocked {
		return fmt.Errorf("vault is locked")
	}
	return nil
}

// The password-only state authorizes only second-factor challenges, not
// database access. It also ensures the image still matches the keyring record.
func (a *App) readPasswordVerifiedStorage() (*storage.Storage, error) {
	verified, _ := a.authState()
	if !verified || a.fd == nil {
		return nil, fmt.Errorf("master password has not been verified")
	}
	store, err := a.fd.ReadImcryptStorage()
	if err != nil {
		return nil, err
	}
	k, err := key.Get()
	if err != nil {
		return nil, err
	}
	if !bytes.Equal(store.Id, k.Id) {
		a.invalidateAuth()
		return nil, fmt.Errorf("storage id does not match key id")
	}
	return store, nil
}
