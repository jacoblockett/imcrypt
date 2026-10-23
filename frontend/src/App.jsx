import { useEffect, useRef } from "react"

export default function App({ children }) {
	const mouseDownTarget = useRef()

	useEffect(() => {
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
		// Prevent file-drop navigation if native WebView2 suppression fails.
		// Non-file HTML5 drag events retain their default behavior.
		function preventFileDropNavigation(e) {
			if (e.dataTransfer?.types?.includes("Files")) {
				e.preventDefault()
			}
		}
		window.addEventListener("dragover", preventFileDropNavigation, true)
		window.addEventListener("drop", preventFileDropNavigation, true)
		document.addEventListener("mousedown", handleMouseDown)
		document.addEventListener("mouseup", handleMouseUp)
		return () => {
			window.removeEventListener("dragover", preventFileDropNavigation, true)
			window.removeEventListener("drop", preventFileDropNavigation, true)
			document.removeEventListener("mousedown", handleMouseDown)
			document.removeEventListener("mouseup", handleMouseUp)
		}
	}, [mouseDownTarget])

	return children
}
