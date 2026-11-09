package main

import (
	"bytes"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"imcrypt_v3/backend/database"
	"os"
	"path/filepath"
	"sort"
	"strconv"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// The record_type column distinguishes items, groups, and settings. JSON inside
// CSV cells preserves nested fields without losing arrays, rulesets, or order.
// record_json is the authoritative snapshot for exact restoration of all fields,
// including carriage returns that some CSV readers normalize inside text cells.
var exportCSVColumns = []string{
	"record_type", "id", "created", "updated", "type", "title", "archived",
	"email", "username", "password", "password_created", "previous_passwords_json",
	"websites_json", "two_factor_secret", "notes", "ruleset_json", "name",
	"group_item_ids_json", "session_length_ms", "record_json",
}

func exportJSONField(value any) (string, error) {
	encoded, err := json.Marshal(value)
	return string(encoded), err
}

// encodeDatabaseCSV is independent of the UI so exports can be tested without
// a running Wails application. It never modifies the database.
func encodeDatabaseCSV(db *database.Database) ([]byte, error) {
	if db == nil {
		return nil, fmt.Errorf("no database to export")
	}

	var output bytes.Buffer
	writer := csv.NewWriter(&output)
	if err := writer.Write(exportCSVColumns); err != nil {
		return nil, err
	}

	itemIDs := make([]string, 0, len(db.Items))
	for id := range db.Items {
		itemIDs = append(itemIDs, id)
	}
	sort.Strings(itemIDs)

	for _, id := range itemIDs {
		item := db.Items[id]
		previous, err := exportJSONField(item.PrevPasswords)
		if err != nil {
			return nil, err
		}
		websites, err := exportJSONField(item.Websites)
		if err != nil {
			return nil, err
		}
		ruleset, err := exportJSONField(item.Ruleset)
		if err != nil {
			return nil, err
		}
		record, err := exportJSONField(item)
		if err != nil {
			return nil, err
		}
		row := []string{
			"item", id, strconv.FormatInt(item.Created, 10),
			strconv.FormatInt(item.Updated, 10), item.Type, item.Title,
			strconv.FormatBool(item.Archived), item.Email, item.Username,
			item.Password, strconv.FormatInt(item.PasswordCreated, 10),
			previous, websites, item.TwoFactorSecret, item.Notes, ruleset,
			"", "", "", record,
		}
		if err := writer.Write(row); err != nil {
			return nil, err
		}
	}

	groupIDs := make([]string, 0, len(db.Groups))
	for id := range db.Groups {
		groupIDs = append(groupIDs, id)
	}
	sort.Strings(groupIDs)

	for _, id := range groupIDs {
		group := db.Groups[id]
		itemIDs, err := exportJSONField(group.Items)
		if err != nil {
			return nil, err
		}
		row := make([]string, len(exportCSVColumns))
		row[0] = "group"
		row[1] = id
		row[2] = strconv.FormatInt(group.Created, 10)
		row[3] = strconv.FormatInt(group.Updated, 10)
		row[16] = group.Name
		row[17] = itemIDs
		record, err := exportJSONField(group)
		if err != nil {
			return nil, err
		}
		row[19] = record
		if err := writer.Write(row); err != nil {
			return nil, err
		}
	}

	settings := make([]string, len(exportCSVColumns))
	settings[0] = "settings"
	settings[18] = strconv.Itoa(db.Settings.SessionLength)
	record, err := exportJSONField(db.Settings)
	if err != nil {
		return nil, err
	}
	settings[19] = record
	if err := writer.Write(settings); err != nil {
		return nil, err
	}

	writer.Flush()
	if err := writer.Error(); err != nil {
		return nil, err
	}
	return output.Bytes(), nil
}

// ExportDatabaseCSV writes a plaintext, lossless representation of the unlocked
// vault's database to a user-selected local file. No plaintext travels through
// the frontend binding; only the operation status and counts are returned.
func (a *App) ExportDatabaseCSV() []any {
	path, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "Export vault as unencrypted CSV",
		DefaultFilename: "imcrypt-export.csv",
		Filters: []runtime.FileFilter{
			{DisplayName: "CSV files (*.csv)", Pattern: "*.csv"},
		},
	})
	if err != nil {
		return []any{err.Error()}
	}
	if path == "" {
		return []any{nil, false} // User canceled.
	}

	a.writeMu.Lock()
	defer a.writeMu.Unlock()

	_, db, err := a.pull()
	if err != nil {
		return []any{err.Error()}
	}

	// Never permit exporting onto the opened vault image, even through a
	// different path or hard link.
	if selectedInfo, err := os.Stat(path); err == nil {
		vaultInfo, err := a.fd.Stat()
		if err != nil {
			return []any{err.Error()}
		}
		if os.SameFile(selectedInfo, vaultInfo) {
			return []any{"cannot overwrite the open vault with a CSV export"}
		}
	} else if !os.IsNotExist(err) {
		return []any{err.Error()}
	}

	data, err := encodeDatabaseCSV(db)
	if err != nil {
		return []any{err.Error()}
	}
	if err := a.requireUnlocked(); err != nil {
		return []any{err.Error()}
	}

	// Write next to the destination, then rename into place to avoid leaving
	// a partially written CSV if an export fails.
	temp, err := os.CreateTemp(filepath.Dir(path), ".imcrypt-export-*.tmp")
	if err != nil {
		return []any{err.Error()}
	}
	defer os.Remove(temp.Name())
	if _, err := temp.Write(data); err != nil {
		temp.Close()
		return []any{err.Error()}
	}
	if err := temp.Sync(); err != nil {
		temp.Close()
		return []any{err.Error()}
	}
	if err := temp.Close(); err != nil {
		return []any{err.Error()}
	}
	if err := os.Rename(temp.Name(), path); err != nil {
		return []any{err.Error()}
	}
	return []any{nil, true, len(db.Items), len(db.Groups)}
}
