package storage

import (
	"bytes"
	"fmt"
	"imcrypt_v3/backend/crypto"
	"imcrypt_v3/backend/database"
	"imcrypt_v3/backend/key"
	"imcrypt_v3/backend/utils"
)

type Storage struct {
	KDFVersion            int
	Id                    []byte
	EncryptionSalt        []byte
	PasswordSalt          []byte
	EncryptedDatabase     []byte
	HMAC                  []byte
	TwoFactorSecret       []byte
	TwoFactorRecoveryHash []byte
	TwoFactorRecoverySalt []byte
	TwoFactorConfirmed    []byte
}

const signature = "imcrypt_v3"

// Legacy vaults have no KDFVersion field in their gob representation.
// Only new vaults authenticate these fields as AES-GCM associated data.
func (s *Storage) associatedData() ([]byte, error) {
	switch s.KDFVersion {
	case crypto.KDFLegacy:
		return nil, nil
	case crypto.KDFArgon2id:
		if len(s.PasswordSalt) != 16 || len(s.EncryptionSalt) != 16 || len(s.Id) == 0 {
			return nil, fmt.Errorf("invalid Argon2id vault metadata")
		}
		data := make([]byte, 0, 24+len(s.Id)+len(s.PasswordSalt)+len(s.EncryptionSalt))
		data = append(data, []byte("imcrypt:vault:argon2id:v1:")...)
		data = append(data, s.Id...)
		data = append(data, s.PasswordSalt...)
		data = append(data, s.EncryptionSalt...)
		return data, nil
	default:
		return nil, fmt.Errorf("unsupported vault KDF version: %d", s.KDFVersion)
	}
}

func (s *Storage) SetDatabase(database *database.Database) error {
	aad, err := s.associatedData()
	if err != nil { return err }
	keyData, err := key.Get()
	if err != nil {
		return err
	}

	if !bytes.Equal(s.Id, keyData.Id) {
		key.Delete()
		return fmt.Errorf("storage id does not match key id")
	}

	encryptionKey, err := crypto.Hash(keyData.Key, s.EncryptionSalt)
	if err != nil {
		return err
	}

	gobbed, err := utils.Gobify(database)
	if err != nil {
		return err
	}

	signed := utils.Sign(gobbed, []byte(signature))

	encrypted, err := crypto.EncryptWithAAD(signed, encryptionKey, aad)
	if err != nil {
		return err
	}

	s.EncryptedDatabase = encrypted
	s.HMAC = crypto.GenerateHMAC(encrypted, encryptionKey)

	return nil
}

func (s *Storage) GetDatabase() (*database.Database, error) {
	aad, err := s.associatedData()
	if err != nil { return nil, err }
	keyData, err := key.Get()
	if err != nil {
		return nil, err
	}

	if !bytes.Equal(s.Id, keyData.Id) {
		key.Delete()
		return nil, fmt.Errorf("storage id does not match key id")
	}

	encryptionKey, err := crypto.Hash(keyData.Key, s.EncryptionSalt)
	if err != nil {
		return nil, err
	}

	decrypted, err := crypto.DecryptWithAAD(s.EncryptedDatabase, encryptionKey, aad)
	if err != nil {
		return nil, fmt.Errorf("unable to decrypt database with given password hash: %v", err)
	}

	hmac := crypto.GenerateHMAC(s.EncryptedDatabase, encryptionKey)
	if !crypto.ValidateHMAC(s.HMAC, hmac) {
		return nil, fmt.Errorf("unable to validate database integrity with given password hash")
	}

	unsigned := utils.Unsign(decrypted, []byte(signature))

	var database database.Database

	err = utils.Degob(unsigned, &database)
	if err != nil {
		return nil, err
	}

	return &database, nil
}
