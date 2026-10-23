package crypto

import (
	"bytes"
	"encoding/hex"
	"testing"
)

func TestPasswordKeyFormats(t *testing.T) {
	password := []byte("master-password")
	legacy, err := PasswordKey(password, []byte("12345678"), KDFLegacy)
	if err != nil { t.Fatal(err) }
	if hex.EncodeToString(legacy) != "61e5e545289be9b244902859bc5f88e190a1cca09f92d286e1177d1ddf97175d" {
		t.Fatal("legacy PBKDF2 derivation changed")
	}

	salt := []byte("0123456789abcdef")
	derived, err := PasswordKey(password, salt, KDFArgon2id)
	if err != nil { t.Fatal(err) }
	if hex.EncodeToString(derived) != "65414679eb51276a55cab0ab5ffd58a4cf4c7b6554c4d2223e7bca323b827b31" {
		t.Fatal("Argon2id derivation changed")
	}
	different, err := PasswordKey([]byte("different"), salt, KDFArgon2id)
	if err != nil { t.Fatal(err) }
	if bytes.Equal(derived, different) { t.Fatal("different passwords derived the same key") }
}

func TestPasswordKeyRejectsInvalidFormats(t *testing.T) {
	for _, test := range []struct {
		version int
		salt []byte
	}{
		{KDFLegacy, []byte("short")},
		{KDFArgon2id, []byte("12345678")},
		{99, []byte("0123456789abcdef")},
	} {
		if _, err := PasswordKey([]byte("a"), test.salt, test.version); err == nil {
			t.Fatalf("accepted invalid KDF metadata for version %d", test.version)
		}
	}
}
