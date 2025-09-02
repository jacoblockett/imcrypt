package file

import (
	"bytes"
	"fmt"
	"image"
	"imcrypt_v3/backend/storage"
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
func (f *File) WriteImcryptStorage(storage *storage.Storage) error {
	f.mu.Lock()
	defer f.mu.Unlock()

	gobifiedStorage, err := utils.Gobify(storage)
	if err != nil {
		return err
	}

	f.Seek(0, 0)

	dataBuf, err := io.ReadAll(f)
	if err != nil {
		return err
	}

	f.Truncate(0)
	f.Seek(0, 0)

	err = steg.Encode(bytes.NewReader(dataBuf), bytes.NewReader(gobifiedStorage), f)
	if err != nil {
		return err
	}

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
