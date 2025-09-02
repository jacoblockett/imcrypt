import { useEffect, useRef } from "react"
import { useToast } from "./components/Toast"
import { useDatabaseState } from "./store"

export default function App({ children }) {
	const mouseDownTarget = useRef()

	useEffect(() => {
		window.runtime.EventsOn("e_storagewrite", async () => {
			useToast().showError("Most recent action failed. Please try again or report this issue if it continues.")

			const [err] = await useDatabaseState.getState().load()

			if (err) {
				throw new Error(err)
			}
		})

		function handleMouseDown(e) {
			mouseDownTarget.current = e.target
		}
		function handleMouseUp(e) {
			if (mouseDownTarget.current) {
				if (e.target !== mouseDownTarget.current) {
					if (mouseDownTarget.current.matches("input")) {
						mouseDownTarget.current.focus()
					} else {
						mouseDownTarget.current.blur()
					}
				} else {
					mouseDownTarget.current.focus()
				}
				mouseDownTarget.current = undefined
			}
		}
		document.addEventListener("mousedown", handleMouseDown)
		document.addEventListener("mouseup", handleMouseUp)
		return () => {
			document.removeEventListener("mousedown", handleMouseDown)
			document.removeEventListener("mouseup", handleMouseUp)
		}
	}, [mouseDownTarget])

	return children
}
