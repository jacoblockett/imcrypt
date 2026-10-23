package main

import (
	"fmt"
	"path/filepath"

	"imcrypt_v3/backend/file"
	"imcrypt_v3/backend/fs"
)

func (a *App) recoverySelection() string {
	if a.recoveryPath != "" { return a.recoveryPath }
	if a.fd != nil { return a.fd.Path }
	return ""
}

func (a *App) matchingRecovery(password string) (string, *file.Recovery, error) {
	selected := a.recoverySelection()
	if selected == "" { return "", nil, fmt.Errorf("no file selected") }
	return file.FindRecovery(selected, password)
}

// API: Authenticates a recovery journal without requiring a readable image.
// An unrelated journal in the directory is not considered a match.
func (a *App) CheckRecovery(password string) []any {
	a.writeMu.Lock()
	defer a.writeMu.Unlock()
	journalPath, rec, err := a.matchingRecovery(password)
	if err != nil { return []any{err.Error()} }
	if rec == nil { return []any{nil, false} }
	originalPath := filepath.Join(filepath.Dir(journalPath), rec.Name)
	return []any{nil, true, file.RecoveryInfo{
		Name: rec.Name, Created: rec.Created,
		State: file.RecoveryState(originalPath, rec),
	}}
}

// API: Restore the exact previous image. Never delete the journal until the
// reconstructed image has been synced and verified.
func (a *App) RestoreRecovery(password string) []any {
	a.writeMu.Lock()
	defer a.writeMu.Unlock()
	journalPath, rec, err := a.matchingRecovery(password)
	if err != nil { return []any{err.Error()} }
	if rec == nil { return []any{"no matching recovery journal"} }
	if a.fd != nil {
		if err := a.fd.Close(); err != nil { return []any{err.Error()} }
		a.fd = nil
	}
	path, err := file.RestoreRecovery(journalPath, password)
	if err != nil { return []any{err.Error()} }
	f, err := fs.OpenFile(path)
	if err != nil { return []any{err.Error()} }
	a.fd = f
	a.recoveryPath = ""
	return []any{}
}

// API: Open the existing image without restoring. Its journal is not deleted;
// further writes are refused until an unresolved journal is removed.
func (a *App) OpenRecoveryCurrent(password string) []any {
	a.writeMu.Lock()
	defer a.writeMu.Unlock()
	if a.recoveryPath == "" {
		if a.fd == nil { return []any{"no image selected"} }
		return []any{}
	}
	_, rec, err := a.matchingRecovery(password)
	if err != nil { return []any{err.Error()} }
	if rec == nil { return []any{"recovery journal is unavailable"} }
	path := filepath.Join(filepath.Dir(a.recoveryPath), rec.Name)
	f, err := fs.OpenFile(path)
	if err != nil { return []any{err.Error()} }
	valid, err := f.IsPNGOrJPG()
	if err != nil || !valid {
		f.Close()
		return []any{"existing image cannot be opened; restore the recovery journal"}
	}
	a.fd = f
	a.recoveryPath = ""
	return []any{}
}

// API: Delete only the authenticated journal, and only after user confirmation.
func (a *App) DeleteRecovery(password string) []any {
	a.writeMu.Lock()
	defer a.writeMu.Unlock()
	journalPath, rec, err := a.matchingRecovery(password)
	if err != nil { return []any{err.Error()} }
	if rec == nil { return []any{"no matching recovery journal"} }
	if err := file.RemoveRecovery(journalPath, password); err != nil {
		return []any{err.Error()}
	}
	return []any{}
}
