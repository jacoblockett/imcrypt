package storage

import (
	"testing"

	"imcrypt_v3/backend/crypto"
	"imcrypt_v3/backend/database"
	"imcrypt_v3/backend/key"
	"imcrypt_v3/backend/utils"

	"github.com/zalando/go-keyring"
)

func TestArgon2idVaultMetadataIsAuthenticated(t *testing.T) {
	keyring.MockInit()
	t.Cleanup(func() { _ = key.Delete() })
	s := &Storage{
		KDFVersion: crypto.KDFArgon2id,
		Id: []byte("argon2id-vault"),
		PasswordSalt: []byte("0123456789abcdef"),
		EncryptionSalt: []byte("fedcba9876543210"),
	}
	passwordKey, err := crypto.PasswordKey([]byte("a"), s.PasswordSalt, s.KDFVersion)
	if err != nil { t.Fatal(err) }
	if err := key.Set(s.Id, passwordKey); err != nil { t.Fatal(err) }
	db := database.NewDatabase()
	if err := s.SetDatabase(&db); err != nil { t.Fatal(err) }
	if _, err := s.GetDatabase(); err != nil { t.Fatalf("new vault roundtrip: %v", err) }

	s.PasswordSalt[0] ^= 1
	if _, err := s.GetDatabase(); err == nil { t.Fatal("tampered password salt was accepted") }
	s.PasswordSalt[0] ^= 1
	s.EncryptionSalt[0] ^= 1
	if _, err := s.GetDatabase(); err == nil { t.Fatal("tampered encryption salt was accepted") }
	s.EncryptionSalt[0] ^= 1
	s.KDFVersion = crypto.KDFLegacy
	if _, err := s.GetDatabase(); err == nil { t.Fatal("KDF downgrade was accepted") }
	s.KDFVersion = 99
	if _, err := s.GetDatabase(); err == nil { t.Fatal("unknown KDF version was accepted") }
}

func TestLegacyVaultDatabaseStillDecrypts(t *testing.T) {
	keyring.MockInit()
	t.Cleanup(func() { _ = key.Delete() })
	s := &Storage{Id: []byte("legacy-vault"), PasswordSalt: []byte("12345678"), EncryptionSalt: []byte("87654321")}
	passwordKey, err := crypto.PasswordKey([]byte("master-password"), s.PasswordSalt, s.KDFVersion)
	if err != nil { t.Fatal(err) }
	if err := key.Set(s.Id, passwordKey); err != nil { t.Fatal(err) }
	db := database.NewDatabase()
	if err := s.SetDatabase(&db); err != nil { t.Fatal(err) }
	if _, err := s.GetDatabase(); err != nil { t.Fatalf("legacy database unreadable: %v", err) }
}

func TestGobWithoutKDFVersionLoadsAsLegacy(t *testing.T) {
	// An image created before this patch has no KDFVersion gob field.
	type oldStorage struct {
		Id []byte
		EncryptionSalt []byte
		PasswordSalt []byte
		EncryptedDatabase []byte
		HMAC []byte
		TwoFactorSecret []byte
		TwoFactorRecoveryHash []byte
		TwoFactorRecoverySalt []byte
		TwoFactorConfirmed []byte
	}
	old := oldStorage{Id: []byte("old-vault"), PasswordSalt: []byte("12345678")}
	raw, err := utils.Gobify(old)
	if err != nil { t.Fatal(err) }
	var loaded Storage
	if err := utils.Degob(raw, &loaded); err != nil { t.Fatal(err) }
	if loaded.KDFVersion != crypto.KDFLegacy || string(loaded.Id) != "old-vault" {
		t.Fatalf("existing gob storage misidentified: %#v", loaded)
	}
}
