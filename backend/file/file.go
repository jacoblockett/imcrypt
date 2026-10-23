package file

import (
	"bytes"
	"fmt"
	"image"
	"imcrypt_v3/backend/storage"
	"imcrypt_v3/backend/key"
	"imcrypt_v3/backend/utils"
	"io"
	"os"
	"path/filepath"
	"sync"

	"github.com/DimitarPetrov/stegify/steg"
)

type File struct {
	*os.File
	Path string
	mu   sync.Mutex
}

// Checks if the file is a jpg/png image
func (f *File) IsPNGOrJPG() (bool, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.Seek(0, 0)
	_, format, err := image.DecodeConfig(f)
	if err != nil || (format != "png" && format != "jpeg") {
		return false, nil
	}

	return true, nil
}

// Reads the entire binary into a []byte
func (f *File) ReadAll() ([]byte, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.Seek(0, 0)

	return io.ReadAll(f)
}

// Retrieves the Storage off of the file
func (f *File) ReadImcryptStorage() (*storage.Storage, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.Seek(0, 0)

	var data bytes.Buffer
	err := steg.Decode(f, &data)
	if err != nil {
		return nil, err
	}

	if data.Len() == 0 {
		return nil, fmt.Errorf("no steg data found")
	}

	var storage storage.Storage
	err = utils.Degob(data.Bytes(), &storage)
	if err != nil {
		return nil, err
	}

	return &storage, nil
}

// Writes the Storage onto the file
func (f *File) WriteImcryptStorage(store *storage.Storage) error {
	f.mu.Lock()
	defer f.mu.Unlock()

	gobifiedStorage, err := utils.Gobify(store)
	if err != nil { return err }
	if _, err := f.Seek(0, 0); err != nil { return err }
	original, err := io.ReadAll(f)
	if err != nil { return err }

	// Do all encoding and validation before the destructive in-place write.
	var prepared bytes.Buffer
	if err := steg.Encode(bytes.NewReader(original), bytes.NewReader(gobifiedStorage), &prepared); err != nil {
		return err
	}
	var decoded bytes.Buffer
	if err := steg.Decode(bytes.NewReader(prepared.Bytes()), &decoded); err != nil { return err }
	if !bytes.Equal(decoded.Bytes(), gobifiedStorage) {
		return fmt.Errorf("prepared vault image failed steganographic verification")
	}

	k, err := key.Get()
	if err != nil { return err }
	if err := checkPending(f.Path, k, store.PasswordSalt); err != nil { return err }
	journalPath, err := newJournal(f.Path, original, prepared.Bytes(), store.Id, store.PasswordSalt)
	if err != nil { return err }

	// The synced recovery journal remains on disk if any step below fails.
	if err := f.Truncate(0); err != nil { return err }
	if _, err := f.Seek(0, 0); err != nil { return err }
	n, err := f.Write(prepared.Bytes())
	if err != nil { return err }
	if n != prepared.Len() { return fmt.Errorf("short vault image write") }
	if err := f.Sync(); err != nil { return err }
	if _, err := f.Seek(0, 0); err != nil { return err }
	written, err := io.ReadAll(f)
	if err != nil { return err }
	if !bytes.Equal(written, prepared.Bytes()) { return fmt.Errorf("vault image verification failed") }

	// A cleanup failure leaves a harmless journal of the previous version;
	// checkPending can remove it before the next save.
	_ = os.Remove(journalPath)
	return nil
}

// Checks if the file has Imcrypt storage data
func (f *File) HasStorage() (bool, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.Seek(0, 0)

	var data bytes.Buffer
	err := steg.Decode(f, &data)
	if err != nil {
		return false, err
	}
	if data.Len() == 0 {
		return false, nil
	}

	var storage storage.Storage
	err = utils.Degob(data.Bytes(), &storage)
	if err != nil {
		return false, nil
	}

	return true, nil
}

// Get's the file's filename
func (f *File) GetName() string {
	return filepath.Base(f.Path)
}
