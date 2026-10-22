package storage

import (
	"bytes"
	"encoding/base32"
	"fmt"
	"strings"

	"imcrypt_v3/backend/crypto"
	"imcrypt_v3/backend/key"
)

// Distinguishes authenticated, encrypted TOTP seeds from legacy raw base32.
// This prefix is also a format marker, not a substitute for AES-GCM integrity.
const twoFactorSecretPrefix = "imcrypt:totp:v1:"

func (s *Storage) twoFactorEncryptionKey() ([]byte, error) {
	keyData, err := key.Get()
	if err != nil {
		return nil, err
	}
	if !bytes.Equal(s.Id, keyData.Id) {
		return nil, fmt.Errorf("storage id does not match key id")
	}

	databaseKey, err := crypto.Hash(keyData.Key, s.EncryptionSalt)
	if err != nil {
		return nil, err
	}

	// Domain separation: never encrypt the TOTP seed directly under the
	// database AES key. Include the vault ID to bind the key to this image.
	purpose := append([]byte("imcrypt:totp:encryption:v1:"), s.Id...)
	return crypto.GenerateHMAC(purpose, databaseKey), nil
}

// SetTwoFactorSecret replaces the raw seed with authenticated AES-GCM
// ciphertext under a vault-specific, domain-separated encryption key.
func (s *Storage) SetTwoFactorSecret(secret string) error {
	if !validTwoFactorSeed(secret) {
		return fmt.Errorf("invalid two-factor secret")
	}
	encryptionKey, err := s.twoFactorEncryptionKey()
	if err != nil {
		return err
	}
	ciphertext, err := crypto.Encrypt([]byte(secret), encryptionKey)
	if err != nil {
		return err
	}
	s.TwoFactorSecret = append([]byte(twoFactorSecretPrefix), ciphertext...)
	return nil
}

// GetTwoFactorSecret decrypts current seeds and reads legacy plaintext seeds.
// Legacy handling is retained solely to migrate existing images.
func (s *Storage) GetTwoFactorSecret() (string, error) {
	if len(s.TwoFactorSecret) == 0 {
		return "", fmt.Errorf("two-factor secret is missing")
	}
	// Validate session credential even for legacy plaintext data.
	encryptionKey, err := s.twoFactorEncryptionKey()
	if err != nil {
		return "", err
	}

	if bytes.HasPrefix(s.TwoFactorSecret, []byte(twoFactorSecretPrefix)) {
		ciphertext := s.TwoFactorSecret[len(twoFactorSecretPrefix):]
		plaintext, err := crypto.Decrypt(ciphertext, encryptionKey)
		if err != nil {
			return "", fmt.Errorf("unable to decrypt two-factor secret: %w", err)
		}
		if !validTwoFactorSeed(string(plaintext)) {
			return "", fmt.Errorf("decrypted two-factor secret is invalid")
		}
		return string(plaintext), nil
	}

	// Legacy releases serialized the base32 seed directly into the image.
	secret := string(s.TwoFactorSecret)
	if !validTwoFactorSeed(secret) {
		return "", fmt.Errorf("unrecognized two-factor secret format")
	}
	return secret, nil
}

// HasLegacyTwoFactorSecret reports seeds eligible for one-time migration.
// The caller must validate the seed before writing a migrated storage image.
func (s *Storage) HasLegacyTwoFactorSecret() bool {
	return len(s.TwoFactorSecret) != 0 && !bytes.HasPrefix(s.TwoFactorSecret, []byte(twoFactorSecretPrefix))
}

func validTwoFactorSeed(secret string) bool {
	if len(secret) < 16 || len(secret) > 1024 || secret != strings.ToUpper(secret) {
		return false
	}
	_, err := base32.StdEncoding.WithPadding(base32.NoPadding).DecodeString(secret)
	return err == nil
}
