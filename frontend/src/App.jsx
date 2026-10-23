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
		document.addEventListener("mousedown", handleMouseDown)
		document.addEventListener("mouseup", handleMouseUp)
		return () => {
			document.removeEventListener("mousedown", handleMouseDown)
			document.removeEventListener("mouseup", handleMouseUp)
		}
	}, [mouseDownTarget])

	return children
}
