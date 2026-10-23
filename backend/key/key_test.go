package key

import (
	"bytes"
	"encoding/base64"
	"errors"
	"testing"

	"github.com/zalando/go-keyring"
)

func TestWrappedCredentialRoundTrip(t *testing.T) {
	keyring.MockInit()
	t.Cleanup(func() { _ = Delete() })

	id := []byte("vault-id")
	derived := []byte("password-derived-key")
	if err := Set(id, derived); err != nil {
		t.Fatal(err)
	}
	stored, err := keyring.Get("Imcrypt", "key")
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Contains([]byte(stored), derived) || bytes.Contains([]byte(stored), id) {
		t.Fatal("keyring contains plaintext vault credentials")
	}
	if _, err := base64.StdEncoding.DecodeString(stored); err != nil {
		t.Fatalf("keyring entry is not an encoded encrypted payload: %v", err)
	}

	got, err := Get()
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(got.Id, id) || !bytes.Equal(got.Key, derived) {
		t.Fatalf("retrieved incorrect credential: %#v", got)
	}
}

func TestEachSessionHasFreshWrappingKey(t *testing.T) {
	keyring.MockInit()
	t.Cleanup(func() { _ = Delete() })
	id := []byte("vault-id")
	derived := []byte("same-password-derived-key")
	if err := Set(id, derived); err != nil {
		t.Fatal(err)
	}
	firstKey := sessionKey
	firstEntry, err := keyring.Get("Imcrypt", "key")
	if err != nil {
		t.Fatal(err)
	}

	if err := Set(id, derived); err != nil {
		t.Fatal(err)
	}
	secondEntry, err := keyring.Get("Imcrypt", "key")
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Equal(firstKey[:], sessionKey[:]) {
		t.Fatal("session wrapping key was reused")
	}
	if firstEntry == secondEntry {
		t.Fatal("keyring ciphertext was reused")
	}
	if _, err := Get(); err != nil {
		t.Fatal(err)
	}
}

func TestLeftoverKeyringCredentialIsUnusableAfterProcessExit(t *testing.T) {
	keyring.MockInit()
	t.Cleanup(func() { _ = Delete() })
	id := []byte("vault-id")
	derived := []byte("password-derived-key")
	if err := Set(id, derived); err != nil {
		t.Fatal(err)
	}
	stored, err := keyring.Get("Imcrypt", "key")
	if err != nil {
		t.Fatal(err)
	}

	// Simulate process termination without changing the persistent keyring.
	sessionMu.Lock()
	clearSession()
	sessionMu.Unlock()
	if _, err := keyring.Get("Imcrypt", "key"); err != nil {
		t.Fatalf("test unexpectedly deleted leftover credential: %v", err)
	}
	if _, err := Get(); !errors.Is(err, ErrKeyNotFound) {
		t.Fatalf("leftover keyring entry unlocked without process-local key: %v", err)
	}

	if err := Set(id, derived); err != nil {
		t.Fatal(err)
	}
	replaced, err := keyring.Get("Imcrypt", "key")
	if err != nil {
		t.Fatal(err)
	}
	if stored == replaced {
		t.Fatal("fresh login did not replace leftover entry")
	}
	if _, err := Get(); err != nil {
		t.Fatalf("fresh login could not recover: %v", err)
	}
}

func TestDeleteClearsSessionEvenWhenKeyringFails(t *testing.T) {
	keyring.MockInit()
	if err := Set([]byte("vault-id"), []byte("password-derived-key")); err != nil {
		t.Fatal(err)
	}
	providerError := errors.New("credential store unavailable")
	keyring.MockInitWithError(providerError)
	t.Cleanup(keyring.MockInit)

	if err := Delete(); !errors.Is(err, providerError) {
		t.Fatalf("expected OS error, got: %v", err)
	}
	if hasSession || sessionKey != ([32]byte{}) {
		t.Fatal("wrapping key survived a failed OS deletion")
	}
	if _, err := Get(); !errors.Is(err, ErrKeyNotFound) {
		t.Fatalf("deleted process credential remained accessible: %v", err)
	}
}

func TestFailedSetDoesNotLeaveWorkingSession(t *testing.T) {
	keyring.MockInit()
	if err := Set([]byte("old-vault"), []byte("old-key")); err != nil {
		t.Fatal(err)
	}
	failure := errors.New("credential write failed")
	keyring.MockInitWithError(failure)
	t.Cleanup(keyring.MockInit)
	if err := Set([]byte("new-vault"), []byte("new-key")); !errors.Is(err, failure) {
		t.Fatalf("expected keyring write failure, got: %v", err)
	}
	if _, err := Get(); !errors.Is(err, ErrKeyNotFound) {
		t.Fatalf("stale credentials remained usable after failed replacement: %v", err)
	}
}

func TestTamperingRejectsWrappedCredential(t *testing.T) {
	keyring.MockInit()
	t.Cleanup(func() { _ = Delete() })
	if err := Set([]byte("vault-id"), []byte("password-derived-key")); err != nil {
		t.Fatal(err)
	}
	stored, err := keyring.Get("Imcrypt", "key")
	if err != nil {
		t.Fatal(err)
	}
	raw, err := base64.StdEncoding.DecodeString(stored)
	if err != nil {
		t.Fatal(err)
	}
	raw[len(raw)-1] ^= 1
	if err := keyring.Set("Imcrypt", "key", base64.StdEncoding.EncodeToString(raw)); err != nil {
		t.Fatal(err)
	}
	if _, err := Get(); err == nil {
		t.Fatal("tampered keyring credential was accepted")
	}
}
