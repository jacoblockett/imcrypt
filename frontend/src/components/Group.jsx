import { useRef, forwardRef, useImperativeHandle, useState } from "react"
import Input from "./Input"
import GroupMenu from "./GroupMenu"
import { useToast } from "./Toast"
import { useDatabaseState, useGroupPanelState } from "../store"
import { useShallow } from "zustand/react/shallow"
import { useHomeState } from "../pages/Home"

function Group({ id, name, count, noedit, menu }, outerRef) {
	const { getGroupsAsArray, insertGroups, updateGroupsById } = useDatabaseState(
		useShallow(s => ({
			getGroupsAsArray: s.getGroupsAsArray,
			insertGroups: s.insertGroups,
			updateGroupsById: s.updateGroupsById
		}))
	)
	const { selected, beingEdited } = useGroupPanelState(
		useShallow(s => ({ selected: s.selected, beingEdited: s.beingEdited }))
	)
	const [inputValue, setInputValue] = useState(name || "")
	const [internalName, setInternalName] = useState(name || "")
	const [dragHighlight, setDragHighlight] = useState(false)
	const toast = useToast()
	const ref = useRef()
	const inputRef = useRef()

	function handleRefocusInput() {
		inputRef.current.focus()
		inputRef.current.select()
	}

	function handleInputChange(e) {
		setInputValue(e.target.value)
	}

	async function handleSubmit(e) {
		if (id !== "IMCRYPT_CREATE_GROUP") {
			// Existing group
			if (inputValue === internalName) {
				useGroupPanelState.setState({ beingEdited: "" })
				ref.current.focus()
			}
			if (!inputValue) {
				toast.showError("The name cannot be empty")
				handleRefocusInput()
			} else if (["all items", "archived"].includes(inputValue.toLowerCase())) {
				toast.showError(`The name "${inputValue}" is reserved. Choose a different name.`)
				handleRefocusInput()
			} else if (getGroupsAsArray().some(group => group.name.toLowerCase() === inputValue.toLowerCase())) {
				toast.showError(`The name "${inputValue}" is already in use. Choose a different name.`)
				handleRefocusInput()
			} else {
				const [err] = await updateGroupsById([
					{
						groupId: id,
						group: { name: inputValue },
						mask: ["name"]
					}
				])

				if (err) {
					toast.showError(err.message)
					console.error(err)
					handleRefocusInput()
				} else {
					setInternalName(inputValue)
					useGroupPanelState.setState({ beingEdited: "" })

					if (e?.lastKeyDown !== "Tab") {
						ref.current.focus()
					}
				}
			}
		} else {
			// New group
			if (!inputValue) {
				useGroupPanelState.setState({ beingEdited: "" })
			} else if (["all items", "archived"].includes(inputValue.toLowerCase())) {
				toast.showError(`The name "${inputValue}" is reserved. Choose a different name.`)
				handleRefocusInput()
			} else if (getGroupsAsArray().some(group => group.name.toLowerCase() === inputValue.toLowerCase())) {
				toast.showError(`The name "${inputValue}" is already in use. Choose a different name.`)
				handleRefocusInput()
			} else {
				const [err, [newGroupId]] = await insertGroups([{ name: inputValue }])

				if (err) {
					toast.showError(err.message)
					console.error(err)
					handleRefocusInput()
				} else {
					setInternalName(inputValue)
					useGroupPanelState.setState({ beingEdited: "" })
					document.querySelector(`#group-${newGroupId}`).focus()
				}
			}
		}
	}

	function handleKeyDown(e) {
		if (e.target === ref.current) {
			if (e.key === "F2" && !noedit) {
				e.preventDefault()

				useGroupPanelState.setState({ beingEdited: id })
			} else if (e.key === "Enter" || e.key === " ") {
				e.preventDefault()

				if (selected === id) {
					useGroupPanelState.setState({ beingEdited: id })
				} else {
					useGroupPanelState.setState({ selected: id })
				}
			}
		}
	}

	async function handleSelect() {
		if (id === "Archived" && count === 0) return toast.showInfo("No archived items")
		if (beingEdited === id) return

		if (selected === id && !noedit) {
			useGroupPanelState.setState({ beingEdited: id })
		} else {
			useGroupPanelState.setState({ selected: id })
			useHomeState.setState({ selectedItems: [], activeItem: "" })
		}
	}

	async function handleBlur(e) {
		if (e.lastKeyDown === "Escape") {
			setInternalName(internalName)

			if (id === "IMCRYPT_CREATE_GROUP") {
				document.querySelector("#create-group-btn").focus()
			} else {
				ref.current.focus()
			}
		} else if (e.lastKeyDown !== "Enter" && inputValue !== internalName) {
			await handleSubmit(e)
		}

		setInternalName(inputValue)
		useGroupPanelState.setState({ beingEdited: "" })
	}

	function handleGroupDragStart(e, originId) {
		e.dataTransfer.setData("application/json", { type: "group", payload: originId })
	}

	async function handleDrop(e) {
		if (id !== "All-Items") {
			e.preventDefault()

			const { type, payload } = JSON.parse(e.dataTransfer.getData("application/json"))

			setDragHighlight(false)

			if (type === "items") {
				const { getGroupsAsArray, updateItemsById } = useDatabaseState.getState()

				if (id === "Archived") {
					const [err] = await updateItemsById(
						payload.map(itemId => ({
							itemId,
							item: { archived: true },
							mask: ["archived"]
						}))
					)

					if (err) return toast.showError(`Failed to archive items - ${err}`)

					return toast.showInfo(`Archived ${payload.length} item${payload.length > 1 ? "s" : ""}`)
				}

				const groups = getGroupsAsArray()
				const [err] = await updateItemsById(
					payload.map(itemId => {
						// ensure items don't lose the groups they're already a part of
						const groupIds = [
							...new Set([
								id,
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

				if (err) return toast.showError(`Failed to add items to group: ${err}`)

				return toast.showInfo(`Added ${payload.length} item${payload.length > 1 ? "s" : ""} to ${internalName}`)
			}
		}
	}

	function handleDragOver(e) {
		if (id !== "All-Items") {
			e.preventDefault()
		}
	}

	function handleDragEnter(e) {
		if (id !== "All-Items") {
			e.preventDefault()
			setDragHighlight(true)
		}
	}

	function handleDragLeave(e) {
		if (id !== "All-Items" && !ref.current.contains(e.relatedTarget)) {
			e.preventDefault()
			setDragHighlight(false)
		}
	}

	useImperativeHandle(outerRef, () => ref.current)

	return (
		<div
			ref={ref}
			id={`group-${id}`}
			tabIndex={0}
			className={`group${selected === id ? " selected" : ""}${beingEdited === id ? " editing" : ""}${
				dragHighlight ? " drag-highlight" : ""
			}`}
			onClick={handleSelect}
			onKeyDown={handleKeyDown}
			draggable={id !== "All-Items" && id !== "Archived"}
			onDragOver={handleDragOver}
			onDragEnter={handleDragEnter}
			onDragLeave={handleDragLeave}
			onDrop={handleDrop}>
			<span className="name">
				{beingEdited === id ? (
					<Input
						ref={inputRef}
						value={inputValue}
						onChange={handleInputChange}
						onBlur={handleBlur}
						onSubmit={handleSubmit}
						autoFocus
						autoSelect
					/>
				) : (
					internalName
				)}
			</span>
			{typeof count === "number" ? <span className="count">{count}</span> : ""}
			{menu ? <GroupMenu id={id} menu={menu} /> : ""}
		</div>
	)
}

export default forwardRef(Group)
