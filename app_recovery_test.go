package main

import (
	"bytes"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"os"
	"path/filepath"
	"sync"
	"testing"

	"imcrypt_v3/backend/database"
	"imcrypt_v3/backend/file"

	"github.com/zalando/go-keyring"
)

// Concurrent requests must not read the same original database and overwrite
// one another. Successful API calls must all be present in the saved image.
func TestConcurrentGroupSavesPreserveEveryCommit(t *testing.T) {
	keyring.MockInit()
	imagePath := filepath.Join(t.TempDir(), "vault.png")
	img := image.NewRGBA(image.Rect(0, 0, 120, 120))
	for y := 0; y < 120; y++ {
		for x := 0; x < 120; x++ {
			img.Set(x, y, color.RGBA{R: 160, G: 130, B: 110, A: 255})
		}
	}
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil { t.Fatal(err) }
	if err := os.WriteFile(imagePath, buf.Bytes(), 0600); err != nil { t.Fatal(err) }
	fd, err := os.OpenFile(imagePath, os.O_RDWR, 0600)
	if err != nil { t.Fatal(err) }

	app := NewApp()
	app.fd = &file.File{File: fd, Path: imagePath}
	t.Cleanup(func() { app.CloseSession() })
	if result := app.InitializeStorage("test-password"); len(result) != 0 {
		t.Fatalf("could not initialize vault: %#v", result)
	}

	const saves = 8
	var wg sync.WaitGroup
	results := make(chan error, saves)
	for i := 0; i < saves; i++ {
		wg.Add(1)
		go func(index int) {
			defer wg.Done()
			name := fmt.Sprintf("Group %02d", index)
			response := app.InsertGroups([]database.Group{{Name: name}})
			if len(response) < 2 || response[0] != nil {
				results <- fmt.Errorf("%s save failed: %#v", name, response)
				return
			}
			results <- nil
		}(i)
	}
	wg.Wait()
	close(results)
	for err := range results {
		if err != nil { t.Fatal(err) }
	}

	response := app.GetDatabase()
	if len(response) < 2 || response[0] != nil { t.Fatalf("cannot read saved vault: %#v", response) }
	db, ok := response[1].(*database.Database)
	if !ok { t.Fatalf("wrong database type: %T", response[1]) }
	if len(db.Groups) != saves {
		t.Fatalf("lost concurrent updates: found %d groups, expected %d", len(db.Groups), saves)
	}
	names := make(map[string]bool, saves)
	for _, group := range db.Groups { names[group.Name] = true }
	for i := 0; i < saves; i++ {
		name := fmt.Sprintf("Group %02d", i)
		if !names[name] { t.Fatalf("committed group %q was overwritten", name) }
	}
	journals, err := file.Candidates(imagePath)
	if err != nil { t.Fatal(err) }
	if len(journals) != 0 { t.Fatalf("successful saves left journals: %#v", journals) }
}
