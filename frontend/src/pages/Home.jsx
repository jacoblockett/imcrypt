import { act, useEffect, useLayoutEffect, useRef } from "react"
import { useDatabaseState, useGroupPanelState, useLoginPanelState, useRulesetPanelState } from "../store"
import { useShallow } from "zustand/react/shallow"
import Button from "../components/Button"
import Input from "../components/Input"
import Person from "../components/svg/Person"
import PersonID from "../components/svg/PersonID"
import Note from "../components/svg/Note"
import BankCard from "../components/svg/BankCard"
import Import from "../components/svg/Import"
import Plus from "../components/svg/Plus"
import Generator from "../components/svg/Generator"
import Gear from "../components/svg/Gear"
import Filter from "../components/svg/Filter"
import CheckMark from "../components/svg/CheckMark"
import Minus from "../components/svg/Minus"
import More from "../components/svg/More"
import Group from "../components/Group"
import LoginPanel from "../components/LoginPanel"
import RulesPanel from "../components/RulesPanel"
import useFocusTrap from "../components/FocusTrap"
import { attempt } from "../utils"
import { create } from "zustand"
import { useConfirm } from "../components/Confirm"
import { useToast } from "../components/Toast"
import Pencil from "../components/svg/Pencil"
import AtSign from "../components/svg/AtSign"
import Lock from "../components/svg/Lock"
import Clipboard from "../components/svg/Clipboard"
import ClipboardCheck from "../components/svg/ClipboardCheck"
import Navigate from "../components/svg/Navigate"
import Key from "../components/svg/Key"
import { format, formatInTimeZone } from "date-fns-tz"
import { OpenURLInBrowser, CloseSession, DeleteTwoFactorSecret } from "../../wailsjs/go/main/App"
import ProfilePicture from "../components/ProfilePicture"
import Fuse from "fuse.js"
import Dropdown from "../components/Dropdown"
import { fromUnixTime } from "date-fns"
import { usePath } from "crossroad"

export const useHomeState = create(() => ({
	searchInput: "",
	searchResults: [], // items
	selectedItems: [], // item ids
	activeItem: "", // item id
	copySuccess: false,
	addItemModal: false,
	filterItemsModal: false,
	activeFilter: "AZ", // AZ, ZA, CA, CD, UA, UD
	itemOptionsModal: false,
	addItemsToGroupModal: false,
	addItemsToGroupModalInput: [],
	itemDragCount: 0
}))

export default function Home() {
	const {
		loaded,
		dbItems,
		hasTwoFactorAuthentication,
		getItemById,
		getItemsInGroupByGroupId,
		getItemsAsArray,
		getGroupById,
		getGroupsAsArray,
		getGroupCount,
		deleteGroupsById
	} = useDatabaseState(
		useShallow(s => ({
			dbItems: s.items,
			groups: s.groups,
			settings: s.settings,
			loaded: s.loaded,
			hasTwoFactorAuthentication: s.hasTwoFactorAuthentication,
			getItemById: s.getItemById,
			getItemsInGroupByGroupId: s.getItemsInGroupByGroupId,
			getItemsAsArray: s.getItemsAsArray,
			getGroupById: s.getGroupById,
			getGroupsAsArray: s.getGroupsAsArray,
			getGroupCount: s.getGroupCount,
			getRulesetsAsArray: s.getRulesetsAsArray,
			getRulesetWithItemByItemId: s.getRulesetWithItemByItemId,
			getCharsetsAsArray: s.getCharsetsAsArray,
			getCharsetWithRulesetByRulesetId: s.getCharsetWithRulesetByRulesetId,
			deleteGroupsById: s.deleteGroupsById
		}))
	)
	const { loadLoginPanelDefault, loadFromId, validatePassword } = useLoginPanelState(
		useShallow(s => ({
			loadLoginPanelDefault: s.loadDefault,
			loadFromId: s.loadFromId,
			setLoginPanelSnapshot: s.setSnapshot,
			validatePassword: s.validatePassword
		}))
	)
	const { selectedGroup, groupBeingEdited, groupWithMenuOpen } = useGroupPanelState(
		useShallow(s => ({
			selectedGroup: s.selected,
			groupBeingEdited: s.beingEdited,
			groupWithMenuOpen: s.withMenuOpen
		}))
	)
	const state = useHomeState()
	const toast = useToast()
	const pageRef = useRef()
	const itemDragCount = useRef()
	const [, setPath] = usePath()
	const confirm = useConfirm()

	function handleAddGroupButtonClick() {
		useGroupPanelState.setState({ beingEdited: "IMCRYPT_CREATE_GROUP" })
	}

	async function handleOpenLoginPanel(itemId) {
		if (itemId) {
			const [err] = loadFromId(itemId)

			if (err) return toast.showError(`Couldn't load item: ${err}`)

			const [err2] = await validatePassword()
			if (err2) return toast.showError(`Failed to open panel - ${err2}`)

			document.querySelector("#login-panel-container").classList.add("visible")
			useFocusTrap("#login-panel-container") // TODO: update with trigger whenever that's programmed
			useLoginPanelState.setState({ isOpen: true })
		} else {
			const groups = getGroupsAsArray()
			const { selected } = useGroupPanelState.getState()
			const selectedGroupIndex = groups.findIndex(group => group.id === selected)

			loadLoginPanelDefault([selectedGroupIndex])

			document.querySelector("#login-panel-container").classList.add("visible")
			useFocusTrap("#login-panel-container", { trigger: "#init-login-panel-btn" })
			useLoginPanelState.setState({ isOpen: true })
		}
	}

	function handleToggleSelectAll() {
		if (useHomeState.getState().selectedItems.length) {
			useHomeState.setState({ selectedItems: [] })
		} else {
			useHomeState.setState({
				selectedItems: getItemsInGroupByGroupId(useGroupPanelState.getState().selected).map(item => item.id)
			})
		}
	}

	function handleToggleSelectItem(itemId) {
		const selectedItems = useHomeState.getState().selectedItems

		if (selectedItems.includes(itemId)) {
			useHomeState.setState({ selectedItems: selectedItems.filter(s => s !== itemId) })
		} else {
			selectedItems.push(itemId)
			useHomeState.setState({ selectedItems })
		}
	}

	function handleViewItem(itemId) {
		if (useHomeState.getState().activeItem !== itemId) {
			useHomeState.setState({ activeItem: itemId })
		}
	}

	async function handleCopyToClipboard(data, name = "") {
		const result = await window.runtime.ClipboardSetText(data)

		if (result) {
			toast.showInfo(`Copied ${name ? `${name} ` : ""}to clipboard!`)
		} else {
			toast.showError(`Failed to copy ${name ? `${name} ` : ""}to clipboard.`)
		}
	}

	async function handleNavigateToWebsite(website) {
		// await window.runtime.BrowserOpenURL(website)
		await OpenURLInBrowser(website)
	}

	function handleToggleAddItemModal() {
		useHomeState.setState({ addItemModal: !useHomeState.getState().addItemModal })
	}

	function handleToggleFilterModal() {
		useHomeState.setState({ filterItemsModal: !useHomeState.getState().filterItemsModal })
	}

	function handleGetItemsInSelectedGroup() {
		const { selected } = useGroupPanelState.getState()
		const { activeFilter } = useHomeState.getState()
		const itemsInGroup = getItemsInGroupByGroupId(selected)

		if (!activeFilter) {
			return itemsInGroup
		} else if (activeFilter === "AZ") {
			return itemsInGroup.sort((a, b) => a.title.localeCompare(b.title))
		} else if (activeFilter === "ZA") {
			return itemsInGroup.sort((a, b) => b.title.localeCompare(a.title))
		} else if (activeFilter === "CA") {
			return itemsInGroup.sort((a, b) => a.created - b.created)
		} else if (activeFilter === "CD") {
			return itemsInGroup.sort((a, b) => b.created - a.created)
		} else if (activeFilter === "UA") {
			return itemsInGroup.sort((a, b) => a.updated - b.updated)
		} else if (activeFilter === "UD") {
			return itemsInGroup.sort((a, b) => b.updated - a.updated)
		} else {
			throw new Error("Unknown filter")
		}
	}

	function handleMoreButtonClick() {
		const { activeItem, selectedItems } = useHomeState.getState()

		if (!activeItem && !selectedItems.length) {
			return toast.showError("You must select an item to view options.")
		}

		useHomeState.setState({ itemOptionsModal: true })
	}

	function handleDeleteItems() {
		const { activeItem, selectedItems } = useHomeState.getState()
		const { deleteItemsById } = useDatabaseState.getState()

		useConfirm().open({
			message: `Are you sure want to delete ${
				selectedItems.length >= 2 ? "these items" : "this item"
			}? This process is permanent and cannot be undone.`,
			onConfirm: async () => {
				if (selectedItems.length) {
					const [err] = await deleteItemsById(selectedItems)

					if (err) return toast.showError(`Failed to delete items - ${err}`)

					useHomeState.setState({
						itemOptionsModal: false,
						selectedItems: [],
						...(selectedItems.includes(activeItem) ? { activeItem: "" } : {})
					})
				} else if (activeItem) {
					const [err] = await deleteItemsById([activeItem])

					if (err) return toast.showError(`Failed to delete items - ${err}`)

					useHomeState.setState({ itemOptionsModal: false, activeItem: "" })
				}

				if (
					useGroupPanelState.getState().selected === "Archived" &&
					getItemsInGroupByGroupId("Archived").length === 0
				) {
					useGroupPanelState.setState({ selected: "All-Items" })
				}
			}
		})
	}

	async function handleDeleteAllArchived() {
		const { deleteItemsById, getGroupById } = useDatabaseState.getState()

		useConfirm().open({
			message: `Are you sure you want to delete all archived items? This process is permanent and cannot be undone.`,
			onConfirm: async () => {
				const archived = getGroupById("Archived")
				const [err] = await deleteItemsById(archived.items.map(s => s.id))

				if (err) {
					return toast.showError(err)
				}

				return toast.showInfo("All archived items have been deleted.")
			}
		})
	}

	async function handleArchiveItems() {
		const { activeItem, selectedItems } = useHomeState.getState()
		const { updateItemsById } = useDatabaseState.getState()

		if (selectedItems.length) {
			const [err] = await updateItemsById(
				selectedItems.map(itemId => ({
					itemId,
					item: { archived: true },
					mask: ["archived"]
				}))
			)

			if (err) return toast.showError(`Failed to archive items - ${err}`)

			useHomeState.setState({
				itemOptionsModal: false,
				selectedItems: [],
				...(selectedItems.includes(activeItem) ? { activeItem: "" } : {})
			})
		} else if (activeItem) {
			const [err] = await updateItemsById([{ itemId: activeItem, item: { archived: true }, mask: ["archived"] }])

			if (err) return toast.showError(`Failed to archive items - ${err}`)

			useHomeState.setState({ itemOptionsModal: false, activeItem: "" })
		}
	}

	async function handleUnarchiveItems() {
		const { activeItem, selectedItems } = useHomeState.getState()
		const { updateItemsById } = useDatabaseState.getState()

		if (selectedItems.length) {
			const [err] = await updateItemsById(
				selectedItems.map(itemId => ({
					itemId,
					item: { archived: false },
					mask: ["archived"]
				}))
			)

			if (err) return toast.showError(`Failed to unarchive items - ${err}`)

			useHomeState.setState({
				itemOptionsModal: false,
				selectedItems: [],
				...(selectedItems.includes(activeItem) ? { activeItem: "" } : {})
			})
		} else if (activeItem) {
			const [err] = await updateItemsById([{ itemId: activeItem, item: { archived: false }, mask: ["archived"] }])

			if (err) return toast.showError(`Failed to unarchive items - ${err}`)

			useHomeState.setState({ itemOptionsModal: false, activeItem: "" })
		}

		if (useGroupPanelState.getState().selected === "Archived" && getItemsInGroupByGroupId("Archived").length === 0) {
			useGroupPanelState.setState({ selected: "All-Items" })
		}
	}

	function handleToggleAddItemsToGroupModal() {
		useHomeState.setState({
			itemOptionsModal: false,
			addItemsToGroupModal: !useHomeState.getState().addItemsToGroupModal,
			addItemsToGroupModalInput: []
		})
	}

	function handleAddItemsToGroupModalInput(value) {
		useHomeState.setState({ addItemsToGroupModalInput: value })
	}

	async function handleConfirmAddItemsToGroup() {
		const { activeItem, selectedItems, addItemsToGroupModalInput: input } = useHomeState.getState()
		const groups = getGroupsAsArray()
		const selectedGroups = useDatabaseState
			.getState()
			.getGroupsAsArray()
			.reduce((result, group, i) => (input.includes(i) ? [...result, group.id] : result), [])

		let gerr
		if (selectedItems.length) {
			const [err] = await useDatabaseState.getState().updateItemsById(
				selectedItems.map(itemId => {
					// ensure items don't lose the groups they're already a part of
					const groupIds = [
						...new Set([
							...selectedGroups,
							...groups.reduce((result, group) => (group.items.includes(itemId) ? [...result, group.id] : result), [])
						])
					]

					return {
						itemId,
						groupIds,
						includeGroupIds: true
					}
				})
			)

			gerr = err
		} else if (activeItem) {
			// ensures item doesn't lose the groups it's already a part of
			const groupIds = [
				...new Set([
					...selectedGroups,
					...groups.reduce((result, group) => (group.items.includes(activeItem) ? [...result, group.id] : result), [])
				])
			]

			const [err] = await useDatabaseState.getState().updateItemsById([
				{
					itemId: activeItem,
					groupIds,
					includeGroupIds: true
				}
			])

			gerr = err
		}

		if (gerr) {
			return toast.showError(`Failed to add items to the selected groups: ${gerr}`)
		}

		useHomeState.setState({ addItemsToGroupModal: false, selectedItems: [] })
	}

	function handleItemDragStart(e, originId) {
		const { selectedItems } = useHomeState.getState()
		const payload = selectedItems.includes(originId) ? selectedItems : [originId]

		useHomeState.setState({ itemDragCount: payload.length })

		e.dataTransfer.setDragImage(itemDragCount.current, -itemDragCount.current.offsetWidth, 25)

		e.dataTransfer.setData(
			"application/json",
			JSON.stringify({
				type: "items",
				payload
			})
		)
	}

	function handleTFASetup() {
		const { hasTwoFactorAuthentication } = useDatabaseState.getState()

		if (hasTwoFactorAuthentication) {
			confirm.open({
				message: "Are you sure you want to do this?",
				confirmText: "Yes",
				onConfirm: async () => {
					const [err] = await DeleteTwoFactorSecret()

					if (err) {
						toast.showError(err)
					}

					toast.showInfo("TFA has been erased from this file.")
					useDatabaseState.setState({ hasTwoFactorAuthentication: false })
				}
			})
		} else {
			setPath("/encrypt/auth", { mode: "replace" })
		}
	}

	async function handleCloseSession() {
		await CloseSession()

		setPath("/", { mode: "replace" })
	}

	useEffect(() => {
		if (pageRef.current && !groupWithMenuOpen) {
			useFocusTrap(pageRef)
		}
	}, [groupWithMenuOpen])

	useLayoutEffect(() => {
		if (!loaded) {
			;(async function () {
				const [err] = await useDatabaseState.getState().load()
				if (err) throw new Error(err)
			})()
		}

		const { searchInput } = useHomeState.getState()
		const list = handleGetItemsInSelectedGroup()

		if (searchInput) {
			const fuse = new Fuse(list, {
				keys: ["title"],
				includeScore: true,
				threshold: 0.4
			})

			const results = fuse.search(searchInput)

			useHomeState.setState({ searchResults: results.map(r => r.item) })
		} else {
			useHomeState.setState({ searchResults: list })
		}
	}, [loaded, state.searchInput, selectedGroup, state.activeFilter, dbItems])

	useLayoutEffect(() => {
		if (useLoginPanelState.getState().isOpen) {
			document.querySelector("#login-panel-container").classList.add("visible")
		}

		if (useRulesetPanelState.getState().isOpen) {
			document.querySelector("#ruleset-panel-container").classList.add("visible")
		}
	}, [])

	return (
		<div ref={pageRef} id="home" className="page">
			<div className="nav-panel">
				<div className="logo">Imcrypt</div>
				<div className="groups-section">
					<div className="handle">
						<span>Groups</span>
						<Button id="create-group-btn" onClick={handleAddGroupButtonClick}>
							<Plus />
						</Button>
					</div>
					<div className="groups">
						<Group
							id="All-Items"
							name="All Items"
							count={getItemsAsArray().filter(item => !item.archived).length}
							active={selectedGroup === "All-Items"}
							noedit
						/>
						<Group
							id="Archived"
							name="Archived"
							count={getItemsAsArray().filter(item => item.archived).length}
							active={selectedGroup === "Archived"}
							noedit
							menu={[{ name: "Delete All", action: handleDeleteAllArchived }]}
						/>
						{getGroupCount() || groupBeingEdited === "IMCRYPT_CREATE_GROUP" ? <hr /> : ""}
						{getGroupsAsArray().map(group => (
							<Group
								key={group.id}
								id={group.id}
								name={group.name}
								count={getItemsInGroupByGroupId(group.id).filter(i => !i.archived).length}
								menu={[
									{
										name: "Rename",
										action: () => {
											useGroupPanelState.setState({ beingEdited: group.id })
										}
									},
									{
										name: "Delete",
										action: async () => {
											if (selectedGroup === group.id) {
												useGroupPanelState.setState({ selected: "All-Items" })
												document.querySelector("#group-All-Items").focus()
											}

											const [err] = await attempt(deleteGroupsById, [group.id])

											if (err) {
												return console.error(err)
											}
										}
									}
								]}
							/>
						))}
						{groupBeingEdited === "IMCRYPT_CREATE_GROUP" ? <Group id="IMCRYPT_CREATE_GROUP" noselect /> : ""}
					</div>
				</div>
				<div className="additional-functions">
					{/* No settings for now - can't think of anything immediately useful */}
					{/* <div tabIndex={0}>
						<Gear /> <span>Settings</span>
					</div> */}
					<div tabIndex={0} onClick={handleTFASetup}>
						<Key /> <span>Turn {hasTwoFactorAuthentication ? "off" : "on"} TFA</span>
					</div>
					<div tabIndex={0} onClick={handleCloseSession}>
						<Lock /> <span>Close File and Logout</span>
					</div>
				</div>
				{/* TODO: need to figure out how I'm tracking version */}
				{/* <div className="version">Version {state.version}</div> */}
			</div>
			<div className="view">
				{handleGetItemsInSelectedGroup().length ? (
					<>
						<div className="action-bar">
							<Input
								label={`Search "${getGroupById(selectedGroup).name}"`}
								value={state.searchInput}
								onChange={e => useHomeState.setState({ searchInput: e.target.value })}
								focusKeyboardShortcut="/"
							/>
							<Button className="add-item-button" onClick={handleToggleAddItemModal}>
								<div className="icon">
									<Plus />
								</div>
								Add item
							</Button>
						</div>
						<div className="items-section">
							<div className="item-select">
								<div className="item-select-toolbar">
									<Button
										onClick={handleToggleSelectAll}
										className={`select-all-button ${state.selectedItems.length ? "selected" : ""}`}>
										{state.selectedItems.length ? <Minus /> : ""}
									</Button>
									{state.selectedItems.length ? (
										<span className="items-selected-count">{state.selectedItems.length} selected</span>
									) : (
										""
									)}
									<Button className="filter-button" onClick={handleToggleFilterModal}>
										<Filter />
									</Button>
									{state.activeItem || state.selectedItems.length ? (
										<Button className="more-button" onClick={handleMoreButtonClick}>
											<More />
										</Button>
									) : (
										""
									)}
								</div>
								<div className="items-list">
									{state.searchResults.length ? (
										state.searchResults.map(item => {
											return (
												<div
													className={`item ${state.activeItem === item.id ? "active" : ""}`}
													key={item.id}
													tabIndex={0}
													draggable
													onClick={() => handleViewItem(item.id)}
													onDragStart={e => handleItemDragStart(e, item.id)}>
													<Button
														onClick={e => {
															e.preventDefault()
															e.stopPropagation()
															handleToggleSelectItem(item.id)
														}}
														className={`item-select-button ${state.selectedItems.includes(item.id) ? "selected" : ""}`}>
														{state.selectedItems.includes(item.id) ? <CheckMark /> : ""}
													</Button>
													<ProfilePicture website={item.websites[0]} title={item.title} />
													<div className="details">
														<div className="title">{item.title}</div>
														<div className="subtitle">{item.username || item.email || "(no email/username)"}</div>
													</div>
												</div>
											)
										})
									) : (
										<div className="no-results">No item matches your search.</div>
									)}
								</div>

								<div ref={itemDragCount} className="item-drag-count">
									{state.itemDragCount}
								</div>
							</div>
							<div className="item-view">
								{(function () {
									const { activeItem } = useHomeState.getState()

									if (activeItem) {
										const item = getItemById(activeItem)

										/**
										 * Do not remove this line. This is here to prevent an error that occurs as follows:
										 *
										 * 1. 2 or more items exist
										 * 2. User opens an item, setting it as activeItem
										 * 3. User clicks on the more options button and attempts to delete the currently selected items (of which the activeItem is a part of)
										 * 4. Throws an error that item doesn't exist
										 *
										 * This happens because of a desync between React's lifecycle (it looks at the items in store.jsx - useDatabaseState.items)
										 * useEffect and Zustand's update cycle with the useHomeState state. It consistently updates useDatabaseState first, then
										 * React updates the view before Zustand has a chance to update the useHomeState. This all makes sense but was a POS to track
										 * down. So, TL;DR - useEffect fires off after a delete op before the activeItem is removed from useHomeState, causing a render
										 * desync between React and the global state.
										 */
										if (!item) return

										if (item.type === "LOGIN") {
											return (
												<>
													<div className="view-header">
														<div className="title">{item.title}</div>
														<Button className="edit-button" onClick={() => handleOpenLoginPanel(item.id)}>
															<Pencil /> Edit
														</Button>
													</div>
													<Input
														className="email-box"
														placeholder="(no email)"
														showPlaceholder
														prefixIcon={AtSign}
														label="Email"
														value={item.email}>
														<Button onClick={() => handleCopyToClipboard(item.email, "email")} className="copy-button">
															{state.copySuccess ? <ClipboardCheck /> : <Clipboard />}
														</Button>
													</Input>
													<Input
														className="username-box"
														placeholder="(no username)"
														showPlaceholder
														prefixIcon={Person}
														label="Username"
														value={item.username}>
														<Button
															onClick={() => handleCopyToClipboard(item.username, "username")}
															className="copy-button">
															{state.copySuccess ? <ClipboardCheck /> : <Clipboard />}
														</Button>
													</Input>
													<Input className="password-box" prefixIcon={Lock} label="Password" value={item.password}>
														<Button
															onClick={() => handleCopyToClipboard(item.password, "password")}
															className="copy-button">
															{state.copySuccess ? <ClipboardCheck /> : <Clipboard />}
														</Button>
													</Input>
													<div className={`expires-note${item.passwordIsExpired() ? " expired" : ""}`}>
														{item.ruleset.passwordTTL === 0
															? `No expiration set`
															: `Expire${item.passwordIsExpired() ? "d" : "s"} on ${format(
																	item.passwordExpiresAt(),
																	"MMM d, yyyy 'at' HH:mm"
															  )}`}
													</div>
													{item.twoFactorSecret ? (
														<Input
															className="tfa-box"
															prefixIcon={Key}
															label="TFA Authentication Secret"
															value={item.twoFactorSecret}>
															<Button
																onClick={() => handleCopyToClipboard(item.twoFactorSecret, "TFA secret")}
																className="copy-button">
																{state.copySuccess ? <ClipboardCheck /> : <Clipboard />}
															</Button>
														</Input>
													) : (
														""
													)}
													{item.notes ? (
														<Input
															type="textbox"
															className="notes-box"
															prefixIcon={Pencil}
															placeholder="notes"
															label="Notes"
															value={item.notes}
														/>
													) : (
														""
													)}
													{item.websites.filter(w => w).length ? (
														<>
															<hr className="website-separator" />
															{item.websites.map((website, index) => {
																return (
																	<div
																		key={`website-${index}`}
																		tabIndex={0}
																		className="website-container"
																		onClick={() => handleNavigateToWebsite(website)}>
																		<div className="website">{website}</div>
																		<div className="website-nav-button">
																			<Navigate />
																		</div>
																	</div>
																)
															})}
														</>
													) : (
														""
													)}
													<div className="last-updated">
														Last updated {format(new Date(item.updated * 1000), `MMM d, yyyy 'at' HH:mm`)}
													</div>
												</>
											)
										}
									}

									return ""
								})()}
							</div>
						</div>
					</>
				) : (
					<>
						<div className="header">
							<h3 className="title">
								You don't have any{selectedGroup === "Archived" ? " archived" : ""} items
								{selectedGroup !== "All-Items" && selectedGroup !== "Archived"
									? ` in "${getGroupById(selectedGroup).name}"`
									: ""}
							</h3>
							<span className="gradient-text subtitle">Select an option below to get started</span>
						</div>
						<div className="options">
							<Button id="init-login-panel-btn" onClick={() => handleOpenLoginPanel()}>
								<div className="icon">
									<Person />
								</div>
								Add login
							</Button>
							{/* <Button id="init-id-panel-btn" onClick={() => showRulesPanel()}>
								<div className="icon">
									<PersonID />
								</div>
								Add identification
							</Button>
							<Button id="init-note-panel-btn" onClick={() => setNewNotePanel(true)}>
								<div className="icon">
									<Note />
								</div>
								Add note
							</Button>
							<Button id="init-bank-card-panel-btn" onClick={() => setNewBankCardPanel(true)}>
								<div className="icon">
									<BankCard />
								</div>
								Add bank card
							</Button> */}
							<Button>
								<div className="icon">
									<Import />
								</div>
								Import items
							</Button>
						</div>
					</>
				)}
				<LoginPanel />
				<RulesPanel />
				<div
					className={`modal-container${state.addItemModal ? " visible" : ""}`}
					onClick={e => {
						if (e.target === e.currentTarget) {
							useHomeState.setState({ addItemModal: false })
						}
					}}>
					<div className="modal add-item-modal">
						<div className="content">What type of item would you like to add?</div>
						<div className="add-item-options">
							<Button
								id="init-login-panel-btn"
								onClick={() => {
									useHomeState.setState({ addItemModal: false })
									handleOpenLoginPanel()
								}}>
								<div className="icon">
									<Person />
								</div>
								Add login
							</Button>
							<Button onClick={() => {}}>
								<div className="icon">
									<Import />
								</div>
								Import items
							</Button>
						</div>
					</div>
				</div>
				<div
					className={`modal-container${state.filterItemsModal ? " visible" : ""}`}
					onClick={e => {
						if (e.target === e.currentTarget) {
							useHomeState.setState({ filterItemsModal: false })
						}
					}}>
					<div className="modal filter-items-modal">
						<div className="content">Select a filter.</div>
						<div className="filter-options">
							<Button
								id="a-z-filter-btn"
								className={state.activeFilter === "AZ" ? "active" : ""}
								onClick={() => {
									useHomeState.setState({ filterItemsModal: false, activeFilter: "AZ" })
								}}>
								A to Z
							</Button>
							<Button
								id="z-a-filter-btn"
								className={state.activeFilter === "ZA" ? "active" : ""}
								onClick={() => {
									useHomeState.setState({ filterItemsModal: false, activeFilter: "ZA" })
								}}>
								Z to A
							</Button>
							<Button
								id="cre-asc-filter-btn"
								className={state.activeFilter === "CA" ? "active" : ""}
								onClick={() => {
									useHomeState.setState({ filterItemsModal: false, activeFilter: "CA" })
								}}>
								Ascending - Date Created
							</Button>
							<Button
								id="cre-des-filter-btn"
								className={state.activeFilter === "CD" ? "active" : ""}
								onClick={() => {
									useHomeState.setState({ filterItemsModal: false, activeFilter: "CD" })
								}}>
								Descending - Date Created
							</Button>
							<Button
								id="upd-asc-filter-btn"
								className={state.activeFilter === "UA" ? "active" : ""}
								onClick={() => {
									useHomeState.setState({ filterItemsModal: false, activeFilter: "UA" })
								}}>
								Ascending - Date Updated
							</Button>
							<Button
								id="upd-des-filter-btn"
								className={state.activeFilter === "UD" ? "active" : ""}
								onClick={() => {
									useHomeState.setState({ filterItemsModal: false, activeFilter: "UD" })
								}}>
								Descending - Date Updated
							</Button>
						</div>
					</div>
				</div>
				<div
					className={`modal-container${state.itemOptionsModal ? " visible" : ""}`}
					onClick={e => {
						if (e.target === e.currentTarget) {
							useHomeState.setState({ itemOptionsModal: false })
						}
					}}>
					<div className="modal item-options-modal">
						<div className="content">What would you like to do with the selected item(s)?</div>
						<div className="item-options">
							<Button id="delete-item-btn" onClick={handleDeleteItems}>
								Delete
							</Button>
							<Button
								id="archive-item-btn"
								onClick={() => {
									if (useGroupPanelState.getState().selected === "Archived") {
										handleUnarchiveItems()
									} else {
										handleArchiveItems()
									}
								}}>
								{useGroupPanelState.getState().selected === "Archived" ? "Unarchive" : "Archive"}
							</Button>
							<Button id="add-item-to-group-btn" onClick={handleToggleAddItemsToGroupModal}>
								Add to group
							</Button>
						</div>
					</div>
				</div>
				<div
					className={`modal-container${state.addItemsToGroupModal ? " visible" : ""}`}
					onClick={e => {
						if (e.target === e.currentTarget) {
							useHomeState.setState({ addItemsToGroupModal: false })
						}
					}}>
					<div className="modal item-options-modal">
						<div className="content">Select which groups you'd like to add the selected item(s) to.</div>
						<div className="add-items-to-groups-dropdown-container">
							<Dropdown
								label="Groups"
								className="add-items-to-groups-input"
								placeholder="(no groups selected)"
								showPlaceholder
								multiSelect
								options={getGroupsAsArray().map(s => ({ label: s.name, value: s.id }))}
								value={state.addItemsToGroupModalInput}
								onChange={handleAddItemsToGroupModalInput}
							/>
						</div>
						<div className="btn-container">
							<Button className="confirm-btn" onClick={handleConfirmAddItemsToGroup}>
								Confirm
							</Button>
							<Button className="cancel-btn" onClick={handleToggleAddItemsToGroupModal}>
								Cancel
							</Button>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}

/**
 * TODO LIST:
 *
 * - Reordering group (? save for last)
 * - importing
 * - Password Generator and Settings
 * - Visual indicators for items flagged with alerts, such as being expired, etc.
 * - Add some sort of breach detection, or way user can ask to see all items with password, etc. so they can systematically
 *   go in and update each one
 * - Add option to let user describe which, if any, oauth accounts they used for the item?
 * - Add option to let user put in security questions?
 * - Groups can move into each other, causing a end of json input error
 * - key not found, etc. err should automatically be sending users to the initial page to select a file, but it doesn't
 */
