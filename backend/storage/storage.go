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

func (s *Storage) SetDatabase(database *database.Database) error {
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

	encrypted, err := crypto.Encrypt(signed, encryptionKey)
	if err != nil {
		return err
	}

	s.EncryptedDatabase = encrypted
	s.HMAC = crypto.GenerateHMAC(encrypted, encryptionKey)

	return nil
}

func (s *Storage) GetDatabase() (*database.Database, error) {
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

	decrypted, err := crypto.Decrypt(s.EncryptedDatabase, encryptionKey)
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
