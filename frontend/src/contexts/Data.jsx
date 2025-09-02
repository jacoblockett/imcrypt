import { GetDatabase, DeleteItem, DeleteGroup, UpdateItem, UpdateGroup, InsertGroup } from "../../wailsjs/go/main/App"
import { usePath } from "crossroad"
import { createContext, useState } from "react"
import { useToast } from "../components/Toast"

export const DataContext = createContext()

export function DataProvider({ children }) {
	// Internal
	const toast = useToast()
	const [, setPath] = usePath()

	// Item state
	const [items, setItems] = useState([])

	// Group state
	const [groups, setGroups] = useState([])
	const [groupSelected, setGroupSelected] = useState("All Items")
	const [groupBeingEdited, setGroupBeingEdited] = useState("")
	const [groupMenuOpen, setGroupMenuOpen] = useState("")
	const [createGroupFieldActive, setCreateGroupFieldActive] = useState(false)

	// Settings state
	const [settings, setSettings] = useState({}) // TODO

	// Search state
	const [searchValue, setSearchValue] = useState("")

	// Meta state
	const [version, setVersion] = useState("1.0.0")

	// Helper functions
	async function getDatabase() {
		const resp = await GetDatabase()

		if (resp.status === "ERROR") {
			if (resp.message === "key has expired" || resp.message === "key not found") {
				return setPath("/decrypt/text", { mode: "replace" })
			}

			toast.showError(`Couldn't retrieve the database. If this error persists, create an issue on github.`)
			throw new Error(resp.message)
		}

		setGroups(resp.data.groups)
		setItems(resp.data.items)
	}

	async function deleteItem(id) {
		// TODO
	}

	function getItemsInGroup(groupId) {
		const group = groups.find(group => group.id === groupId)
		const foundItems = items.filter(item => group.items.includes(item.id))

		return foundItems
	}

	async function deleteGroup(id) {
		if (!groups.find(group => group.id === id)) throw new Error(`Group "${id}" not found`)

		const resp = await DeleteGroup(id)

		if (resp.status === "ERROR") {
			if (resp.message === "key has expired" || resp.message === "key not found") {
				return setPath("/decrypt/text", { mode: "replace" })
			}

			toast.showError(`Error: Couldn't delete group [${id}]. If this error persists, create an issue on github.`)
			throw new Error(resp.message)
		}

		setGroups(pre => pre.filter(s => s.id !== id))
	}

	async function insertGroup(name) {
		const resp = await InsertGroup(name)

		if (resp.status === "ERROR") {
			if (resp.message === "key has expired" || resp.message === "key not found") {
				return setPath("/decrypt/text", { mode: "replace" })
			}

			toast.showError(`Couldn't insert the new group "${name}". If this error persists, create an issue on github.`)
			throw new Error(resp.message)
		}

		setGroups(pre => [...pre, resp.data])
	}

	async function updateGroup(id, callback) {
		const old = groups.find(group => group.id === id)

		if (!old) throw new Error(`Group "${id}" not found`)

		const newGroup = callback(old)

		const resp = await UpdateGroup(newGroup)

		if (resp.status === "ERROR") {
			if (resp.message === "key has expired" || resp.message === "key not found") {
				return setPath("/decrypt/text", { mode: "replace" })
			}

			toast.showError(`Couldn't update group [${id}]. If this error persists, create an issue on github.`)
			throw new Error(resp.message)
		}

		setGroups(pre => pre.map(group => (group.id === id ? newGroup : group)))
	}

	return (
		<DataContext.Provider
			value={{
				getDatabase,
				items,
				deleteItem,
				groups,
				getItemsInGroup,
				deleteGroup,
				insertGroup,
				updateGroup,
				groupSelected,
				setGroupSelected,
				groupBeingEdited,
				setGroupBeingEdited,
				groupMenuOpen,
				setGroupMenuOpen,
				createGroupFieldActive,
				setCreateGroupFieldActive,
				settings,
				searchValue,
				setSearchValue,
				version
			}}>
			{children}
		</DataContext.Provider>
	)
}
