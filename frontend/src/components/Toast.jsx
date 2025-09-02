import { useEffect, useRef } from "react"
import { create } from "zustand"
import { useShallow } from "zustand/react/shallow"

const toastState = create(() => ({
	type: "",
	message: "",
	visible: false,
	shake: false
}))

const visibleTime = 5000
const shakeTime = 500

export function useToast() {
	const vtimeout = useRef()
	const stimeout = useRef()

	function show() {
		if (toastState.getState().visible) {
			clearTimeout(vtimeout.current)
			clearTimeout(stimeout.current)

			toastState.setState({ shake: true })

			vtimeout.current = setTimeout(hide, visibleTime)
			stimeout.current = setTimeout(() => toastState.setState({ shake: false }), shakeTime)
		} else {
			clearTimeout(vtimeout.current) // here just in case - not 100% sure if necessary but I've been burned by this in the past
			clearTimeout(stimeout.current) // here just in case - not 100% sure if necessary but I've been burned by this in the past

			vtimeout.current = setTimeout(hide, visibleTime)
			toastState.setState({ visible: true })
		}
	}

	function hide() {
		clearTimeout(vtimeout.current)
		clearTimeout(stimeout.current)
		toastState.setState({ visible: false, shake: false })
	}

	function showInfo(message) {
		toastState.setState({ message, type: "info" })
		show()
	}

	function showError(message) {
		toastState.setState({ message, type: "error" })
		show()
	}

	useEffect(() => {
		return () => {
			if (vtimeout.current) {
				clearTimeout(vtimeout.current)
			}
			if (stimeout.current) {
				clearTimeout(stimeout.current)
			}
		}
	}, [])

	return { showInfo, showError, hide }
}

export default function Toast() {
	const state = toastState()
	const toast = useToast()

	function handleClick() {
		toast.hide()
	}

	return (
		<div
			className={`toast${state.type ? ` ${state.type}` : ""}${state.visible ? " visible" : ""}${
				state.shake ? " shake" : ""
			}`}
			onClick={handleClick}>
			{state.type === "error" ? <div className="icon">!</div> : ""}
			<div className="message">{state.message}</div>
		</div>
	)
}
