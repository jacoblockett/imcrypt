package file

import (
	"bytes"
	"crypto/sha256"
	"image"
	"image/color"
	"image/png"
	"os"
	"path/filepath"
	"testing"

	"imcrypt_v3/backend/crypto"
	"imcrypt_v3/backend/key"
	"imcrypt_v3/backend/storage"

	"github.com/zalando/go-keyring"
)

func recoveryFixture(t *testing.T) (string, []byte, []byte, *storage.Storage) {
	t.Helper()
	keyring.MockInit()
	t.Cleanup(func() { _ = key.Delete() })
	path := filepath.Join(t.TempDir(), "photo.png")
	img := image.NewRGBA(image.Rect(0, 0, 100, 100))
	for y := 0; y < 100; y++ {
		for x := 0; x < 100; x++ { img.Set(x, y, color.RGBA{R: 140, G: 90, B: 70, A: 255}) }
	}
	img.Set(3, 3, color.RGBA{R: 100, G: 25, B: 90, A: 255})
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil { t.Fatal(err) }
	if err := os.WriteFile(path, buf.Bytes(), 0600); err != nil { t.Fatal(err) }
	store := &storage.Storage{
		Id: []byte("vault-for-testing"), PasswordSalt: []byte("12345678"),
		EncryptionSalt: []byte("87654321"), EncryptedDatabase: []byte("encrypted"),
	}
	master, err := crypto.Hash([]byte("master-password"), store.PasswordSalt)
	if err != nil { t.Fatal(err) }
	if err := key.Set(store.Id, master); err != nil { t.Fatal(err) }
	return path, buf.Bytes(), master, store
}

func TestJournalProtectsOriginalDuringInterruptedWrite(t *testing.T) {
	path, original, _, store := recoveryFixture(t)
	journal, err := newJournal(path, original, []byte("future image"), store.Id, store.PasswordSalt)
	if err != nil { t.Fatal(err) }
	if filepath.Ext(journal) != "" || !IsJournal(journal) {
		t.Fatalf("journal has an identifiable image filename: %s", journal)
	}
	raw, err := os.ReadFile(journal)
	if err != nil { t.Fatal(err) }
	if bytes.HasPrefix(raw, []byte("\x89PNG")) || bytes.Contains(raw, original) {
		t.Fatal("recovery journal exposes unencrypted image data")
	}
	if _, _, err := FindRecovery(path, "incorrect password"); err != nil { t.Fatal(err) }
	found, rec, err := FindRecovery(path, "master-password")
	if err != nil || found != journal || rec == nil || rec.Name != filepath.Base(path) {
		t.Fatalf("failed to authenticate matching journal: %q %#v %v", found, rec, err)
	}
	if err := os.Truncate(path, 0); err != nil { t.Fatal(err) }
	if RecoveryState(path, rec) != "different" { t.Fatal("corruption not detected") }
	_ = key.Delete() // The OS keyring is no longer needed to restore a journal.
	restored, err := RestoreRecovery(journal, "master-password")
	if err != nil || restored != path { t.Fatalf("restore: %q %v", restored, err) }
	data, err := os.ReadFile(path)
	if err != nil || !bytes.Equal(data, original) { t.Fatalf("image bytes not recovered: %v", err) }
	if _, err := os.Stat(journal); !os.IsNotExist(err) { t.Fatal("restoration did not remove journal") }
}

func TestJournalRecoversDeletedImage(t *testing.T) {
	path, original, _, store := recoveryFixture(t)
	journal, err := newJournal(path, original, []byte("future"), store.Id, store.PasswordSalt)
	if err != nil { t.Fatal(err) }
	if err := os.Remove(path); err != nil { t.Fatal(err) }
	_, rec, err := FindRecovery(journal, "master-password")
	if err != nil || rec == nil { t.Fatalf("standalone journal not readable: %v", err) }
	if RecoveryState(path, rec) != "missing" { t.Fatal("missing image not identified") }
	if _, err := RestoreRecovery(journal, "master-password"); err != nil { t.Fatal(err) }
	data, err := os.ReadFile(path)
	if err != nil || sha256.Sum256(data) != sha256.Sum256(original) { t.Fatal("standalone restore lost image") }
}

func TestJournalTamperingFailsAuthentication(t *testing.T) {
	path, original, _, store := recoveryFixture(t)
	journal, err := newJournal(path, original, []byte("future"), store.Id, store.PasswordSalt)
	if err != nil { t.Fatal(err) }
	raw, err := os.ReadFile(journal)
	if err != nil { t.Fatal(err) }
	raw[len(raw)-1] ^= 1
	if err := os.WriteFile(journal, raw, 0600); err != nil { t.Fatal(err) }
	if _, _, err := FindRecovery(journal, "master-password"); err == nil {
		t.Fatal("tampered journal authenticated")
	}
	if err := RemoveRecovery(journal, "master-password"); err == nil {
		t.Fatal("tampered journal was deleted")
	}
}

func TestUnresolvedJournalBlocksWrite(t *testing.T) {
	path, original, _, store := recoveryFixture(t)
	f, err := os.OpenFile(path, os.O_RDWR, 0600)
	if err != nil { t.Fatal(err) }
	defer f.Close()
	vault := &File{File: f, Path: path}
	if err := vault.WriteImcryptStorage(store); err != nil { t.Fatal(err) }
	committed, err := os.ReadFile(path)
	if err != nil { t.Fatal(err) }
	journal, err := newJournal(path, committed, []byte("future image"), store.Id, store.PasswordSalt)
	if err != nil { t.Fatal(err) }
	if err := vault.WriteImcryptStorage(store); err == nil {
		t.Fatal("unresolved recovery journal was overwritten")
	}
	current, err := os.ReadFile(path)
	if err != nil || !bytes.Equal(current, committed) { t.Fatal("failed write modified current image") }
	if err := RemoveRecovery(journal, "master-password"); err != nil { t.Fatal(err) }
	if err := vault.WriteImcryptStorage(store); err != nil { t.Fatal(err) }
	candidates, err := Candidates(path)
	if err != nil || len(candidates) != 0 { t.Fatalf("successful write left a journal: %v %v", candidates, err) }
}
