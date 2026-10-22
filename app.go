package main

import (
	"bytes"
	"context"
	"encoding/base64"
	"fmt"
	"image/png"
	"imcrypt_v3/backend/crypto"
	"imcrypt_v3/backend/database"
	"imcrypt_v3/backend/file"
	"imcrypt_v3/backend/fs"
	"imcrypt_v3/backend/generate"
	"imcrypt_v3/backend/key"
	"imcrypt_v3/backend/storage"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"sort"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"golang.org/x/net/html"

	"github.com/cli/browser"
	gonanoid "github.com/matoous/go-nanoid/v2"
	"github.com/pquerna/otp/totp"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type App struct {
	ctx context.Context
	fd *file.File
	aet *time.Timer

	authMu sync.Mutex
	passwordVerified bool
	vaultUnlocked bool
	authGeneration uint64
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	key.Delete() // Delete the key if it already exists, just in case

	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt, syscall.SIGTERM)
	go func() {
		<-c
		a.shutdown()
		os.Exit(1)
	}()

	defer func() {
		if r := recover(); r != nil {
			a.shutdown()
			os.Exit(1)
		}
	}()
}

func (a *App) shutdown() {
	fmt.Println("App has been shut down")
	a.invalidateAuth()
	if a.fd != nil {
		a.fd.Close()
		a.fd = nil
	}
}

// API: Closes the current login session and releases the file
func (a *App) CloseSession() []any {
	a.invalidateAuth()
	if a.fd != nil {
		a.fd.Close()
		a.fd = nil
	}
	return []any{}
}

// API: Opens a file select dialog box, prompting the user to select a file,
// returning the file's absolute path
func (a *App) OpenFileDialog(title string, pattern string) []any {
	path, err := fs.OpenFileDialog(a.ctx, title, []runtime.FileFilter{
		{
			DisplayName: fmt.Sprintf("Allowed file types: %s", pattern),
			Pattern:     pattern,
		},
	})
	if err != nil {
		return []any{err.Error()}
	}

	return []any{nil, path}
}

// API: Loads an image from the given file path. The image will be used as
// the storage path
func (a *App) LoadImage(path string) []any {
	// Changing the loaded image invalidates every prior authentication factor.
	a.invalidateAuth()
	if a.fd != nil {
		a.fd.Close()
		a.fd = nil
	}
	f, err := fs.OpenFile(path)
	if err != nil {
		return []any{err.Error()}
	}
	valid, err := f.IsPNGOrJPG()
	if err != nil {
		f.Close()
		return []any{err.Error()}
	}
	if !valid {
		f.Close()
		return []any{"file is not a png or jpg image"}
	}
	a.fd = f
	return []any{}
}

// API: Brings the window to the top, focusing it (hopefully)
func (a *App) FocusWindow() {
	runtime.WindowSetAlwaysOnTop(a.ctx, true)
	runtime.WindowSetAlwaysOnTop(a.ctx, false)
}

// API: Checks if the loaded image has an Imcrypt storage file
func (a *App) HasStorage() []any {
	hasStorage, err := a.fd.HasStorage()
	if err != nil {
		return []any{err.Error()}
	}

	return []any{nil, hasStorage}
}

// API: Initializes a new Storage struct onto the loaded image
func (a *App) InitializeStorage(password string) []any {
	a.invalidateAuth()
	if len(password) < 1 {
		return []any{"password must be at least 1 character long"}
	}

	passwordSalt, err := crypto.GenerateSalt(8)
	if err != nil {
		return []any{err.Error()}
	}

	passwordHash, err := crypto.Hash([]byte(password), passwordSalt)
	if err != nil {
		return []any{err.Error()}
	}

	encryptionSalt, err := crypto.GenerateSalt(8)
	if err != nil {
		return []any{err.Error()}
	}

	storageId, _ := gonanoid.New()

	store := storage.Storage{
		Id:             []byte(storageId),
		EncryptionSalt: encryptionSalt,
		PasswordSalt:   passwordSalt,
	}

	db := database.NewDatabase()

	defaultSettings := database.Settings{
		SessionLength: 600_000, // 10 minutes
	}

	db.Settings = defaultSettings

	err = key.Set(store.Id, passwordHash)
	if err != nil {
		return []any{err.Error()}
	}

	err = store.SetDatabase(&db)
	if err != nil {
		key.Delete()
		return []any{err.Error()}
	}

	err = a.fd.WriteImcryptStorage(&store)
	if err != nil {
		key.Delete()
		return []any{err.Error()}
	}

	a.setAuth(true, true)
	a.createAuthTimeout(defaultSettings.SessionLength)

	return []any{}
}

// API: Generates a TFA secret and QR code image and recovery code, storing the former and returning everything
func (a *App) GenerateTwoFactorSecret() []any {
	key, err := totp.Generate(totp.GenerateOpts{
		Issuer:      "Imcrypt",
		AccountName: a.fd.GetName(),
	})
	if err != nil {
		return []any{err.Error()}
	}

	storage, _, err := a.pull()
	if err != nil {
		return []any{err.Error()}
	}

	sec := key.Secret()
	storage.TwoFactorSecret = []byte(sec)

	recoveryCode, _ := gonanoid.Generate("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 50)

	recoveryCodeSalt, err := crypto.GenerateSalt(8)
	if err != nil {
		return []any{err.Error()}
	}

	recoveryCodeHash, err := crypto.Hash([]byte(recoveryCode), recoveryCodeSalt)
	if err != nil {
		return []any{err.Error()}
	}

	storage.TwoFactorRecoveryHash = recoveryCodeHash
	storage.TwoFactorRecoverySalt = recoveryCodeSalt

	qrImage, err := key.Image(500, 500)
	if err != nil {
		return []any{err.Error()}
	}

	// Encode image.Image to PNG bytes
	buf := new(bytes.Buffer)
	if err := png.Encode(buf, qrImage); err != nil {
		return []any{err.Error()}
	}

	// b64 encode for JSON/Wails transport
	b64str := base64.StdEncoding.EncodeToString(buf.Bytes())

	err = a.fd.WriteImcryptStorage(storage)
	if err != nil {
		return []any{err.Error()}
	}

	return []any{nil, sec, b64str, recoveryCode}
}

// API: Deletes TFA from storage
func (a *App) DeleteTwoFactorSecret() []any {
	storage, _, err := a.pull()
	if err != nil {
		return []any{err.Error()}
	}

	storage.TwoFactorConfirmed = nil
	storage.TwoFactorRecoveryHash = nil
	storage.TwoFactorRecoverySalt = nil
	storage.TwoFactorSecret = nil

	err = a.fd.WriteImcryptStorage(storage)
	if err != nil {
		return []any{err.Error()}
	}

	return []any{nil}
}

// API: Checks if TFA is setup on storage
func (a *App) HasTwoFactorAuthentication() []any {
	store, err := a.readPasswordVerifiedStorage()
	if err != nil {
		return []any{err.Error()}
	}
	return []any{nil, bytes.Equal(store.TwoFactorConfirmed, []byte{1})}
}

// API: Validates the incoming code against the stored TFA secret from storage
func (a *App) ValidateTwoFactorCode(code string, shouldConfirm bool) []any {
	store, err := a.readPasswordVerifiedStorage()
	if err != nil {
		return []any{err.Error()}
	}
	_, unlocked := a.authState()
	confirmed := bytes.Equal(store.TwoFactorConfirmed, []byte{1})
	if !confirmed && !unlocked {
		return []any{"vault is locked"}
	}
	if len(store.TwoFactorSecret) == 0 {
		return []any{"two-factor secret is missing"}
	}
	if !totp.Validate(code, string(store.TwoFactorSecret)) {
		return []any{nil, false}
	}
	if confirmed {
		a.setAuth(true, true)
	} else if shouldConfirm {
		store.TwoFactorConfirmed = []byte{1}
		if err := a.fd.WriteImcryptStorage(store); err != nil {
			return []any{err.Error()}
		}
	}
	return []any{nil, true}
}

// API: Validates the incoming recovery code against the stored recovery code hash/salt
func (a *App) ValidateTwoFactorRecoveryCode(code string) []any {
	store, err := a.readPasswordVerifiedStorage()
	if err != nil {
		return []any{err.Error()}
	}
	if !bytes.Equal(store.TwoFactorConfirmed, []byte{1}) {
		return []any{"two-factor authentication is not enabled"}
	}
	if len(store.TwoFactorRecoveryHash) == 0 {
		return []any{nil, false}
	}
	hashed, err := crypto.Hash([]byte(code), store.TwoFactorRecoverySalt)
	if err != nil {
		return []any{err.Error()}
	}
	valid := crypto.ValidateHMAC(hashed, store.TwoFactorRecoveryHash)
	if valid {
		// Recovery code serves as the alternative second factor.
		a.setAuth(true, true)
	}
	return []any{nil, valid}
}

// API: Reads into a []byte the contents of the loaded image
func (a *App) ReadLoadedImage() []any {
	data, err := a.fd.ReadAll()
	if err != nil {
		key.Delete()
		return []any{err.Error()}
	}

	return []any{nil, data}
}

// API: Unlocks the loaded image, returning the loaded database
func (a *App) UnlockLoadedImage(password string) []any {
	a.invalidateAuth()
	if a.fd == nil {
		return []any{"no image is loaded"}
	}
	store, err := a.fd.ReadImcryptStorage()
	if err != nil {
		return []any{err.Error()}
	}
	passwordHash, err := crypto.Hash([]byte(password), store.PasswordSalt)
	if err != nil {
		return []any{err.Error()}
	}
	if err := key.Set(store.Id, passwordHash); err != nil {
		return []any{err.Error()}
	}
	db, err := store.GetDatabase()
	if err != nil {
		a.invalidateAuth()
		return []any{err.Error()}
	}
	confirmed := bytes.Equal(store.TwoFactorConfirmed, []byte{1})
	a.setAuth(true, !confirmed)
	a.createAuthTimeout(db.Settings.SessionLength)
	// Preserve cleanup of an unfinished second-factor enrollment.
	if !confirmed && store.TwoFactorRecoveryHash != nil {
		store.TwoFactorRecoveryHash = nil
		store.TwoFactorRecoverySalt = nil
		store.TwoFactorSecret = nil
		if err := a.fd.WriteImcryptStorage(store); err != nil {
			a.invalidateAuth()
			return []any{err.Error()}
		}
	}
	// A valid master password alone never returns decrypted secrets.
	return []any{nil}
}

// API: Retrieves the database
func (a *App) GetDatabase() []any {
	storage, database, err := a.pull()
	if err != nil {
		return []any{err.Error()}
	}

	return []any{nil, database, storage.TwoFactorSecret != nil}
}

// API: Checks if the loaded storage's id and the key's id match, validating they are
// meant to be used together
func (a *App) IsAuthenticated() []any {
	if err := a.requireUnlocked(); err != nil {
		return []any{nil, false}
	}
	if _, err := a.readPasswordVerifiedStorage(); err != nil {
		return []any{nil, false}
	}
	return []any{nil, true}
}

// API: Inserts new Items into the Database, returning the newly inserted Items' ids and
// the updated Database
func (a *App) InsertItems(itemsToInsert []database.InsertItemsArg) []any {
	storage, database, err := a.pull()
	if err != nil {
		return []any{err.Error()}
	}

	ids, err := database.InsertItems(itemsToInsert)
	if err != nil {
		return []any{err.Error()}
	}

	err = storage.SetDatabase(database)
	if err != nil {
		return []any{err.Error()}
	}

	go func() {
		err = a.fd.WriteImcryptStorage(storage)
		if err != nil {
			runtime.EventsEmit(a.ctx, "e_storagewrite", err.Error())
		}
	}()

	return []any{nil, []any{ids, database}}
}

// API: Inserts new Groups into the Database, returning the newly inserted Groups' ids
// and the updated Database

func (a *App) InsertGroups(groups []database.Group) []any {
	storage, database, err := a.pull()
	if err != nil {
		return []any{err.Error()}
	}

	ids, err := database.InsertGroups(groups)
	if err != nil {
		return []any{err.Error()}
	}

	err = storage.SetDatabase(database)
	if err != nil {
		return []any{err.Error()}
	}

	go func() {
		err = a.fd.WriteImcryptStorage(storage)
		if err != nil {
			runtime.EventsEmit(a.ctx, "e_storagewrite", err.Error())
		}
	}()

	return []any{nil, []any{ids, database}}
}

// API: Updates Items in the Database, returning the updated Database
func (a *App) UpdateItemsById(updates []database.ItemUpdate) []any {
	storage, database, err := a.pull()
	if err != nil {
		return []any{err.Error()}
	}

	err = database.UpdateItemsById(updates)
	if err != nil {
		return []any{err.Error()}
	}

	err = storage.SetDatabase(database)
	if err != nil {
		return []any{err.Error()}
	}

	go func() {
		err = a.fd.WriteImcryptStorage(storage)
		if err != nil {
			runtime.EventsEmit(a.ctx, "e_storagewrite", err.Error())
		}
	}()

	return []any{nil, database}
}

// API: Updates Groups in the Database, returning the updated Database
func (a *App) UpdateGroupsById(updates []database.GroupUpdate) []any {
	storage, database, err := a.pull()
	if err != nil {
		return []any{err.Error()}
	}

	err = database.UpdateGroupsById(updates)
	if err != nil {
		return []any{err.Error()}
	}

	err = storage.SetDatabase(database)
	if err != nil {
		return []any{err.Error()}
	}

	go func() {
		err = a.fd.WriteImcryptStorage(storage)
		if err != nil {
			runtime.EventsEmit(a.ctx, "e_storagewrite", err.Error())
		}
	}()

	return []any{nil, database}
}

// API: Deletes Items from the Database, returning the updated Database
func (a *App) DeleteItemsById(ids []string) []any {
	storage, database, err := a.pull()
	if err != nil {
		return []any{err.Error()}
	}

	err = database.DeleteItemsById(ids)
	if err != nil {
		return []any{err.Error()}
	}

	err = storage.SetDatabase(database)
	if err != nil {
		return []any{err.Error()}
	}

	go func() {
		err = a.fd.WriteImcryptStorage(storage)
		if err != nil {
			runtime.EventsEmit(a.ctx, "e_storagewrite", err.Error())
		}
	}()

	return []any{nil, database}
}

// API: Deletes Groups from the Database, returning the updated Database
func (a *App) DeleteGroupsById(ids []string) []any {
	storage, database, err := a.pull()
	if err != nil {
		return []any{err.Error()}
	}

	err = database.DeleteGroupsById(ids)
	if err != nil {
		return []any{err.Error()}
	}

	err = storage.SetDatabase(database)
	if err != nil {
		return []any{err.Error()}
	}

	go func() {
		err = a.fd.WriteImcryptStorage(storage)
		if err != nil {
			runtime.EventsEmit(a.ctx, "e_storagewrite", err.Error())
		}
	}()

	return []any{nil, database}
}

// API: Generates a password string based on the provided ruleset and charset
func (a *App) GeneratePassword(ruleset database.Ruleset, previousPasswords []string) []any {
	s := time.Now()
	generated, err := generate.Generate(ruleset, previousPasswords)
	fmt.Println(time.Since(s))
	if err != nil {
		return []any{err.Error()}
	}

	return []any{nil, generated}
}

// API: Validates a password against the provided rules
func (a *App) ValidatePassword(p string, ruleset database.Ruleset, pp []string) []any {
	_, database, err := a.pull()
	if err != nil {
		return []any{err.Error()}
	}

	report, err := database.ValidatePassword(p, ruleset, pp)
	if err != nil {
		return []any{err.Error()}
	}

	return []any{nil, report}
}

// API: 'Properly' opens a given url string in the user's default browser. Runtime's BrowserOpenURL is being
// a bitch. Note: Be sure to include protocol if you need to use this again.
func (a *App) OpenURLInBrowser(url string) {
	if !strings.HasPrefix(strings.ToLower(url), "https://") {
		url = "https://" + url
	}

	err := browser.OpenURL(url)
	if err != nil {
		fmt.Println(err)
	}
}

type iconCandidate struct {
	href string
	typ  string // filetype
	size int    // max size in either direction, e.g., 16 for 16x16
}

func parseSize(s string) int {
	parts := strings.Split(s, "x")
	if len(parts) != 2 {
		return 0
	}
	w, err1 := strconv.Atoi(parts[0])
	h, err2 := strconv.Atoi(parts[1])
	if err1 != nil || err2 != nil {
		return 0
	}
	if w > h {
		return w
	}
	return h
}

// API: Gets the favicon of a given website, in a hopefully smart manner
func (a *App) GetFaviconURL(pageURL string) []any {
	if !strings.HasPrefix(pageURL, "http") {
		pageURL = "https://" + pageURL
	}
	resp, err := http.Get(pageURL)
	if err != nil {
		return []any{err, ""}
	}
	defer resp.Body.Close()

	base, err := url.Parse(pageURL)
	if err != nil {
		return []any{err, ""}
	}

	var icons []iconCandidate

	z := html.NewTokenizer(resp.Body)
	for {
		tt := z.Next()
		if tt == html.ErrorToken {
			break
		}
		t := z.Token()
		if t.Data == "link" {
			isIcon := false
			icon := iconCandidate{}
			for _, a := range t.Attr {
				if a.Key == "rel" && strings.Contains(strings.ToLower(a.Val), "icon") {
					isIcon = true
				}
				if a.Key == "href" {
					icon.href = a.Val
				}
				if a.Key == "type" {
					icon.typ = strings.ToLower(a.Val)
				}
				if a.Key == "sizes" {
					// Prefer largest size in sizes="32x32 16x16"
					for _, s := range strings.Fields(a.Val) {
						size := parseSize(s)
						if size > icon.size {
							icon.size = size
						}
					}
				}
			}
			if isIcon && icon.href != "" {
				icons = append(icons, icon)
			}
		}
	}

	// Priority: SVG > PNG > ICO > anything, largest size > smaller
	sort.SliceStable(icons, func(i, j int) bool {
		if icons[i].size != icons[j].size {
			return icons[i].size > icons[j].size // prefer larger
		}

		if icons[i].typ == "image/svg+xml" && icons[j].typ != "image/svg+xml" {
			return true
		}
		if icons[i].typ != "image/svg+xml" && icons[j].typ == "image/svg+xml" {
			return false
		}
		if icons[i].typ == "image/png" && icons[j].typ != "image/png" {
			return true
		}
		if icons[i].typ != "image/png" && icons[j].typ == "image/png" {
			return false
		}
		if icons[i].typ == "image/x-icon" && icons[j].typ != "image/x-icon" {
			return true
		}
		if icons[i].typ != "image/x-icon" && icons[j].typ == "image/x-icon" {
			return false
		}
		// fallback: order as-is
		return false
	})

	if len(icons) > 0 {
		iconHref := icons[0].href
		iconURL, err := url.Parse(iconHref)
		if err == nil {
			return []any{nil, base.ResolveReference(iconURL).String()}
		}
	}

	// Fallback to /favicon.ico at root with existence check
	base.Path = "/favicon.ico"
	base.RawQuery = ""
	base.Fragment = ""
	faviconURL := base.String()
	resp, err = http.Get(faviconURL)
	if err != nil || resp.StatusCode != http.StatusOK {
		return []any{fmt.Errorf("favicon not found at %s", faviconURL), ""}
	}
	defer resp.Body.Close()
	return []any{nil, faviconURL}
}

// Helper: Gets the file descriptor, storage, and database off of the temp file
func (a *App) pull() (*storage.Storage, *database.Database, error) {
	if err := a.requireUnlocked(); err != nil {
		return nil, nil, err
	}
	if a.fd == nil {
		return nil, nil, fmt.Errorf("no image is loaded")
	}
	store, err := a.fd.ReadImcryptStorage()
	if err != nil {
		return nil, nil, err
	}
	db, err := store.GetDatabase()
	if err != nil {
		return nil, nil, err
	}
	if err := a.requireUnlocked(); err != nil {
		return nil, nil, err
	}
	return store, db, nil
}

// Helper: Creates an authentication timeout
func (a *App) createAuthTimeout(timeInMilliseconds int) {
	a.authMu.Lock()
	a.authGeneration++
	generation := a.authGeneration
	if a.aet != nil {
		a.aet.Stop()
	}
	dur := time.Duration(timeInMilliseconds) * time.Millisecond
	a.aet = time.AfterFunc(dur, func() {
		a.authMu.Lock()
		if a.authGeneration != generation {
			a.authMu.Unlock()
			return
		}
		a.authGeneration++
		a.passwordVerified = false
		a.vaultUnlocked = false
		a.aet = nil
		_ = key.Delete()
		a.authMu.Unlock()
		runtime.EventsEmit(a.ctx, "e_authexp")
	})
	a.authMu.Unlock()
}
