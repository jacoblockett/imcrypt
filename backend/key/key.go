package key

import (
	"encoding/json"
	"errors"
	"time"

	"github.com/zalando/go-keyring"
)

var (
	ErrKeyExpired  = errors.New("key has expired")
	ErrKeyNotFound = errors.New("key not found")
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

func Set(id, key []byte) error {
	Delete() // remove stale keys

	created := time.Now().UnixMilli()
	data := Data{
		Id:      id,
		Key:     key,
		Created: created,
	}
	json, err := toJSON(data)
	if err != nil {
		return err
	}

	return keyring.Set("Imcrypt", "key", json)
}

func Get() (Data, error) {
	json, err := keyring.Get("Imcrypt", "key")
	if err != nil {
		return Data{}, ErrKeyNotFound
	}

	data, err := fromJSON(json)
	if err != nil {
		return Data{}, err
	}

	return data, nil
}

func Delete() error {
	return keyring.Delete("Imcrypt", "key")
}
