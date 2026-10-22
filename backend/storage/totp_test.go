package storage

import (
	"bytes"
	"strings"
	"testing"

	"imcrypt_v3/backend/key"

	"github.com/zalando/go-keyring"
)

func setupTOTPTestKey(t *testing.T) *Storage {
	t.Helper()
	keyring.MockInit()
	s := &Storage{
		Id: []byte("unique-vault"),
		EncryptionSalt: []byte("random-salt-example"),
	}
	if err := key.Set(s.Id, []byte("test-derived-password-hash-32byt")); err != nil {
		t.Fatalf("set test key: %v", err)
	}
	t.Cleanup(func() { _ = key.Delete() })
	return s
}

const testTOTPSeed = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP"

func TestEncryptedTOTPSeedRoundTrip(t *testing.T) {
	s := setupTOTPTestKey(t)
	if err := s.SetTwoFactorSecret(testTOTPSeed); err != nil {
		t.Fatal(err)
	}
	if bytes.Contains(s.TwoFactorSecret, []byte(testTOTPSeed)) {
		t.Fatal("plaintext seed was stored in the image metadata")
	}
	if !bytes.HasPrefix(s.TwoFactorSecret, []byte(twoFactorSecretPrefix)) {
		t.Fatal("encrypted seed missing its format marker")
	}
	if s.HasLegacyTwoFactorSecret() {
		t.Fatal("new seed incorrectly recognized as legacy")
	}
	got, err := s.GetTwoFactorSecret()
	if err != nil || got != testTOTPSeed {
		t.Fatalf("round-trip failed: got %q; err=%v", got, err)
	}
}

func TestEncryptedTOTPSeedRejectsTampering(t *testing.T) {
	s := setupTOTPTestKey(t)
	if err := s.SetTwoFactorSecret(testTOTPSeed); err != nil {
		t.Fatal(err)
	}
	s.TwoFactorSecret[len(s.TwoFactorSecret)-1] ^= 1
	if _, err := s.GetTwoFactorSecret(); err == nil {
		t.Fatal("modified ciphertext was accepted")
	}
}

func TestEncryptedTOTPSeedWrongVaultCredential(t *testing.T) {
	s := setupTOTPTestKey(t)
	if err := s.SetTwoFactorSecret(testTOTPSeed); err != nil {
		t.Fatal(err)
	}
	// A different vault ID must fail before decryption.
	s.Id = []byte("another-vault")
	if _, err := s.GetTwoFactorSecret(); err == nil {
		t.Fatal("wrong vault ID unexpectedly decrypted the TOTP seed")
	}
}

func TestEncryptedTOTPSeedWrongPasswordKey(t *testing.T) {
	s := setupTOTPTestKey(t)
	if err := s.SetTwoFactorSecret(testTOTPSeed); err != nil {
		t.Fatal(err)
	}
	if err := key.Set(s.Id, []byte("different-password-derived-value")); err != nil {
		t.Fatal(err)
	}
	if _, err := s.GetTwoFactorSecret(); err == nil {
		t.Fatal("incorrect password-derived key decrypted the TOTP seed")
	}
}

func TestLegacyTOTPSeedMigration(t *testing.T) {
	s := setupTOTPTestKey(t)
	s.TwoFactorSecret = []byte(testTOTPSeed)
	if !s.HasLegacyTwoFactorSecret() {
		t.Fatal("legacy seed not detected")
	}
	legacy, err := s.GetTwoFactorSecret()
	if err != nil || legacy != testTOTPSeed {
		t.Fatalf("legacy seed unreadable: %q, %v", legacy, err)
	}
	if err := s.SetTwoFactorSecret(legacy); err != nil {
		t.Fatal(err)
	}
	if s.HasLegacyTwoFactorSecret() || bytes.Contains(s.TwoFactorSecret, []byte(testTOTPSeed)) {
		t.Fatal("legacy plaintext remained after migration")
	}
	got, err := s.GetTwoFactorSecret()
	if err != nil || got != testTOTPSeed {
		t.Fatalf("migrated seed invalid: %q, %v", got, err)
	}
}

func TestInvalidTwoFactorSeedFailsClosed(t *testing.T) {
	s := setupTOTPTestKey(t)
	for _, invalid := range []string{"", "not-a-totp-secret", "imcrypt:totp:unknown:12345"} {
		s.TwoFactorSecret = []byte(invalid)
		if _, err := s.GetTwoFactorSecret(); err == nil {
			t.Fatalf("invalid plaintext format accepted: %q", invalid)
		}
	}
	s.TwoFactorSecret = []byte(twoFactorSecretPrefix + strings.Repeat("x", 20))
	if _, err := s.GetTwoFactorSecret(); err == nil {
		t.Fatal("corrupted encrypted seed was accepted as valid")
	}
}
