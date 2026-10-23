import { usePath } from "crossroad"
import { useEffect, useState } from "react"
import { flushSync } from "react-dom"
import { SuspendSession } from "../../wailsjs/go/main/App"
import { captureWorkingState, clearSuspendedState } from "../session"
import { useToast } from "./Toast"
import { useConfirm } from "./Confirm"

export default function Redirect() {
	const [, setPath] = usePath()
	const toast = useToast()
	const confirm = useConfirm()

	const [locking, setLocking] = useState(false)

	async function handleSessionLock() {
		// Cover the current view before handing its working state to Go.
		flushSync(() => setLocking(true))
		let saved = false
		try {
			const snapshot = captureWorkingState()
			document.querySelector(".session-lock-cover")?.focus()
			const [err] = await SuspendSession(JSON.stringify(snapshot))
			if (err) throw new Error(err)
			saved = true
		} catch (err) {
			console.error("Failed to suspend session:", err)
		} finally {
			flushSync(() => setPath("/decrypt/text", { mode: "replace" }))
			confirm.close()
			clearSuspendedState()
			setLocking(false)
			toast.showError(saved ? "Your session has expired" : "Session expired; unfinished work could not be preserved.")
		}
	}

	useEffect(() => {
		const off = window.runtime.EventsOn("e_authlock", handleSessionLock)
		return () => {
			if (typeof off === "function") off()
			else window.runtime.EventsOff("e_authlock")
		}
	}, [])

	return locking ? <div className="session-lock-cover" tabIndex={-1} /> : null
}
