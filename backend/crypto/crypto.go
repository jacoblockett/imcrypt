package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"errors"
	"image"
	"io"

	"github.com/pquerna/otp/totp"
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

	unsealed, err := gcm.Open(nil, nonce, sealed, nil)
	if err != nil {
		return nil, err
	}

	return unsealed, nil
}

// Encrypts data using the given key
func Encrypt(payload, key []byte) ([]byte, error) {
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

	sealed := gcm.Seal(nil, nonce, payload, nil)
	result := append(nonce, sealed...)

	return result, nil
}
