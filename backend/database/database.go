package database

import (
	"fmt"
	"imcrypt_v3/backend/utils"
	"slices"
	"strings"
	"time"

	gonanoid "github.com/matoous/go-nanoid/v2"
	"github.com/rivo/uniseg"
)

const (
	LOGIN_ITEM     = "LOGIN"
	ID_ITEM        = "ID"
	BANK_CARD_ITEM = "CARD"
	NOTE_ITEM      = "NOTE"
)

type Item struct {
	Created         int64    `json:"created"`         // All items (unix timestamp)
	Updated         int64    `json:"updated"`         // All items (unix timestamp)
	Type            string   `json:"type"`            // All items
	Title           string   `json:"title"`           // All items
	Archived        bool     `json:"archived"`        // All items
	Email           string   `json:"email"`           // Login item
	Username        string   `json:"username"`        // Login item
	Password        string   `json:"password"`        // Login item
	PasswordCreated int64    `json:"passwordCreated"` // Login item
	PrevPasswords   []string `json:"prevPasswords"`   // Login item
	Websites        []string `json:"websites"`        // Login item
	TwoFactorSecret string   `json:"twoFactorSecret"` // Login item
	Notes           string   `json:"notes"`           // Login item
	Ruleset         Ruleset  `json:"ruleset"`         // Login item
}

type ItemUpdate struct {
	ItemId          string   `json:"itemId"`
	Item            Item     `json:"item"`
	GroupIds        []string `json:"groupIds"`
	Mask            []string `json:"mask"`            // the fields on Item to actually update
	RulesetMask     []string `json:"rulesetMask"`     // the fields on Item.Ruleset to actually update
	IncludeGroupIds bool     `json:"includeGroupIds"` // include the GroupIds in the update
}

type Group struct {
	Created int64    `json:"created"` // (unix timestamp)
	Updated int64    `json:"updated"` // (unix timestamp)
	Items   []string `json:"items"`   // Item ids
	Name    string   `json:"name"`
}

type GroupUpdate struct {
	GroupId string   `json:"groupId"`
	Group   Group    `json:"group"`
	Mask    []string `json:"mask"`
}

type IterationConstraint struct {
	Type       string `json:"type"`
	Iterations int    `json:"iterations"`
	Charset    string `json:"charset"` // not a Charset, because these character sets are arbitrary and unnamed
}

type Ruleset struct {
	Optional             bool                  `json:"optional"`
	MinLength            int                   `json:"minLength"`
	MaxLength            int                   `json:"maxLength"`
	PasswordTTLIncrement int                   `json:"passwordTTLIncrement"`
	PasswordTTLUnit      int                   `json:"passwordTTLUnit"` // 0 = day, 1 = month, 2 = year
	Reuse                bool                  `json:"reuse"`
	Charset              string                `json:"charset"`
	SameCharMax          int                   `json:"sameCharMax"`
	AtMostConstraints    []IterationConstraint `json:"atMostConstraints"`
	AtLeastConstraints   []IterationConstraint `json:"atLeastConstraints"`
}

type Settings struct {
	SessionLength int `json:"sessionLength"`
}

type SettingsUpdate struct {
	Settings Settings `json:"settings"`
	Mask     []string `json:"mask"`
}

type Database struct {
	Items    map[string]Item  `json:"items"`
	Groups   map[string]Group `json:"groups"`
	Settings Settings         `json:"settings"`
}

// Creates a new Database
func NewDatabase() Database {
	return Database{
		Items:  make(map[string]Item),
		Groups: make(map[string]Group),
	}
}

// Updates the settings
func (db *Database) UpdateSettings(update SettingsUpdate) error {
	for _, field := range update.Mask {
		switch strings.ToLower(field) {
		case "sessionlength":
			db.Settings.SessionLength = update.Settings.SessionLength * int(time.Millisecond)
		}
	}

	return nil
}

type InsertItemsArg struct {
	Item     Item
	GroupIds []string
}

// Inserts a new Item, returning the generated id
func (db *Database) InsertItems(itemsToInsert []InsertItemsArg) ([]string, error) {
	ids := []string{}

	for _, itemToInsert := range itemsToInsert {
		// Validate the incoming item
		err := db.ValidateItem(itemToInsert.Item, itemToInsert.GroupIds, true, false)
		if err != nil {
			return ids, err
		}

		// Create and append
		id := db.GenerateId()

		db.SetItem(id, itemToInsert.Item, itemToInsert.GroupIds, true)

		ids = append(ids, id)
	}

	return ids, nil
}

// Inserts a new Group, returning the generated id
func (db *Database) InsertGroups(groups []Group) ([]string, error) {
	ids := []string{}

	// Validate
	for _, group := range groups {
		err := db.ValidateGroup(group, true)
		if err != nil {
			return ids, err
		}

		// Create and append group with id
		id := db.GenerateId()

		db.SetGroup(id, group, false)

		ids = append(ids, id)
	}

	return ids, nil
}

// Updates an Item
func (db *Database) UpdateItemsById(updates []ItemUpdate) error {
	for _, update := range updates {
		item, exists := db.Items[update.ItemId]
		if !exists {
			return fmt.Errorf("cannot find Item with id %s", update.ItemId)
		}

		for _, field := range update.Mask {
			switch strings.ToLower(field) {
			case "title":
				item.Title = update.Item.Title
			case "archived":
				item.Archived = update.Item.Archived
			case "email":
				item.Email = update.Item.Email
			case "username":
				item.Username = update.Item.Username
			case "password":
				item.PrevPasswords = append(item.PrevPasswords, item.Password)
				item.Password = update.Item.Password
			case "websites":
				item.Websites = update.Item.Websites
			case "twofactorsecret":
				item.TwoFactorSecret = update.Item.TwoFactorSecret
			case "notes":
				item.Notes = update.Item.Notes
			}
		}

		for _, rulesetField := range update.RulesetMask {
			switch strings.ToLower(rulesetField) {
			case "optional":
				item.Ruleset.Optional = update.Item.Ruleset.Optional
			case "minlength":
				item.Ruleset.MinLength = update.Item.Ruleset.MinLength
			case "maxlength":
				item.Ruleset.MaxLength = update.Item.Ruleset.MaxLength
			case "passwordttlincrement":
				item.Ruleset.PasswordTTLIncrement = update.Item.Ruleset.PasswordTTLIncrement
			case "passwordttlunit":
				item.Ruleset.PasswordTTLUnit = update.Item.Ruleset.PasswordTTLUnit
			case "reuse":
				item.Ruleset.Reuse = update.Item.Ruleset.Reuse
			case "charset":
				item.Ruleset.Charset = update.Item.Ruleset.Charset
			case "samecharmax":
				item.Ruleset.SameCharMax = update.Item.Ruleset.SameCharMax
			case "atmostconstraints":
				item.Ruleset.AtMostConstraints = update.Item.Ruleset.AtMostConstraints
			case "atleastconstraints":
				item.Ruleset.AtLeastConstraints = update.Item.Ruleset.AtLeastConstraints
			}
		}

		var groupIds []string

		if update.IncludeGroupIds {
			groupIds = update.GroupIds
		} else {
			for groupId, group := range db.Groups {
				if slices.Contains(group.Items, update.ItemId) {
					groupIds = append(groupIds, groupId)
				}
			}
		}

		err := db.ValidateItem(item, groupIds, slices.Contains(update.Mask, "title"), item.Ruleset.Reuse && slices.Contains(update.Mask, "password"))
		if err != nil {
			return err
		}

		err = db.ValidateRuleset(item.Ruleset)
		if err != nil {
			return err
		}

		db.SetItem(update.ItemId, item, groupIds, true)
	}

	return nil
}

// Updates a Group
func (db *Database) UpdateGroupsById(updates []GroupUpdate) error {
	for _, update := range updates {
		group, exists := db.Groups[update.GroupId]
		if !exists {
			return fmt.Errorf("cannot find Group with id %s", update.GroupId)
		}

		for _, field := range update.Mask {
			switch strings.ToLower(field) {
			case "items":
				group.Items = update.Group.Items
			case "name":
				group.Name = update.Group.Name
			}
		}

		err := db.ValidateGroup(group, slices.Contains(update.Mask, "name"))
		if err != nil {
			return err
		}

		db.SetGroup(update.GroupId, group, true)
	}

	return nil
}

// Sets an item on the database, normalizing its data in the process.
// ⚠️ The provided id and item should have already been deduped and validated prior
// to using this method.
// TODO: should validate ruleset on insert and update
func (db *Database) SetItem(id string, item Item, groupIds []string, update bool) {
	// Since this will be used for updates, too, will need to clear any groups that
	// currently reference the id of this item
	if update {
		for groupId, group := range db.Groups {
			if slices.Contains(group.Items, id) && !slices.Contains(groupIds, groupId) {
				newSlice := slices.DeleteFunc(group.Items, func(itemId string) bool {
					return itemId == id
				})
				group.Items = newSlice
				db.Groups[groupId] = group
			}
		}
	}

	timestamp := time.Now().Unix()

	if !update {
		item.Created = timestamp
	}

	item.Updated = timestamp

	for _, groupId := range groupIds {
		group := db.Groups[groupId]

		if !slices.Contains(group.Items, id) {
			group.Items = append(group.Items, id)
			db.Groups[groupId] = group
		}
	}

	item.Type = strings.ToUpper(strings.TrimSpace(item.Type))
	item.Title = strings.TrimSpace(item.Title)

	if item.Type == LOGIN_ITEM {
		if update {
			item.PasswordCreated = timestamp
		}
		item.Email = strings.TrimSpace(item.Email)
		item.TwoFactorSecret = strings.TrimSpace(item.TwoFactorSecret)
		item.Notes = strings.TrimSpace(item.Notes)

		websites := []string{}
		seen := make(map[string]bool)

		for _, website := range item.Websites {
			trimmed := strings.TrimSpace(website)
			uppered := strings.ToUpper(trimmed)

			if !seen[uppered] {
				websites = append(websites, trimmed)
				seen[uppered] = true
			}
		}

		item.Websites = websites
	}

	db.Items[id] = item
}

// Sets a group on the database, normalizing its data in the process.
// ⚠️ The provided id and group should have already been deduped and validated prior
// to using this method.
func (db *Database) SetGroup(id string, group Group, update bool) {
	timestamp := time.Now().Unix()

	if !update {
		group.Created = timestamp
	}

	group.Updated = timestamp

	group.Name = strings.TrimSpace(group.Name)

	db.Groups[id] = group
}

// Deletes an Item
func (db *Database) DeleteItemsById(ids []string) error {
	for _, id := range ids {
		_, exists := db.Items[id]
		if exists {
			for groupId, group := range db.Groups {
				if slices.Contains(group.Items, id) {
					newSlice := slices.DeleteFunc(group.Items, func(itemId string) bool {
						return itemId == id
					})
					group.Items = newSlice
					db.Groups[groupId] = group
				}
			}

			delete(db.Items, id)
		}
	}

	return nil
}

// Deletes a Group
func (db *Database) DeleteGroupsById(ids []string) error {
	for _, id := range ids {
		delete(db.Groups, id)
	}

	return nil
}

// Validates incoming Item
func (db *Database) ValidateItem(item Item, groupIds []string, checkTitle, checkReuse bool) error {
	t := strings.ToUpper(strings.TrimSpace(item.Type))
	if t != LOGIN_ITEM && t != ID_ITEM && t != BANK_CARD_ITEM && t != NOTE_ITEM {
		return fmt.Errorf("unknown item")
	}

	if t == LOGIN_ITEM {
		// replace the following with the password validator
		if len(item.Password) == 0 {
			return fmt.Errorf("the password cannot be empty")
		}

		if checkReuse && slices.Contains(item.PrevPasswords, item.Password) {
			return fmt.Errorf("the item's password has already been used")
		}
	}

	// TODO: Other type checks for minimum required values

	titleUpper := strings.ToUpper(strings.TrimSpace(item.Title))
	if len(titleUpper) == 0 {
		return fmt.Errorf("the title cannot be empty")
	}

	for _, exi := range db.Items {
		if checkTitle && titleUpper == strings.ToUpper(exi.Title) {
			return fmt.Errorf("the title %s has already been used in another Item", item.Title)
		}
	}

	for _, groupId := range groupIds {
		_, exists := db.Groups[groupId]
		if !exists {
			return fmt.Errorf("cannot find Group with id %s", groupId)
		}
	}

	return nil
}

// Validates incoming Group
func (db *Database) ValidateGroup(group Group, checkName bool) error {
	groupNameUpper := strings.ToUpper(strings.TrimSpace(group.Name))
	if len(groupNameUpper) == 0 {
		return fmt.Errorf("the name cannot be empty")
	}

	if groupNameUpper == "ALL ITEMS" || groupNameUpper == "ARCHIVED" {
		return fmt.Errorf("name cannot be any variation of 'All Items' or 'Archived'")
	}

	for _, exg := range db.Groups {
		if checkName && groupNameUpper == strings.ToUpper(exg.Name) {
			return fmt.Errorf("the name %s has already been used in another Group", group.Name)
		}
	}

	for _, itemId := range group.Items {
		_, exists := db.Items[itemId]
		if !exists {
			return fmt.Errorf("the Item with id %s doesn't exist", itemId)
		}
	}

	return nil
}

// Validates incoming Ruleset
func (db *Database) ValidateRuleset(ruleset Ruleset) error {
	if ruleset.MinLength < 1 {
		return fmt.Errorf("the minimum length must be >= 1")
	}

	if ruleset.MaxLength < 1 {
		return fmt.Errorf("the maximum length must be >= 1")
	}

	if ruleset.MinLength > ruleset.MaxLength {
		return fmt.Errorf("the minimum length exceeds the maximum length (%v > %v)", ruleset.MinLength, ruleset.MaxLength)
	}

	if ruleset.PasswordTTLIncrement < 1 {
		return fmt.Errorf("the password TTL increment must be >= 1")
	}

	if ruleset.PasswordTTLUnit < 0 || ruleset.PasswordTTLUnit > 2 {
		return fmt.Errorf("the password TTL unit must be 0 (day), 1 (month), or 2 (year)")
	}

	if ruleset.SameCharMax < 0 {
		return fmt.Errorf("same char max must be >= 0")
	}

	if len(utils.DedupeString(ruleset.Charset)) == 0 {
		return fmt.Errorf("charset must have at least one character")
	}

	return nil
}

// Generates a unique id. Ids are kept unique across all entities.
func (db *Database) GenerateId() string {
	for {
		id, _ := gonanoid.New(6)

		var exists bool

		if _, exists = db.Items[id]; exists {
			continue
		}

		if _, exists = db.Groups[id]; exists {
			continue
		}

		return id
	}
}

// Validates the given password against the given ruleset
func (db *Database) ValidatePassword(password string, ruleset Ruleset, prevPasswords []string) (ValidationReport, error) {
	passwordLen := uniseg.GraphemeClusterCount(password)

	// booleans -> true = passed, false = failed
	vr := ValidationReport{
		MinLength:          passwordLen >= ruleset.MinLength,
		MaxLength:          passwordLen <= ruleset.MaxLength,
		SameCharMax:        !StringViolatesSameCharMaxConstraint(password, ruleset.SameCharMax),
		Charset:            !StringViolatesAllowedCharacters(password, ruleset.Charset),
		AtMostConstraints:  FindAtMostConstraintViolators(password, ruleset.AtMostConstraints),
		AtLeastConstraints: FindAtLeastConstraintViolators(password, ruleset.AtLeastConstraints),
		PrevPasswords:      !slices.Contains(prevPasswords, password),
	}

	if ruleset.Optional {
		vr.IsValid = true
		return vr, nil
	}

	cb := func(v bool, _ int) bool {
		return !v
	}

	if !vr.MinLength || !vr.MaxLength || !vr.SameCharMax || !vr.Charset || utils.Any(vr.AtMostConstraints, cb) || utils.Any(vr.AtLeastConstraints, cb) || !vr.PrevPasswords {
		vr.IsValid = false
		return vr, nil
	}

	vr.IsValid = true
	return vr, nil
}

// VALIDATION LOGIC
// Placing this here to avoid a cyclical dependency - wanted to put this in "validate" package,
// but couldn't :(
type ValidationReport struct {
	IsValid            bool   `json:"isValid"`
	MinLength          bool   `json:"minLength"`
	MaxLength          bool   `json:"maxLength"`
	SameCharMax        bool   `json:"sameCharMax"`
	Charset            bool   `json:"charset"`
	AtMostConstraints  []bool `json:"atMostConstraints"`
	AtLeastConstraints []bool `json:"atLeastConstraints"`
	PrevPasswords      bool   `json:"prevPasswords"`
}

func StringViolatesSameCharMaxConstraint(s string, scm int) bool {
	// NOTE: if the SameCharMax (scm) is 0, that indicates it wasn't explicitly set because 0
	// isn't a logical number. SameCharMax represents how many times each rune in a string
	// is allowed to appear. Explicitly setting it to 0 means that no rune is allowed to appear,
	// rendering the rules, generation, and validation pointless. Therefore, it should only
	// be used as the default case.
	if scm > 0 {
		cm := make(map[rune]int)

		for _, char := range s {
			cm[char]++

			if cm[char] > scm {
				return true
			}
		}
	}

	return false
}

func StringViolatesAllowedCharacters(s, ac string) bool {
	acm := make(map[rune]bool)

	for _, r := range ac {
		acm[r] = true
	}

	for _, r := range s {
		if !acm[r] {
			return true
		}
	}

	return false
}

func FindAtMostConstraintViolators(s string, pcs []IterationConstraint) []bool {
	cm := make(map[rune]int)

	for _, char := range s {
		cm[char]++
	}

	res := []bool{}

	for _, pc := range pcs {
		t := 0

		for _, char := range pc.Charset {
			if count, exists := cm[char]; exists {
				t += count
			}
		}

		// true = passed, false = failed
		res = append(res, t <= pc.Iterations)
	}

	return res
}

func FindAtLeastConstraintViolators(s string, pcs []IterationConstraint) []bool {
	cm := make(map[rune]int)

	for _, char := range s {
		cm[char]++
	}

	res := []bool{}

	for _, pc := range pcs {
		t := 0

		for _, char := range pc.Charset {
			if count, exists := cm[char]; exists {
				t += count
			}
		}

		// true = passed, false = failed
		res = append(res, t >= pc.Iterations)
	}

	return res
}
