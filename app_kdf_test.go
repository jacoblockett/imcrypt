package main

import (
	"bytes"
	"image"
	"image/color"
	"image/png"
	"os"
	"path/filepath"
	"testing"

	"imcrypt_v3/backend/crypto"
	"imcrypt_v3/backend/database"
	"imcrypt_v3/backend/file"
	"imcrypt_v3/backend/key"
	"imcrypt_v3/backend/storage"

	"github.com/zalando/go-keyring"
)

func kdfTestApp(t *testing.T) *App {
	t.Helper()
	keyring.MockInit()
	path := filepath.Join(t.TempDir(), "vault.png")
	img := image.NewRGBA(image.Rect(0, 0, 120, 120))
	for y := 0; y < 120; y++ {
		for x := 0; x < 120; x++ {
			img.Set(x, y, color.RGBA{R: 160, G: 130, B: 110, A: 255})
		}
	}
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil { t.Fatal(err) }
	if err := os.WriteFile(path, buf.Bytes(), 0600); err != nil { t.Fatal(err) }
	f, err := os.OpenFile(path, os.O_RDWR, 0600)
	if err != nil { t.Fatal(err) }
	a := NewApp()
	a.fd = &file.File{File: f, Path: path}
	t.Cleanup(func() { a.CloseSession() })
	return a
}

func TestArgon2idNewVaultStillAllowsAnyNonemptyPassword(t *testing.T) {
	a := kdfTestApp(t)
	if result := a.InitializeStorage("a"); len(result) != 0 { t.Fatalf("create: %#v", result) }
	store, err := a.fd.ReadImcryptStorage()
	if err != nil { t.Fatal(err) }
	if store.KDFVersion != crypto.KDFArgon2id || len(store.PasswordSalt) != 16 ||
		len(store.EncryptionSalt) != 16 {
		t.Fatalf("unexpected new vault format: %#v", store)
	}
	a.invalidateAuth()
	if result := a.UnlockLoadedImage("wrong"); len(result) == 0 || result[0] == nil {
		t.Fatal("new vault accepted incorrect password")
	}
	if result := a.UnlockLoadedImage("a"); len(result) == 0 || result[0] != nil {
		t.Fatalf("new vault failed to unlock: %#v", result)
	}
	if result := a.GetDatabase(); len(result) < 2 || result[0] != nil {
		t.Fatalf("new vault database unreadable: %#v", result)
	}
}

func TestLegacyPBKDF2ImageStillUnlocks(t *testing.T) {
	a := kdfTestApp(t)
	store := &storage.Storage{
		Id: []byte("old-vault"), PasswordSalt: []byte("12345678"),
		EncryptionSalt: []byte("87654321"),
	}
	passwordKey, err := crypto.PasswordKey([]byte("master-password"), store.PasswordSalt, crypto.KDFLegacy)
	if err != nil { t.Fatal(err) }
	if err := key.Set(store.Id, passwordKey); err != nil { t.Fatal(err) }
	db := database.NewDatabase()
	db.Settings.SessionLength = 600_000
	if err := store.SetDatabase(&db); err != nil { t.Fatal(err) }
	if err := a.fd.WriteImcryptStorage(store); err != nil { t.Fatal(err) }
	a.invalidateAuth()

	if result := a.UnlockLoadedImage("master-password"); len(result) == 0 || result[0] != nil {
		t.Fatalf("legacy vault unlock failed: %#v", result)
	}
	if result := a.GetDatabase(); len(result) < 2 || result[0] != nil {
		t.Fatalf("legacy database unreadable: %#v", result)
	}
}
