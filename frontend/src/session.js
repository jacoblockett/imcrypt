import { ResumeSession } from "../wailsjs/go/main/App"
import {
	clearWorkingState,
	invalidateSessionRequests,
	useHomeState,
	useGroupPanelState,
	useLoginPanelState,
	useRulesetPanelState
} from "./store"
import useFocusTrap from "./components/FocusTrap"

// Store data only. React callbacks and live DOM references cannot be restored
// from JSON and must be recreated by the components after authentication.
function values(store) {
	return Object.fromEntries(
		Object.entries(store.getState()).filter(
			([key, value]) =>
				!["menuOpenTrigger", "mouseDownTarget", "mouseUpTarget", "searchResults"].includes(key) &&
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
	return {
		fields: [...root.querySelectorAll("input, textarea, select")].map(node => ({
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
				? { start: active.selectionStart, end: active.selectionEnd, direction: active.selectionDirection }
				: null
	}
}

export function captureWorkingState() {
	invalidateSessionRequests()
	return {
		version: 1,
		home: values(useHomeState),
		group: values(useGroupPanelState),
		login: values(useLoginPanelState),
		ruleset: values(useRulesetPanelState),
		view: captureView()
	}
}

export function clearSuspendedState() {
	clearWorkingState(true)
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
			// Dispatch through React's onChange so local component state also
			// recovers (for example the inline group-name editor).
			const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(node), "value")?.set
			if (setter) setter.call(node, saved.value)
			node.dispatchEvent(new Event("input", { bubbles: true }))
		}
		if (typeof saved.checked === "boolean") node.checked = saved.checked
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
				focused.setSelectionRange(view.selection.start, view.selection.end, view.selection.direction)
			} catch {
				// Numeric/date controls do not support selection ranges.
			}
		}
	}
}

let pendingView = null

export async function restoreWorkingState() {
	const [err, serialized] = await ResumeSession()
	if (err) throw new Error(err)
	if (!serialized) return

	const snapshot = JSON.parse(serialized)
	if (snapshot.version !== 1) throw new Error("Unsupported saved session version")

	for (const [store, state] of [
		[useHomeState, snapshot.home],
		[useGroupPanelState, snapshot.group],
		[useLoginPanelState, snapshot.login],
		[useRulesetPanelState, snapshot.ruleset]
	]) {
		if (state && typeof state === "object") store.setState(state)
	}
	pendingView = snapshot.view
}

// Home calls this after React has mounted the restored view.
export function finishSessionRestore() {
	if (!pendingView) return
	const view = pendingView
	pendingView = null
	requestAnimationFrame(() => requestAnimationFrame(() => restoreView(view)))
}
