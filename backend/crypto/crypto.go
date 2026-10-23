package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"errors"
	"fmt"
	"image"
	"io"

	"github.com/pquerna/otp/totp"
	"golang.org/x/crypto/argon2"
	"golang.org/x/crypto/pbkdf2"
)

// Generates a new TOTP secret
func GenerateTOTPSecret() (image.Image, string, error) {
	key, err := totp.Generate(totp.GenerateOpts{
		Issuer: "Imcrypt",
	})
	if err != nil {
		return nil, "", err
	}

	im, err := key.Image(200, 200)
	if err != nil {
		return nil, "", err
	}

	return im, key.Secret(), nil
}

// Generates a salt
func GenerateSalt(size int) ([]byte, error) {
	s := make([]byte, size)
	if _, err := rand.Read(s); err != nil {
		return nil, err
	}

	return s, nil
}

// Hashes the given payload with the given salt
func Hash(payload []byte, salt []byte) ([]byte, error) {
	hash := pbkdf2.Key(payload, salt, 100000, 32, sha256.New)

	return hash, nil
}

// Legacy PBKDF2 vaults use KDFLegacy. New vaults use Argon2id.
const (
	KDFLegacy        = 0
	KDFArgon2id      = 1
	argonMemory      = 64 * 1024 // KiB
	argonIterations  = 3
	argonParallelism = 4
)

// PasswordKey derives the master-password credential for a given vault format.
func PasswordKey(password, salt []byte, version int) ([]byte, error) {
	switch version {
	case KDFLegacy:
		if len(salt) != 8 {
			return nil, fmt.Errorf("invalid legacy password salt")
		}
		return Hash(password, salt)
	case KDFArgon2id:
		if len(salt) != 16 {
			return nil, fmt.Errorf("invalid Argon2id password salt")
		}
		return argon2.IDKey(password, salt, argonIterations, argonMemory, argonParallelism, 32), nil
	default:
		return nil, fmt.Errorf("unsupported vault KDF version: %d", version)
	}
}

// Generates an HMAC using the given key
func GenerateHMAC(payload, key []byte) []byte {
	h := hmac.New(sha256.New, key)
	h.Write(payload)

	return h.Sum(nil)
}

// Validates two HMACs
func ValidateHMAC(expected, given []byte) bool {
	return hmac.Equal(expected, given)
}

// Decrypts data using the given key
func Decrypt(payload, key []byte) ([]byte, error) {
	return DecryptWithAAD(payload, key, nil)
}

// DecryptWithAAD authenticates vault metadata in addition to ciphertext.
func DecryptWithAAD(payload, key, aad []byte) ([]byte, error) {
	if len(payload) < 12 {
		return nil, errors.New("cannot parse payload's structure; nonce seems to be corrupted")
	}

	nonce := payload[:12]
	sealed := payload[12:]
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	unsealed, err := gcm.Open(nil, nonce, sealed, aad)
	if err != nil {
		return nil, err
	}

	return unsealed, nil
}

// Encrypts data using the given key
func Encrypt(payload, key []byte) ([]byte, error) {
	return EncryptWithAAD(payload, key, nil)
}

// EncryptWithAAD binds vault metadata to the encrypted database.
func EncryptWithAAD(payload, key, aad []byte) ([]byte, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	nonce := make([]byte, 12)
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, err
	}

	sealed := gcm.Seal(nil, nonce, payload, aad)
	result := append(nonce, sealed...)

	return result, nil
}
