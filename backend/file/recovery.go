package file

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"os"
	"path/filepath"
	"strings"
	"time"

	"imcrypt_v3/backend/crypto"
	"imcrypt_v3/backend/key"
	"imcrypt_v3/backend/utils"
)

// A journal contains a complete, encrypted pre-write carrier image. The only
// unencrypted bytes are the salts and AES-GCM nonce/ciphertext.
const journalPrefix = "~"
const journalNameBytes = 16
const journalPasswordSaltSize = 8
const journalKeySaltSize = 16
const journalHeaderSize = journalPasswordSaltSize + journalKeySaltSize

type Recovery struct {
	Version int
	Name string
	VaultID []byte
	Created int64
	Original []byte
	Before [32]byte
	After [32]byte
}

type RecoveryInfo struct {
	Name string `json:"name"`
	Created int64 `json:"created"`
	State string `json:"state"`
}

// A random extensionless filename reveals no association with the carrier.
func IsJournal(path string) bool {
	name := filepath.Base(path)
	if len(name) != len(journalPrefix)+journalNameBytes*2 || !strings.HasPrefix(name, journalPrefix) {
		return false
	}
	_, err := hex.DecodeString(name[len(journalPrefix):])
	return err == nil
}

func Candidates(path string) ([]string, error) {
	entries, err := os.ReadDir(filepath.Dir(path))
	if err != nil {
		return nil, err
	}
	var result []string
	for _, entry := range entries {
		if !entry.IsDir() && IsJournal(entry.Name()) {
			result = append(result, filepath.Join(filepath.Dir(path), entry.Name()))
		}
	}
	return result, nil
}

func decodeJournal(raw, passwordKey []byte) (*Recovery, error) {
	if len(raw) < journalHeaderSize+12+16 {
		return nil, fmt.Errorf("invalid recovery journal")
	}
	keySalt := raw[journalPasswordSaltSize:journalHeaderSize]
	encryptionKey, err := crypto.Hash(passwordKey, keySalt)
	if err != nil {
		return nil, err
	}
	defer clear(encryptionKey)
	plain, err := crypto.Decrypt(raw[journalHeaderSize:], encryptionKey)
	if err != nil {
		return nil, err
	}
	defer clear(plain)
	var journal Recovery
	if err := utils.Degob(plain, &journal); err != nil {
		return nil, err
	}
	if journal.Version != 1 || journal.Name == "" || journal.Name != filepath.Base(journal.Name) ||
		journal.Name == "." || journal.Name == ".." || len(journal.Original) == 0 ||
		sha256.Sum256(journal.Original) != journal.Before {
		return nil, fmt.Errorf("invalid recovery journal contents")
	}
	if _, _, err := image.DecodeConfig(bytes.NewReader(journal.Original)); err != nil {
		return nil, fmt.Errorf("invalid original image in recovery journal: %w", err)
	}
	return &journal, nil
}

func journalWithPassword(path, password string) (*Recovery, error) {
	raw, err := os.ReadFile(path)
	if err != nil { return nil, err }
	if len(raw) < journalHeaderSize+12+16 { return nil, fmt.Errorf("invalid recovery journal") }
	passwordKey, err := crypto.Hash([]byte(password), raw[:journalPasswordSaltSize])
	if err != nil { return nil, err }
	defer clear(passwordKey)
	return decodeJournal(raw, passwordKey)
}

func journalWithKey(path string, k key.Data, passwordSalt []byte) (*Recovery, error) {
	raw, err := os.ReadFile(path)
	if err != nil { return nil, err }
	if len(raw) < journalHeaderSize || !bytes.Equal(raw[:journalPasswordSaltSize], passwordSalt) {
		return nil, fmt.Errorf("journal does not match the vault password salt")
	}
	return decodeJournal(raw, k.Key)
}

func newJournal(path string, oldImage, newImage []byte, storeID, passwordSalt []byte) (string, error) {
	if len(passwordSalt) != journalPasswordSaltSize { return "", fmt.Errorf("invalid vault password salt") }
	k, err := key.Get()
	if err != nil { return "", err }
	if !bytes.Equal(k.Id, storeID) { return "", fmt.Errorf("journal vault ID does not match session") }
	salt, err := crypto.GenerateSalt(journalKeySaltSize)
	if err != nil { return "", err }
	encryptionKey, err := crypto.Hash(k.Key, salt)
	if err != nil { return "", err }
	defer clear(encryptionKey)
	meta := Recovery{
		Version: 1, Name: filepath.Base(path), VaultID: bytes.Clone(storeID),
		Created: time.Now().Unix(), Original: oldImage,
		Before: sha256.Sum256(oldImage), After: sha256.Sum256(newImage),
	}
	plain, err := utils.Gobify(meta)
	if err != nil { return "", err }
	defer clear(plain)
	encrypted, err := crypto.Encrypt(plain, encryptionKey)
	if err != nil { return "", err }
	raw := make([]byte, 0, journalHeaderSize+len(encrypted))
	raw = append(raw, passwordSalt...)
	raw = append(raw, salt...)
	raw = append(raw, encrypted...)

	nonce, err := crypto.GenerateSalt(journalNameBytes)
	if err != nil { return "", err }
	journalPath := filepath.Join(filepath.Dir(path), journalPrefix+hex.EncodeToString(nonce))
	f, err := os.OpenFile(journalPath, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600)
	if err != nil { return "", err }
	success := false
	defer func() {
		_ = f.Close()
		if !success { _ = os.Remove(journalPath) }
	}()
	n, err := f.Write(raw)
	if err == nil && n != len(raw) { err = fmt.Errorf("short recovery journal write") }
	if err == nil { err = f.Sync() }
	if err == nil { err = f.Close() }
	if err != nil { return "", err }
	// Do not touch the original until the persisted journal authenticates.
	verify, err := journalWithKey(journalPath, k, passwordSalt)
	if err != nil { return "", err }
	if verify.Name != meta.Name || verify.Before != meta.Before || verify.After != meta.After ||
		!bytes.Equal(verify.VaultID, storeID) {
		return "", fmt.Errorf("recovery journal verification failed")
	}
	success = true
	return journalPath, nil
}

// Never replace an unresolved recovery journal or discard one the user
// explicitly chose to retain.
func checkPending(path string, k key.Data, passwordSalt []byte) error {
	candidates, err := Candidates(path)
	if err != nil { return err }
	for _, candidate := range candidates {
		j, err := journalWithKey(candidate, k, passwordSalt)
		if err != nil || j.Name != filepath.Base(path) || !bytes.Equal(j.VaultID, k.Id) { continue }
		return fmt.Errorf("unresolved recovery journal exists for this image; reopen it and resolve recovery before saving")
	}
	return nil
}

// FindRecovery opens a directly selected journal, or discovers the matching
// authenticated journal in the selected image's directory.
func FindRecovery(path, password string) (string, *Recovery, error) {
	if IsJournal(path) {
		j, err := journalWithPassword(path, password)
		return path, j, err
	}
	candidates, err := Candidates(path)
	if err != nil { return "", nil, err }
	for _, candidate := range candidates {
		j, err := journalWithPassword(candidate, password)
		if err == nil && j.Name == filepath.Base(path) { return candidate, j, nil }
	}
	return "", nil, nil
}

func RecoveryState(path string, journal *Recovery) string {
	raw, err := os.ReadFile(path)
	if os.IsNotExist(err) { return "missing" }
	if err != nil { return "unreadable" }
	digest := sha256.Sum256(raw)
	switch digest {
	case journal.Before: return "original"
	case journal.After: return "completed"
	default: return "different"
	}
}

// RestoreRecovery recovers the exact pre-write image. The journal remains
// available until the replacement is synced and byte-for-byte verified.
func RestoreRecovery(journalPath, password string) (string, error) {
	if !IsJournal(journalPath) { return "", fmt.Errorf("invalid recovery journal path") }
	j, err := journalWithPassword(journalPath, password)
	if err != nil { return "", err }
	path := filepath.Join(filepath.Dir(journalPath), j.Name)
	flags := os.O_RDWR
	if info, statErr := os.Lstat(path); os.IsNotExist(statErr) {
		flags |= os.O_CREATE | os.O_EXCL
	} else if statErr != nil {
		return "", statErr
	} else if !info.Mode().IsRegular() {
		return "", fmt.Errorf("recovery target is not a regular file")
	}
	f, err := os.OpenFile(path, flags, 0600)
	if err != nil { return "", err }
	if err = f.Truncate(0); err == nil {
		_, err = f.WriteAt(j.Original, 0)
	}
	if err == nil { err = f.Sync() }
	closeErr := f.Close()
	if err == nil { err = closeErr }
	if err != nil { return "", err }
	raw, err := os.ReadFile(path)
	if err != nil { return "", err }
	if sha256.Sum256(raw) != j.Before { return "", fmt.Errorf("restored image verification failed") }
	if err := os.Remove(journalPath); err != nil { return "", err }
	return path, nil
}

// RemoveRecovery only deletes an authenticated journal on explicit request.
func RemoveRecovery(journalPath, password string) error {
	if !IsJournal(journalPath) { return fmt.Errorf("invalid recovery journal path") }
	if _, err := journalWithPassword(journalPath, password); err != nil { return err }
	return os.Remove(journalPath)
}
