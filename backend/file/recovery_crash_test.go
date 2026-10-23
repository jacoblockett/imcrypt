package file

import (
	"bytes"
	"crypto/sha256"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"testing"

	"imcrypt_v3/backend/crypto"
	"imcrypt_v3/backend/key"
	"imcrypt_v3/backend/storage"
	"imcrypt_v3/backend/utils"

	"github.com/DimitarPetrov/stegify/steg"
	"github.com/zalando/go-keyring"
)

// The subprocess ends with os.Exit, bypassing Go cleanup and deferred calls.
// Every checkpoint is reached deterministically; no timing-dependent kills or
// failure hooks in production binaries are necessary.
func TestRecoveryCrashChild(t *testing.T) {
	stage := os.Getenv("IMCRYPT_RECOVERY_TEST_STAGE")
	if stage == "" {
		t.Skip("subprocess helper")
	}
	path := os.Getenv("IMCRYPT_RECOVERY_TEST_IMAGE")
	if path == "" {
		t.Fatal("missing subprocess image path")
	}
	keyring.MockInit()
	store := &storage.Storage{
		Id: []byte("vault-for-testing"), PasswordSalt: []byte("12345678"),
		EncryptionSalt: []byte("87654321"), EncryptedDatabase: []byte("encrypted"),
	}
	derived, err := crypto.Hash([]byte("master-password"), store.PasswordSalt)
	if err != nil { t.Fatal(err) }
	if err := key.Set(store.Id, derived); err != nil { t.Fatal(err) }

	original, err := os.ReadFile(path)
	if err != nil { t.Fatal(err) }
	if stage == "before-journal" {
		os.Exit(0)
	}
	if stage == "partial-journal" {
		journal := filepath.Join(filepath.Dir(path), "~0123456789abcdef0123456789abcdef")
		if err := os.WriteFile(journal, []byte("incomplete"), 0600); err != nil { t.Fatal(err) }
		os.Exit(0)
	}

	gobbed, err := utils.Gobify(store)
	if err != nil { t.Fatal(err) }
	var output bytes.Buffer
	if err := steg.Encode(bytes.NewReader(original), bytes.NewReader(gobbed), &output); err != nil {
		t.Fatal(err)
	}
	prepared := output.Bytes()
	journal, err := newJournal(path, original, prepared, store.Id, store.PasswordSalt, store.KDFVersion)
	if err != nil { t.Fatal(err) }
	if !IsJournal(journal) { t.Fatal("invalid journal name") }
	if stage == "journal-synced" {
		os.Exit(0)
	}
	f, err := os.OpenFile(path, os.O_RDWR, 0600)
	if err != nil { t.Fatal(err) }
	if err := f.Truncate(0); err != nil { t.Fatal(err) }
	if stage == "during-write" {
		half := len(prepared) / 2
		if _, err := f.WriteAt(prepared[:half], 0); err != nil { t.Fatal(err) }
		if err := f.Sync(); err != nil { t.Fatal(err) }
		os.Exit(0)
	}
	if _, err := f.WriteAt(prepared, 0); err != nil { t.Fatal(err) }
	if err := f.Sync(); err != nil { t.Fatal(err) }
	current, err := os.ReadFile(path)
	if err != nil || !bytes.Equal(current, prepared) { t.Fatal("write verification failed", err) }
	if stage == "write-verified" {
		os.Exit(0)
	}
	if stage == "during-restore" {
		// Simulate choosing restoration and then losing the process while the
		// image is only partly reconstructed. The journal must survive.
		if err := f.Truncate(0); err != nil { t.Fatal(err) }
		half := len(original) / 2
		if _, err := f.WriteAt(original[:half], 0); err != nil { t.Fatal(err) }
		if err := f.Sync(); err != nil { t.Fatal(err) }
		os.Exit(0)
	}
	t.Fatalf("unexpected subprocess stage: %q", stage)
}

func TestRecoveryFromAbruptProcessTermination(t *testing.T) {
	for _, stage := range []string{
		"before-journal", "partial-journal", "journal-synced",
		"during-write", "write-verified", "during-restore",
	} {
		t.Run(stage, func(t *testing.T) {
			path, original, _, _ := recoveryFixture(t)
			cmd := exec.Command(os.Args[0], "-test.run=^TestRecoveryCrashChild$")
			cmd.Env = append(os.Environ(),
				"IMCRYPT_RECOVERY_TEST_STAGE="+stage,
				"IMCRYPT_RECOVERY_TEST_IMAGE="+path,
			)
			if output, err := cmd.CombinedOutput(); err != nil {
				t.Fatalf("subprocess failed: %v\n%s", err, output)
			}

			candidates, err := Candidates(path)
			if err != nil { t.Fatal(err) }
			if stage == "before-journal" {
				if len(candidates) != 0 { t.Fatal("journal created before staging checkpoint") }
				checkImageBytes(t, path, original)
				return
			}
			if len(candidates) != 1 {
				t.Fatalf("expected one crash-leftover journal, got %d", len(candidates))
			}
			journal := candidates[0]
			if stage == "partial-journal" {
				checkImageBytes(t, path, original)
				if _, _, err := FindRecovery(journal, "master-password"); err == nil {
					t.Fatal("partial journal unexpectedly authenticated")
				}
				_, found, err := FindRecovery(path, "master-password")
				if err != nil || found != nil {
					t.Fatalf("partial journal was treated as a recoverable vault: %v", err)
				}
				return
			}

			// Recovery must work after the subprocess has terminated and
			// therefore cannot access its old keyring/session state.
			_, recovered, err := FindRecovery(journal, "master-password")
			if err != nil || recovered == nil {
				t.Fatalf("standalone recovery failed: %v", err)
			}
			state := RecoveryState(path, recovered)
			if stage == "journal-synced" && state != "original" {
				t.Fatalf("original image modified before rewrite: %s", state)
			}
			if stage == "during-write" || stage == "during-restore" {
				if state != "different" { t.Fatalf("partial image not detected: %s", state) }
			}
			if stage == "write-verified" && state != "completed" {
				t.Fatalf("committed image not recognized: %s", state)
			}
			if stage == "write-verified" {
				// Keeping the completed save and explicitly removing the stale
				// rollback journal must not overwrite the committed image.
				completed, err := os.ReadFile(path)
				if err != nil { t.Fatal(err) }
				if bytes.Equal(completed, original) { t.Fatal("new image was not committed") }
				if err := RemoveRecovery(journal, "master-password"); err != nil { t.Fatal(err) }
				checkImageBytes(t, path, completed)
			} else {
				restored, err := RestoreRecovery(journal, "master-password")
				if err != nil || restored != path {
					t.Fatalf("restore after process death: %q %v", restored, err)
				}
				checkImageBytes(t, path, original)
			}
			if _, err := os.Stat(journal); !os.IsNotExist(err) {
				t.Fatalf("completed recovery retained journal: %v", err)
			}
		})
	}
}

func checkImageBytes(t *testing.T, path string, expected []byte) {
	t.Helper()
	got, err := os.ReadFile(path)
	if err != nil { t.Fatal(err) }
	if sha256.Sum256(got) != sha256.Sum256(expected) {
		t.Fatal(fmt.Errorf("original bytes changed unexpectedly: %s", path))
	}
}
