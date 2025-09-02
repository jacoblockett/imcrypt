import { tabbable } from "tabbable"
import { create } from "zustand"

const state = create((set, get) => ({
	trigger: undefined,
	node: undefined,
	exclude: [],
	history: [],
	getTabList: () => {
		const { node, exclude } = get()

		if (isValidElement(node)) {
			return tabbable(node).filter(node => !exclude.some(eNode => eNode.contains(node)))
		}

		return []
	}
}))

function isValidElement(el) {
	return el instanceof Node && el.nodeType === Node.ELEMENT_NODE
}

function getElements(referenceOrQuerySelector) {
	const nodes = []

	if (typeof referenceOrQuerySelector === "string") {
		nodes.push(...document.querySelectorAll(referenceOrQuerySelector))
	} else if (isValidElement(referenceOrQuerySelector?.current)) {
		nodes.push(referenceOrQuerySelector.current)
	}

	return nodes.filter(node => isValidElement(node))
}

function focusNext(current) {
	const { getTabList } = state.getState()
	const tabList = getTabList()
	const currentIndex = tabList.indexOf(current)
	const first = tabList[0]

	if (tabList.length) {
		if (current !== -1) {
			const next = !tabList[currentIndex + 1] ? first : tabList[currentIndex + 1]
			next.focus()
		} else {
			first.focus()
		}
	}
}

function focusPrevious(current) {
	const { getTabList } = state.getState()
	const tabList = getTabList()
	const currentIndex = tabList.indexOf(current)
	const last = tabList[tabList.length - 1]

	if (tabList.length) {
		if (current !== -1) {
			const previous = !tabList[currentIndex - 1] ? last : tabList[currentIndex - 1]
			previous.focus()
		} else {
			last.focus()
		}
	}
}

function handleTrappedFocus(e) {
	if (e.key === "Tab") {
		e.preventDefault()

		if (e.shiftKey) {
			focusPrevious(e.target)
		} else {
			focusNext(e.target)
		}
	}
}

/**
 * Creates a focus trap on the given element, only allowing keyboard-event driven focus on the its
 * children.
 *
 * @ref https://www.npmjs.com/package/tabbable
 *
 * @param {string|HTMLElement} referenceOrQuerySelector
 * @param {object} options
 * @param {string|HTMLElement} options.trigger The element that triggered the focus - useful if using useFocusTrap.goBack to re-focus the element that triggered the change
 * @param {Array<string|HTMLElement>} options.exclude Elements to exclude from the tabbable list
 */
function useFocusTrap(referenceOrQuerySelector, options) {
	const nodeMatches = getElements(referenceOrQuerySelector)

	if (nodeMatches.length !== 1) throw new Error("no singular node found at the given reference/query selector")

	const node = nodeMatches[0]

	if (Object.prototype.toString.call(options) !== "[object Object]") {
		options = { trigger: undefined, exclude: [] }
	} else {
		const triggerNodeMatches = getElements(options.trigger)

		if (triggerNodeMatches.length === 1) options.trigger = triggerNodeMatches[0]

		if (Array.isArray(options.exclude)) {
			options.exclude = options.exclude.map(getElements).flat()
		} else {
			options.exclude = []
		}
	}

	const { history } = state.getState()

	history.push({ node, exclude: options.exclude, trigger: options.trigger })

	state.setState({ node, exclude: options.exclude, trigger: options.trigger, history })

	document.addEventListener("keydown", handleTrappedFocus)
}

/**
 * Goes back to the previously focused element. If no element was previously focused, all focus traps
 * are removed. A callback is provided to reference both the focus trap before goBack is called,
 * and the focusTrap it's moving to.
 *
 * @param {object} options
 * @param {boolean} options.refocusTrigger Refocuses the trigger that was given to useFocusTrap as the reason for the focus trap's current location
 */
useFocusTrap.goBack = function (options) {
	const { history } = state.getState()
	const current = history.pop()
	const destination = history.pop()

	if (!destination) document.removeEventListener("keydown", handleTrappedFocus)

	state.setState({
		node: destination?.node,
		exclude: destination?.exclude || [],
		trigger: destination?.trigger,
		history
	})

	if (options?.refocusTrigger) {
		current?.trigger?.focus?.()
	}
}

/**
 * Focuses the next tabbable element. If a reference target is given, it will be used as the basis from which
 * to derive the next element. Otherwise, the document's currently active element will be used.
 *
 * @param {string|HTMLElement} referenceTarget Can be a node or a query selector
 */
useFocusTrap.focusNext = function (referenceTarget) {
	const nodeMatches = getElements(referenceTarget)
	const currentTarget = nodeMatches.length === 1 ? nodeMatches[0] : document.activeElement

	focusNext(currentTarget)
}

/**
 * Focuses the previous tabbable element. If a reference target is given, it will be used as the basis from which
 * to derive the previous element. Otherwise, the document's currently active element will be used.
 *
 * @param {string|HTMLElement} referenceTarget Can be a node or a query selector
 */
useFocusTrap.focusPrevious = function (referenceTarget) {
	const nodeMatches = getElements(referenceTarget)
	const currentTarget = nodeMatches.length === 1 ? nodeMatches[0] : document.activeElement

	focusPrevious(currentTarget)
}

export default useFocusTrap
