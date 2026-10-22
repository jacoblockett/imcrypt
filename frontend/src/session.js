import { ResumeSession } from "../wailsjs/go/main/App"
import {
	clearWorkingState,
	invalidateSessionRequests,
	useGroupPanelState,
	useHomeState,
	useLoginPanelState,
	useRulesetPanelState
} from "./store"
import useFocusTrap from "./components/FocusTrap"

// Persist data, not functions or live DOM objects. React reconstructs the
// event handlers when the authenticated view is mounted again.
function values(store) {
	return Object.fromEntries(
		Object.entries(store.getState()).filter(
			([key, value]) =>
				!["menuOpenTrigger", "mouseDownTarget", "mouseUpTarget"].includes(key) &&
				typeof value !== "function" && !(value instanceof Node)
		)
	)
}

function nodePath(root, node) {
	if (!node || !root.contains(node)) return null
	const path = []
	while (node !== root) {
		path.unshift(Array.prototype.indexOf.call(node.parentElement.children, node))
		node = node.parentElement
	}
	return path
}

function findNode(root, path) {
	if (!path) return null
	return path.reduce((node, index) => node?.children[index], root)
}

function captureView() {
	const root = document.getElementById("root")
	const active = document.activeElement
	const fields = [...root.querySelectorAll("input, textarea, select")]

	return {
		fields: fields.map(node => ({
			path: nodePath(root, node),
			value: node.value,
			checked: node.checked,
			type: node.type
		})),
		scroll: [root, ...root.querySelectorAll("*")]
			.filter(node => node.scrollTop || node.scrollLeft)
			.map(node => ({ path: nodePath(root, node), top: node.scrollTop, left: node.scrollLeft })),
		focus: nodePath(root, active),
		selection:
			typeof active?.selectionStart === "number"
				? { start: active.selectionStart, end: active.selectionEnd }
				: null
	}
}

export function captureWorkingState() {
	// Ignore responses from requests that were in flight when the lock fired.
	invalidateSessionRequests()
	const home = values(useHomeState)
	delete home.searchResults // Derived from the database; no need to duplicate it.
	const snapshot = {
		version: 1,
		home,
		group: values(useGroupPanelState),
		login: values(useLoginPanelState),
		ruleset: values(useRulesetPanelState),
		view: captureView()
	}
	useFocusTrap.clear()
	return snapshot
}

export function clearSuspendedState() {
	clearWorkingState()
	useFocusTrap.clear()
}

function restoreView(view) {
	const root = document.getElementById("root")
	if (!root || !view) return

	if (useRulesetPanelState.getState().isOpen) {
		useFocusTrap("#ruleset-panel-container")
	} else if (useLoginPanelState.getState().isOpen) {
		useFocusTrap("#login-panel-container")
	}

	for (const saved of view.fields || []) {
		const node = findNode(root, saved.path)
		if (!(node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement || node instanceof HTMLSelectElement)) {
			continue
		}

		if (node.value !== saved.value) {
			// Use the native setter so React receives a genuine input change.
			const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(node), "value")?.set
			if (setter) setter.call(node, saved.value)
			node.dispatchEvent(new Event("input", { bubbles: true }))
		}
		if (typeof saved.checked === "boolean") node.checked = saved.checked

		// The password visibility toggle is local component state.
		if (saved.type === "text" && node.type === "password") {
			node.closest(".input-container")?.querySelector(".action-button-wrapper")?.click()
		}
	}

	for (const saved of view.scroll || []) {
		const node = findNode(root, saved.path)
		if (node) {
			node.scrollTop = saved.top
			node.scrollLeft = saved.left
		}
	}

	const focused = findNode(root, view.focus)
	if (focused?.isConnected && typeof focused.focus === "function") {
		focused.focus({ preventScroll: true })
		if (view.selection && typeof focused.setSelectionRange === "function") {
			try {
				focused.setSelectionRange(view.selection.start, view.selection.end)
			} catch {
				// Date, number and other non-text fields do not support a caret.
			}
		}
	}
}

let pendingView = null

export async function restoreWorkingState() {
	const [err, serialized] = await ResumeSession()
	if (err) throw new Error(err)
	if (!serialized) return false

	const snapshot = JSON.parse(serialized)
	if (snapshot.version !== 1) throw new Error("Unsupported session version")

	for (const [store, state] of [
		[useHomeState, snapshot.home],
		[useGroupPanelState, snapshot.group],
		[useLoginPanelState, snapshot.login],
		[useRulesetPanelState, snapshot.ruleset]
	]) {
		if (state && typeof state === "object") store.setState(state)
	}
	pendingView = snapshot.view
	return true
}

// Home invokes this after the restored view has mounted, not while locked.
export function finishSessionRestore() {
	if (!pendingView) return
	const view = pendingView
	pendingView = null
	requestAnimationFrame(() => requestAnimationFrame(() => restoreView(view)))
}
