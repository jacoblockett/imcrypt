package key

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"sync"
	"time"

	"imcrypt_v3/backend/crypto"

	"github.com/zalando/go-keyring"
)

var (
	ErrKeyExpired  = errors.New("key has expired")
	ErrKeyNotFound = errors.New("key not found")

	sessionMu  sync.Mutex
	sessionKey [32]byte
	hasSession bool
)

type Data struct {
	Id      []byte `json:"id"`
	Key     []byte `json:"key"`
	Created int64  `json:"created"`
}

func toJSON(data Data) (string, error) {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return "", err
	}
	return string(jsonData), nil
}

func fromJSON(jsonStr string) (Data, error) {
	var data Data
	err := json.Unmarshal([]byte(jsonStr), &data)
	if err != nil {
		return Data{}, err
	}
	return data, nil
}

// The keyring stores only ciphertext. The key required to unwrap it exists
// exclusively in this process and is replaced for every authenticated session.
func Set(id, key []byte) error {
	wrappingKey, err := crypto.GenerateSalt(len(sessionKey))
	if err != nil {
		return err
	}
	defer clear(wrappingKey)

	data := Data{
		Id:      id,
		Key:     key,
		Created: time.Now().UnixMilli(),
	}
	encoded, err := toJSON(data)
	if err != nil {
		return err
	}
	encrypted, err := crypto.Encrypt([]byte(encoded), wrappingKey)
	if err != nil {
		return err
	}

	sessionMu.Lock()
	defer sessionMu.Unlock()

	clearSession()
	if err := keyring.Set("Imcrypt", "key", base64.StdEncoding.EncodeToString(encrypted)); err != nil {
		return err
	}
	copy(sessionKey[:], wrappingKey)
	hasSession = true
	return nil
}

func Get() (Data, error) {
	sessionMu.Lock()
	defer sessionMu.Unlock()

	if !hasSession {
		return Data{}, ErrKeyNotFound
	}
	encoded, err := keyring.Get("Imcrypt", "key")
	if err != nil {
		return Data{}, ErrKeyNotFound
	}
	encrypted, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return Data{}, err
	}
	decrypted, err := crypto.Decrypt(encrypted, sessionKey[:])
	if err != nil {
		return Data{}, err
	}
	defer clear(decrypted)

	return fromJSON(string(decrypted))
}

func Delete() error {
	sessionMu.Lock()
	defer sessionMu.Unlock()

	// Even if the OS cannot delete the entry, its wrapping key is gone.
	clearSession()
	return keyring.Delete("Imcrypt", "key")
}

func clearSession() {
	clear(sessionKey[:])
	hasSession = false
}
