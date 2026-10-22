package main

import (
	"strings"
	"testing"

	"imcrypt_v3/backend/key"

	"github.com/zalando/go-keyring"
)

func TestSessionSnapshotRequiresReauthentication(t *testing.T) {
	keyring.MockInit()
	a := NewApp()
	id := []byte("vault-identifier")
	pass := []byte("derived-master-password-value")
	if err := key.Set(id, pass); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = key.Delete() })

	a.authMu.Lock()
	a.snapshotPending = true
	a.authMu.Unlock()
	if got := a.SuspendSession(`{"unsavedPassword":"unfinished"}`); got[0] != nil {
		t.Fatalf("suspension failed: %#v", got)
	}
	if strings.Contains(string(a.snapshot), "unfinished") {
		t.Fatal("plain work state remained in the encrypted snapshot")
	}
	if _, err := key.Get(); err == nil {
		t.Fatal("suspension retained the master key in the keyring")
	}
	if got := a.ResumeSession(); got[0] == nil {
		t.Fatalf("snapshot returned without reauthentication: %#v", got)
	}

	if err := key.Set(id, pass); err != nil {
		t.Fatal(err)
	}
	a.setAuth(true, true)
	got := a.ResumeSession()
	if got[0] != nil || got[1] != `{"unsavedPassword":"unfinished"}` {
		t.Fatalf("restored session does not match: %#v", got)
	}
	if restored := a.ResumeSession(); restored[0] != nil || restored[1] != "" {
		t.Fatalf("snapshot was not consumed: %#v", restored)
	}
}

func TestSessionSnapshotRejectsWrongCredential(t *testing.T) {
	keyring.MockInit()
	a := NewApp()
	id := []byte("vault-identifier")
	if err := key.Set(id, []byte("first-master-key")); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = key.Delete() })
	a.snapshotPending = true
	if got := a.SuspendSession("draft"); got[0] != nil {
		t.Fatal(got)
	}
	if err := key.Set(id, []byte("different-master-key")); err != nil {
		t.Fatal(err)
	}
	a.setAuth(true, true)
	if got := a.ResumeSession(); got[0] == nil {
		t.Fatalf("wrong password key restored snapshot: %#v", got)
	}
}

func TestSessionSnapshotCanOnlyBeSubmittedDuringHandoff(t *testing.T) {
	keyring.MockInit()
	a := NewApp()
	if result := a.SuspendSession("anything"); result[0] == nil {
		t.Fatal("unlocked or unrequested snapshot was accepted")
	}
	if result := a.ResumeSession(); result[0] == nil {
		t.Fatal("locked vault returned a snapshot")
	}
}
