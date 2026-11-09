package main

import (
	"bytes"
	"encoding/csv"
	"encoding/json"
	"imcrypt_v3/backend/database"
	"reflect"
	"strings"
	"testing"
)

func TestEncodeDatabaseCSVPreservesAllDatabaseFields(t *testing.T) {
	db := database.NewDatabase()
	db.Settings.SessionLength = 1234567

	login := database.Item{
		Created: 100, Updated: 200, Type: database.LOGIN_ITEM,
		Title: "Bank, \"personal\"", Archived: true,
		Email: "test@example.org", Username: "user\nname",
		Password: "secret,\"with\"\nnewline", PasswordCreated: 150,
		PrevPasswords: []string{"old,secret", "previous\nsecret"},
		Websites: []string{"https://example.org/login", "https://example.org"},
		TwoFactorSecret: "TEST2FASEED",
		Notes: "Notes with commas, quotes \" and\na newline",
		Ruleset: database.Ruleset{
			Optional: true, MinLength: 12, MaxLength: 48,
			PasswordTTLIncrement: 3, PasswordTTLUnit: 1,
			Reuse: true, Charset: "abc,\"123",
			SameCharMax: 2,
			AtMostConstraints: []database.IterationConstraint{{Type: "test", Iterations: 2, Charset: "ab"}},
			AtLeastConstraints: []database.IterationConstraint{{Type: "other", Iterations: 1, Charset: "cd"}},
		},
	}
	note := database.Item{Created: 300, Updated: 400, Type: database.NOTE_ITEM, Title: "日本語ノート"}
	db.Items["z-login"] = login
	db.Items["a-note"] = note
	group := database.Group{Created: 10, Updated: 20, Name: "Important, personal", Items: []string{"z-login", "a-note"}}
	db.Groups["g1"] = group

	output, err := encodeDatabaseCSV(&db)
	if err != nil {
		t.Fatal(err)
	}
	second, err := encodeDatabaseCSV(&db)
	if err != nil || !bytes.Equal(output, second) {
		t.Fatalf("export is not deterministic: %v", err)
	}

	rows, err := csv.NewReader(bytes.NewReader(output)).ReadAll()
	if err != nil {
		t.Fatalf("cannot parse exported CSV: %v", err)
	}
	if len(rows) != 5 {
		t.Fatalf("want 5 rows including header, got %d", len(rows))
	}
	columns := make(map[string]int)
	for i, name := range rows[0] {
		columns[name] = i
	}
	if len(columns) != len(exportCSVColumns) {
		t.Fatal("CSV header lost a column")
	}
	field := func(row []string, name string) string {
		t.Helper()
		index, ok := columns[name]
		if !ok {
			t.Fatalf("missing CSV column %q", name)
		}
		return row[index]
	}
	records := make(map[string][]string)
	for _, row := range rows[1:] {
		records[field(row, "record_type")+":"+field(row, "id")] = row
	}
	if len(records) != 4 {
		t.Fatalf("expected four unique records, got %d", len(records))
	}

	itemRow := records["item:z-login"]
	if field(itemRow, "created") != "100" || field(itemRow, "updated") != "200" ||
		field(itemRow, "type") != login.Type || field(itemRow, "title") != login.Title ||
		field(itemRow, "archived") != "true" || field(itemRow, "email") != login.Email ||
		field(itemRow, "username") != login.Username || field(itemRow, "password") != login.Password ||
		field(itemRow, "password_created") != "150" ||
		field(itemRow, "two_factor_secret") != login.TwoFactorSecret || field(itemRow, "notes") != login.Notes {
		t.Fatal("some item scalar values were lost")
	}
	var previous []string
	if err := json.Unmarshal([]byte(field(itemRow, "previous_passwords_json")), &previous); err != nil ||
		!reflect.DeepEqual(previous, login.PrevPasswords) {
		t.Fatalf("password history changed: %v", err)
	}
	var websites []string
	if err := json.Unmarshal([]byte(field(itemRow, "websites_json")), &websites); err != nil ||
		!reflect.DeepEqual(websites, login.Websites) {
		t.Fatalf("websites changed: %v", err)
	}
	var ruleset database.Ruleset
	if err := json.Unmarshal([]byte(field(itemRow, "ruleset_json")), &ruleset); err != nil ||
		!reflect.DeepEqual(ruleset, login.Ruleset) {
		t.Fatalf("ruleset changed: %v", err)
	}
	if field(records["item:a-note"], "title") != note.Title {
		t.Fatal("non-login item missing or text damaged")
	}

	groupRow := records["group:g1"]
	if field(groupRow, "created") != "10" || field(groupRow, "updated") != "20" ||
		field(groupRow, "name") != group.Name {
		t.Fatal("group fields changed")
	}
	var members []string
	if err := json.Unmarshal([]byte(field(groupRow, "group_item_ids_json")), &members); err != nil ||
		!reflect.DeepEqual(members, group.Items) {
		t.Fatalf("group membership changed: %v", err)
	}
	if field(records["settings:"], "session_length_ms") != "1234567" {
		t.Fatal("session setting lost")
	}
	if !strings.Contains(string(output), "日本語") {
		t.Fatal("UTF-8 characters lost")
	}
}

func TestEncodeDatabaseCSVEmptyAndNil(t *testing.T) {
	if _, err := encodeDatabaseCSV(nil); err == nil {
		t.Fatal("expected nil database to fail")
	}
	db := database.NewDatabase()
	data, err := encodeDatabaseCSV(&db)
	if err != nil {
		t.Fatal(err)
	}
	rows, err := csv.NewReader(bytes.NewReader(data)).ReadAll()
	if err != nil || len(rows) != 2 || rows[1][0] != "settings" {
		t.Fatalf("empty vault must still export header and settings: %v", err)
	}
}
