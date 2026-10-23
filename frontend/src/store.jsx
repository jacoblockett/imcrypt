import { create } from "zustand"
import {
	GetDatabase,
	InsertItems,
	UpdateItemsById,
	DeleteItemsById,
	InsertGroups,
	UpdateGroupsById,
	DeleteGroupsById,
	ValidatePassword,
	GeneratePassword,
	GetFaviconURL
} from "../wailsjs/go/main/App"
import isEqual from "lodash.isequal"
import { sortString } from "./utils"
import { addMonths, getUnixTime, addDays, addYears, fromUnixTime } from "date-fns"

export const charsetPresets = [
	{
		name: "Alphanumeric + Symbols",
		charset: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890`~!@#$%^&*()-_=+[{]}\\|;:'\",<.>/?]"
	},
	{
		name: "Alphanumeric",
		charset: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890"
	},
	{
		name: "Alphabetic",
		charset: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
	},
	{
		name: "Uppercase Letters",
		charset: "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
	},
	{
		name: "Lowercase Letters",
		charset: "abcdefghijklmnopqrstuvwxyz"
	},
	{
		name: "Numeric",
		charset: "1234567890"
	}
]

export const constraintPresetTypes = [
	{ abbr: "SCM", selectText: "not use the same character more than" },
	{ abbr: "ALC", selectText: "have at least" },
	{ abbr: "AMC", selectText: "have at most" }
]

function sortByCreated(a, b) {
	return a.created - b.created
}

export const useLoadedImageState = create(() => ({
	binary: ""
}))

export const useDatabaseState = create((set, get) => ({
	items: {},
	groups: {},
	settings: {},

	loaded: false, // Whether the database has been loaded at least once
	hasTwoFactorAuthentication: false,

	// Appropriately sets all values to their default when serialized from Go
	_set: database => {
		// normalize nil pointer slices
		for (const [key, item] of Object.entries(database.items)) {
			if (!item.prevPasswords) database.items[key].prevPasswords = []
			if (!item.websites?.filter(s => s)?.length) database.items[key].websites = [""]
			if (!item.ruleset.atMostConstraints) database.items[key].ruleset.atMostConstraints = []
			if (!item.ruleset.atLeastConstraints) database.items[key].ruleset.atLeastConstraints = []
		}

		for (const [key, group] of Object.entries(database.groups)) {
			if (!group.items) database.groups[key].items = []
		}

		set(database)
	},

	// Loads the database from the backend
	load: async () => {
		const [err, db, hasTwoFactorAuthentication] = await GetDatabase()

		if (err) return [new Error(err)]
		if (!db) return [new Error("Couldn't fetch the database")]

		// normalize nil pointer slices
		for (const [key, item] of Object.entries(db.items)) {
			if (!item.prevPasswords) db.items[key].prevPasswords = []
			if (!item.websites) db.items[key].websites = [""]
			if (!item.ruleset.atMostConstraints) db.items[key].ruleset.atMostConstraints = []
			if (!item.ruleset.atLeastConstraints) db.items[key].ruleset.atLeastConstraints = []
		}

		for (const [key, group] of Object.entries(db.groups)) {
			if (!group.items) db.groups[key].items = []
		}

		set({ loaded: true, hasTwoFactorAuthentication })
		get()._set(db)

		return []
	},

	// .. GET
	_getItem: id => {
		const item = get().items[id]

		if (!item) return undefined

		return {
			id,
			created: item.created,
			updated: item.updated,
			type: item.type,
			title: item.title,
			archived: item.archived,
			...(item.type === "LOGIN" ? { email: item.email || "" } : {}),
			...(item.type === "LOGIN" ? { username: item.username || "" } : {}),
			...(item.type === "LOGIN" ? { password: item.password || "" } : {}),
			...(item.type === "LOGIN" ? { passwordCreated: item.passwordCreated || 0 } : {}),
			...(item.type === "LOGIN" ? { prevPasswords: item.prevPasswords || [] } : {}),
			...(item.type === "LOGIN" ? { websites: item.websites.filter(s => s) ? item.websites : [""] } : {}),
			...(item.type === "LOGIN" ? { twoFactorSecret: item.twoFactorSecret || "" } : {}),
			...(item.type === "LOGIN" ? { notes: item.notes || "" } : {}),
			...(item.type === "LOGIN" ? { ruleset: item.ruleset || {} } : {}),
			...(item.type === "LOGIN"
				? {
						passwordIsExpired: () => {
							const { passwordTTLIncrement: inc, passwordTTLUnit: unit } = item.ruleset
							const now = getUnixTime(new Date())
							const createdAt = fromUnixTime(item.passwordCreated)
							const expiresAt = getUnixTime([addDays, addMonths, addYears][unit](createdAt, inc))

							return now >= expiresAt
						},
						passwordHasBeenReused: newPassword => item.prevPasswords.includes(newPassword),
						passwordExpiresAt: () => {
							const { passwordTTLIncrement: inc, passwordTTLUnit: unit } = item.ruleset
							const createdAt = fromUnixTime(item.passwordCreated)
							const expiresAt = [addDays, addMonths, addYears][unit](createdAt, inc)

							return expiresAt
						}
				  }
				: {})
			// TODO: add other types
		}
	},
	_getGroup: id => {
		if (id === "All-Items") {
			return {
				id,
				created: 0,
				updated: 0,
				items: Object.keys(get().items)
					.map(id => get()._getItem(id))
					.filter(item => !item.archived),
				name: "All Items"
			}
		} else if (id === "Archived") {
			return {
				id,
				created: 0,
				updated: 0,
				items: Object.keys(get().items)
					.map(id => get()._getItem(id))
					.filter(item => item.archived),
				name: "Archived"
			}
		}

		const group = get().groups[id]

		if (!group) return undefined

		return {
			id,
			created: group.created,
			updated: group.updated,
			items: (group.items || []).filter(item => !item.archived),
			name: group.name
		}
	},
	getItemById: id => get()._getItem(id),
	getItemsInGroupByGroupId: (id, sortFx) => {
		if (typeof sortFx !== "function") {
			sortFx = sortByCreated
		}

		const { _getItem, _getGroup, getItemsAsArray } = get()

		if (id === "All-Items") {
			return getItemsAsArray(sortFx).filter(item => !item.archived)
		}

		if (id === "Archived") {
			return getItemsAsArray(sortFx).filter(item => item.archived)
		}

		const group = _getGroup(id)

		if (!group) {
			return []
		}

		return (
			group.items
				.map(_getItem)
				.filter(item => !item.archived)
				.sort(sortFx) || []
		)
	},
	getItemsAsArray: sortFx => {
		if (typeof sortFx !== "function") {
			sortFx = sortByCreated
		}

		const { items, _getItem } = get()

		return Object.keys(items).map(_getItem).sort(sortFx)
	},
	getItemCount: () => Object.keys(get().items).length,
	getGroupById: id => get()._getGroup(id),
	getGroupsWithItemByItemId: (id, sortFx) => {
		if (typeof sortFx !== "function") {
			sortFx = sortByCreated
		}

		const { groups, _getGroup } = get()
		const found = []

		for (const [groupId, { items }] of Object.entries(groups)) {
			if (items.includes(id)) {
				found.push(_getGroup(groupId))
			}
		}

		return found.sort(sortFx)
	},
	getGroupsAsArray: sortFx => {
		if (typeof sortFx !== "function") {
			sortFx = sortByCreated
		}

		const { groups, _getGroup } = get()

		return Object.keys(groups).map(_getGroup).sort(sortFx)
	},
	getGroupCount: () => Object.keys(get().groups).filter(item => !item.archived).length,

	// .. INSERT
	insertItems: async itemsToInsert => {
		const [err, data] = await InsertItems(itemsToInsert)

		if (err) return [new Error(err)]

		const [itemIds, updatedDatabase] = data

		get()._set(updatedDatabase)

		return [, itemIds]
	},
	insertGroups: async groups => {
		const [err, data] = await InsertGroups(groups)

		if (err) return [new Error(err)]

		const [groupIds, updatedDatabase] = data

		get()._set(updatedDatabase)

		return [, groupIds]
	},

	// .. UPDATE
	updateItemsById: async updates => {
		const [err, updatedDatabase] = await UpdateItemsById(updates)

		if (err) return [new Error(err)]

		// normalize nil pointer slices
		for (const [key, item] of Object.entries(updatedDatabase.items)) {
			if (!item.prevPasswords) updatedDatabase.items[key].prevPasswords = []
			if (!item.websites) updatedDatabase.items[key].websites = [""]
			if (!item.ruleset.atMostConstraints) updatedDatabase.items[key].ruleset.atMostConstraints = []
			if (!item.ruleset.atLeastConstraints) updatedDatabase.items[key].ruleset.atLeastConstraints = []
		}

		for (const [key, group] of Object.entries(updatedDatabase.groups)) {
			if (!group.items) updatedDatabase.groups[key].items = []
		}

		get()._set(updatedDatabase)

		return []
	},
	updateGroupsById: async (id, update) => {
		const [err, updatedDatabase] = await UpdateGroupsById(id, update)

		if (err) return [new Error(err)]

		get()._set(updatedDatabase)

		return []
	},

	// .. DELETE
	deleteItemsById: async ids => {
		const [err, updatedDatabase] = await DeleteItemsById(ids)

		if (err) return [new Error(err)]

		get()._set(updatedDatabase)

		return []
	},
	deleteGroupsById: async ids => {
		const [err, updatedDatabase] = await DeleteGroupsById(ids)

		if (err) return [new Error(err)]

		get()._set(updatedDatabase)

		return []
	}
}))

export const useFaviconCache = create((set, get) => ({
	cache: new Map(),
	getFavicon: async website => {
		const cache = get().cache
		const found = cache.get(website)

		if (found) return found

		const [err, src] = await GetFaviconURL(website)
		const result = { src, exists: !err }

		cache.set(website, result)

		return result
	}
}))

export const useGroupPanelState = create((set, get) => ({
	selected: "All-Items",
	beingEdited: "", // id
	withMenuOpen: "", // id
	menuOpenTrigger: undefined, // needed to sync with useFocusGroup on the LoginPanel
	shouldReceiveFocus: "", // id?
	whoseMenuBtnShouldReceiveFocus: "", // id?
	createBtnShouldReceiveFocus: false,
	createFieldIsActive: false
}))

export const useLoginPanelState = create((set, get) => ({
	// meta
	isOpen: false,
	validationReport: {},
	method: "", // "insert"/"update" - determines if the save operation inserts or updates the item data
	snapshot: {}, // used to check if the form inputs have been altered in any way from their original state
	originalItem: {},
	mouseDownTarget: undefined, // useful for figuring out if user clicked outside of panel in dead zone
	mouseUpTarget: undefined, // useful for figuring out if user clicked outside of panel in dead zone
	moreFieldsOpen: false,
	onClose: () => {}, // what to do when the panel closes
	onSave: () => {}, // what to do when the panel saves and closes

	// inputs
	titleInput: "",
	groupsInput: [],
	emailInput: "",
	usernameInput: "",
	passwordInput: "",
	websitesInput: [""],
	secretInput: "",
	notesInput: "",

	// actions
	loadDefault: groupsInput => {
		const { loadDefault: loadRulesetPanelDefault } = useRulesetPanelState.getState()

		loadRulesetPanelDefault()

		set({
			snapshot: {
				titleInput: "",
				groupsInput,
				emailInput: "",
				usernameInput: "",
				passwordInput: "",
				websitesInput: [""],
				secretInput: "",
				notesInput: ""
			},
			method: "insert",
			titleInput: "",
			groupsInput,
			emailInput: "",
			usernameInput: "",
			passwordInput: "",
			websitesInput: [""],
			secretInput: "",
			notesInput: "",
			moreFieldsOpen: false
		})
	},
	loadFromId: id => {
		const { getItemById, getGroupsAsArray } = useDatabaseState.getState()
		const item = getItemById(id)

		if (!item) return [new Error(`item (${id}) not found`)]
		if (item.type !== "LOGIN") return [new Error(`invalid type (${item.type})`)]

		const groupsWithItem = getGroupsAsArray().reduce((result, group, index) => {
			if (group.items.includes(id)) result.push(index)

			return result
		}, [])

		const { loadFromItemId: loadRulesetFromItemId } = useRulesetPanelState.getState()

		loadRulesetFromItemId(id) // no reason to catch error here because the only possible errors have already been caught above

		set({
			snapshot: {
				titleInput: item.title,
				groupsInput: groupsWithItem,
				emailInput: item.email,
				usernameInput: item.username,
				passwordInput: item.password,
				websitesInput: item.websites,
				secretInput: item.twoFactorSecret,
				notesInput: item.notes
			},
			method: "update",
			originalItem: item,
			titleInput: item.title,
			groupsInput: groupsWithItem,
			emailInput: item.email,
			usernameInput: item.username,
			passwordInput: item.password,
			websitesInput: item.websites,
			secretInput: item.twoFactorSecret,
			notesInput: item.notes,
			moreFieldsOpen: !!(item.websites.filter(s => s).length || item.twoFactorSecret || item.notes)
		})

		return []
	},
	wereChangesMade: () => {
		const state = get()
		const loginInputChangesWereMade = !isEqual(
			{
				...state.snapshot,
				websitesInput: state.snapshot.websitesInput?.filter(w => w) || []
			},
			{
				titleInput: state.titleInput,
				groupsInput: state.groupsInput,
				emailInput: state.emailInput,
				usernameInput: state.usernameInput,
				passwordInput: state.passwordInput,
				websitesInput: state.websitesInput.filter(w => w),
				secretInput: state.secretInput,
				notesInput: state.notesInput
			}
		)

		return loginInputChangesWereMade
	},
	insertItem: async () => {
		const itemState = get()
		const { compile: compileRuleset } = useRulesetPanelState.getState()
		const { insertItems, getGroupsAsArray } = useDatabaseState.getState()
		const item = {
			type: "LOGIN",
			title: itemState.titleInput,
			email: itemState.emailInput,
			username: itemState.usernameInput,
			password: itemState.passwordInput,
			websites: [...new Set(itemState.websitesInput.map(w => w.trim()).filter(w => w))],
			twoFactorSecret: itemState.secretInput,
			notes: itemState.notesInput,
			ruleset: compileRuleset()
		}
		const selectedGroups = getGroupsAsArray().reduce(
			(result, group, i) => (itemState.groupsInput.includes(i) ? [...result, group.id] : result),
			[]
		)

		return await insertItems([{ item, groupIds: selectedGroups }])
	},
	updateItem: async () => {
		const itemState = get()
		const { compile: compileRuleset } = useRulesetPanelState.getState()
		const { getGroupsAsArray, updateItemsById } = useDatabaseState.getState()
		const groups = getGroupsAsArray()
		const groupsWithItem = groups.reduce(
			(result, group) => (group.items.includes(itemState.originalItem.id) ? [...result, group.id] : result),
			[]
		)
		const selectedGroups = groups.reduce(
			(result, group, i) => (itemState.groupsInput.includes(i) ? [...result, group.id] : result),
			[]
		)
		const includeGroupIds = !isEqual(groupsWithItem, selectedGroups)

		if (itemState.originalItem.type === "LOGIN") {
			const rulesetUpdate = compileRuleset()
			const itemUpdate = {
				title: itemState.titleInput,
				email: itemState.emailInput,
				username: itemState.usernameInput,
				password: itemState.passwordInput,
				websites: [...new Set(itemState.websitesInput.map(w => w.trim()).filter(w => w))],
				twoFactorSecret: itemState.secretInput,
				notes: itemState.notesInput,
				ruleset: rulesetUpdate
			}

			const itemMask = [
				...(!isEqual(itemState.originalItem.title, itemUpdate.title) ? ["title"] : []),
				...(!isEqual(itemState.originalItem.email, itemUpdate.email) ? ["email"] : []),
				...(!isEqual(itemState.originalItem.username, itemUpdate.username) ? ["username"] : []),
				...(!isEqual(itemState.originalItem.password, itemUpdate.password) ? ["password"] : []),
				...(!isEqual(
					[...new Set(itemState.originalItem.websites.map(w => w.trim()).filter(w => w))],
					[...new Set(itemUpdate.websites.map(w => w.trim()).filter(w => w))]
				)
					? ["websites"]
					: []),
				...(!isEqual(itemState.originalItem.twoFactorSecret, itemUpdate.twoFactorSecret) ? ["twoFactorSecret"] : []),
				...(!isEqual(itemState.originalItem.notes, itemUpdate.notes) ? ["notes"] : [])
			]

			const rulesetMask = [
				...(!isEqual(itemState.originalItem.ruleset.optional, itemUpdate.ruleset.optional) ? ["optional"] : []),
				...(!isEqual(itemState.originalItem.ruleset.minLength, itemUpdate.ruleset.minLength) ? ["minLength"] : []),
				...(!isEqual(itemState.originalItem.ruleset.maxLength, itemUpdate.ruleset.maxLength) ? ["maxLength"] : []),
				...(!isEqual(itemState.originalItem.ruleset.passwordTTLIncrement, itemUpdate.ruleset.passwordTTLIncrement)
					? ["passwordTTLIncrement"]
					: []),
				...(!isEqual(itemState.originalItem.ruleset.passwordTTLUnit, itemUpdate.ruleset.passwordTTLUnit)
					? ["passwordTTLUnit"]
					: []),
				...(!isEqual(itemState.originalItem.ruleset.charset, itemUpdate.ruleset.charset) ? ["charset"] : []),
				...(!isEqual(itemState.originalItem.ruleset.sameCharMax, itemUpdate.ruleset.sameCharMax)
					? ["sameCharMax"]
					: []),
				...(!isEqual(itemState.originalItem.ruleset.atMostConstraints, itemUpdate.ruleset.atMostConstraints)
					? ["atMostConstraints"]
					: []),
				...(!isEqual(itemState.originalItem.ruleset.atLeastConstraints, itemUpdate.ruleset.atLeastConstraints)
					? ["atLeastConstraints"]
					: [])
			]

			if (itemMask.length || rulesetMask.length || includeGroupIds) {
				return await updateItemsById([
					{
						itemId: itemState.originalItem.id,
						item: itemUpdate,
						groupIds: selectedGroups,
						mask: itemMask,
						rulesetMask,
						includeGroupIds
					}
				])
			} else {
				return [new Error("No fields were given to update")]
			}
		}
	},
	setSnapshot: () => {
		const state = get()

		set({
			snapshot: {
				titleInput: state.titleInput,
				groupsInput: state.groupsInput,
				emailInput: state.emailInput,
				usernameInput: state.usernameInput,
				passwordInput: state.passwordInput,
				websitesInput: state.websitesInput,
				secretInput: state.secretInput,
				notesInput: state.notesInput
			}
		})
	},
	validatePassword: async () => {
		const { passwordInput, originalItem } = get()
		const { compile } = useRulesetPanelState.getState()
		const ruleset = compile()
		const prevPasswords = originalItem?.prevPasswords || []

		const [err, validationReport] = await ValidatePassword(passwordInput, ruleset, prevPasswords)

		if (err) return [new Error(err)]

		set({ validationReport })

		return []
	},
	isPasswordValid: async () => {
		const { passwordInput, originalItem } = get()
		const { isOptional, compile } = useRulesetPanelState.getState()

		if (!passwordInput.length) return [, false]
		if (isOptional) return [, true]

		const ruleset = compile()
		const prevPasswords = originalItem?.prevPasswords || []

		const [err, report] = await ValidatePassword(passwordInput, ruleset, prevPasswords)

		if (err) return [new Error(err), false]

		return [, report.isValid]
	},
	generatePassword: async () => {
		const { compile } = useRulesetPanelState.getState()
		const ruleset = compile()
		const [err, password] = await GeneratePassword(ruleset)

		if (err) return [new Error(err)]

		const [err2, validationReport] = await ValidatePassword(password, ruleset)

		if (err2) return [new Error(err2)]

		set({ passwordInput: password, validationReport })

		if (!validationReport.isValid) return [new Error("unknown error - generator failed to generate a valid password")]

		return []
	},
	isSaveDisabled: async () => {
		const { wereChangesMade, titleInput, isPasswordValid } = get()
		const { saved } = useRulesetPanelState.getState()
		const [err, passwordIsValid] = await isPasswordValid()

		if ((wereChangesMade() || saved) && titleInput.trim().length && passwordIsValid) return [, false]

		return [err, true]
	}
}))

export const useRulesetPanelState = create((set, get) => ({
	// meta
	isOpen: false,
	snapshot: {}, // see itemPanelState note
	mouseDownTarget: undefined, // useful for figuring out if user clicked outside of panel in dead zone
	mouseUpTarget: undefined, // useful for figuring out if user clicked outside of panel in dead zone
	onClose: () => {}, // what to do when the panel closes
	onSave: () => {}, // what to do when the panel saves and closes
	saved: false, // whether the ruleset was saved - helps for tracking outside of the panel

	// inputs
	optionalInput: true,
	minLengthInput: 12,
	maxLengthInput: 12,
	passwordTTLIncrementInput: 3,
	passwordTTLUnitInput: [1],
	allowPasswordReuseInput: false,
	charsetInput: [],
	charsetTextInput: "",
	constraintInputs: [],

	// actions
	loadDefault: () => {
		const newState = {
			optionalInput: true,
			minLengthInput: 12,
			maxLengthInput: 12,
			passwordTTLIncrementInput: 3,
			passwordTTLUnitInput: [1],
			allowPasswordReuseInput: false,
			charsetInput: [0],
			charsetTextInput: charsetPresets[0].charset,
			constraintInputs: []
		}

		set({ snapshot: newState, ...newState })
	},
	loadFromItemId: id => {
		const { getItemById } = useDatabaseState.getState()
		const item = getItemById(id)

		if (!item) return [new Error(`item with id ${id} not found`)]
		if (item.type !== "LOGIN") return [new Error(`invalid type (${item.type})`)]

		const charsetPresetIndex = charsetPresets.findIndex(p => sortString(p.charset) === sortString(item.ruleset.charset))
		const constraints = [
			...(item.ruleset.sameCharMax ? [{ type: "SCM", iterations: item.ruleset.sameCharMax }] : []),
			...(item.ruleset.atLeastConstraints.length ? item.ruleset.atLeastConstraints : []),
			...(item.ruleset.atMostConstraints.length ? item.ruleset.atMostConstraints : [])
		]

		const newState = {
			optionalInput: item.ruleset.optional,
			minLengthInput: item.ruleset.minLength,
			maxLengthInput: item.ruleset.maxLength,
			passwordTTLIncrementInput: item.ruleset.passwordTTLIncrement,
			passwordTTLUnitInput: [item.ruleset.passwordTTLUnit],
			allowPasswordReuseInput: item.ruleset.reuse,
			charsetInput: charsetPresetIndex,
			charsetTextInput: item.ruleset.charset,
			constraintInputs: constraints
		}

		set({ snapshot: newState, ...newState })

		return []
	},
	// .. specifically used to compile ruleset into a shape recognized by the backend.
	compile: () => {
		const state = get()
		const { atMostConstraints, atLeastConstraints } = state.constraintInputs.reduce(
			(result, constraint) => {
				constraint = { ...constraint, iterations: +constraint.iterations }

				if (constraint.type === "AMC") {
					result.atMostConstraints.push(constraint)
				} else if (constraint.type === "ALC") {
					result.atLeastConstraints.push(constraint)
				}

				return result
			},
			{ atMostConstraints: [], atLeastConstraints: [] }
		)

		return {
			optional: state.optionalInput,
			minLength: +state.minLengthInput,
			maxLength: +state.maxLengthInput,
			passwordTTLIncrement: +state.passwordTTLIncrementInput,
			passwordTTLUnit: state.passwordTTLUnitInput[0],
			allowPasswordReuseInput: state.allowPasswordReuseInput,
			charset: state.charsetTextInput,
			sameCharMax: +(state.constraintInputs.find(x => x.type === "SCM")?.iterations || 0),
			atMostConstraints,
			atLeastConstraints
		}
	},
	setSnapshot: () => {
		const state = get()

		set({
			snapshot: {
				optionalInput: state.optionalInput,
				minLengthInput: state.minLengthInput,
				maxLengthInput: state.maxLengthInput,
				passwordTTLIncrement: state.passwordTTLIncrementInput,
				passwordTTLUnit: state.passwordTTLUnitInput,
				allowPasswordReuseInput: state.allowPasswordReuseInput,
				charsetInput: state.charsetInput,
				charsetTextInput: state.charsetTextInput,
				constraintInputs: state.constraintInputs
			}
		})
	},
	wereChangesMade: () => {
		const state = get()

		return !isEqual(state.snapshot, {
			optionalInput: state.optionalInput,
			minLengthInput: state.minLengthInput,
			maxLengthInput: state.maxLengthInput,
			passwordTTLIncrementInput: state.passwordTTLIncrementInput,
			passwordTTLUnitInput: state.passwordTTLUnitInput,
			allowPasswordReuseInput: state.allowPasswordReuseInput,
			charsetInput: state.charsetInput,
			charsetTextInput: state.charsetTextInput,
			constraintInputs: state.constraintInputs
		})
	},
	validateRuleset: async () => {
		const { compile } = get()
		const ruleset = compile()
		const [err] = await GeneratePassword(ruleset)

		if (err) return [new Error(err), false]

		return [, true]
	}
}))

// TODO: find a way to show auth screen on key error, then resume previous action after authentication
// Thinking the best way to do this is create a state variable representing a fx to run on authentication.

// Ideally this won't be needed because there will be a subscription to the key expiry that automatically
// navs to auth screen without user interaction
