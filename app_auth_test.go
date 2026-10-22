package main

import (
	"strings"
	"testing"

	"imcrypt_v3/backend/database"
)

func expectVaultLocked(t *testing.T, name string, result []any) {
	t.Helper()
	if len(result) == 0 {
		t.Fatalf("%s did not reject access", name)
	}
	msg, ok := result[0].(string)
	if !ok || !strings.Contains(msg, "vault is locked") {
		t.Fatalf("%s unexpectedly succeeded: %#v", name, result)
	}
}

func TestPendingTOTPBlocksBackendVaultAccess(t *testing.T) {
	a := NewApp()
	a.setAuth(true, false)
	expectVaultLocked(t, "GetDatabase", a.GetDatabase())
	expectVaultLocked(t, "InsertItems", a.InsertItems(nil))
	expectVaultLocked(t, "DeleteItems", a.DeleteItemsById(nil))
	expectVaultLocked(t, "ValidatePassword", a.ValidatePassword("x", database.Ruleset{}, nil))
	if auth := a.IsAuthenticated(); len(auth) != 2 || auth[1] != false {
		t.Fatalf("pending TOTP reported authenticated: %#v", auth)
	}
}

func TestSecondFactorCallsRequirePasswordVerification(t *testing.T) {
	a := NewApp()
	for name, result := range map[string][]any{
		"TOTP": a.ValidateTwoFactorCode("123456", true),
		"recovery": a.ValidateTwoFactorRecoveryCode("x"),
		"status": a.HasTwoFactorAuthentication(),
	} {
		if len(result) == 0 || result[0] == nil {
			t.Fatalf("%s allowed an unauthenticated call: %#v", name, result)
		}
	}
}

func TestLogoutRevokesBackendAuthorization(t *testing.T) {
	a := NewApp()
	a.setAuth(true, true)
	if err := a.requireUnlocked(); err != nil {
		t.Fatal(err)
	}
	a.CloseSession()
	if err := a.requireUnlocked(); err == nil {
		t.Fatal("logout preserved vault authorization")
	}
}
