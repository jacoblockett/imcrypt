package main

import (
	"strings"
	"testing"

	"imcrypt_v3/backend/key"

	"github.com/zalando/go-keyring"
)

func TestSuspendedSessionRequiresReauthentication(t *testing.T) {
	keyring.MockInit()
	a := NewApp()
	id := []byte("example-vault")
	pass := []byte("password-derived-key")
	if err := key.Set(id, pass); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = key.Delete() })

	a.authMu.Lock()
	a.snapshotPending = true
	a.authMu.Unlock()
	if got := a.SuspendSession(`{"unfinished":"password"}`); got[0] != nil {
		t.Fatal(got)
	}
	if strings.Contains(string(a.snapshot), "unfinished") {
		t.Fatal("snapshot contains plaintext")
	}
	if _, err := key.Get(); err == nil {
		t.Fatal("key was not deleted after suspension")
	}
	if got := a.ResumeSession(); got[0] == nil {
		t.Fatal("snapshot restored without reauthentication")
	}
	if err := key.Set(id, pass); err != nil {
		t.Fatal(err)
	}
	a.setAuth(true, true)
	got := a.ResumeSession()
	if got[0] != nil || got[1] != `{"unfinished":"password"}` {
		t.Fatalf("unexpected restored data: %#v", got)
	}
	if got := a.ResumeSession(); got[0] != nil || got[1] != "" {
		t.Fatal("snapshot returned twice")
	}
}

func TestSuspendedSessionWrongKeyFails(t *testing.T) {
	keyring.MockInit()
	a := NewApp()
	id := []byte("example-vault")
	if err := key.Set(id, []byte("original-secret")); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = key.Delete() })
	a.snapshotPending = true
	if got := a.SuspendSession("draft"); got[0] != nil {
		t.Fatal(got)
	}
	if err := key.Set(id, []byte("other-secret")); err != nil {
		t.Fatal(err)
	}
	a.setAuth(true, true)
	if got := a.ResumeSession(); got[0] == nil {
		t.Fatal("snapshot decrypted with wrong key")
	}
}

func TestLogoutDiscardsSuspendedSession(t *testing.T) {
	keyring.MockInit()
	a := NewApp()
	id := []byte("example-vault")
	if err := key.Set(id, []byte("derived-key")); err != nil {
		t.Fatal(err)
	}
	a.snapshotPending = true
	if got := a.SuspendSession("unfinished"); got[0] != nil {
		t.Fatal(got)
	}
	a.CloseSession()
	if len(a.snapshot) != 0 || len(a.snapshotID) != 0 {
		t.Fatal("logout preserved suspended session")
	}
	if got := a.ResumeSession(); got[0] == nil {
		t.Fatal("logout left snapshot readable")
	}
}
