import { forwardRef, useRef, useImperativeHandle } from "react"

function Button({ children, onMouseUp = () => {}, ...rest }, outerRef) {
	const buttonRef = useRef()

	// Prevents a css issue where a button that has been clicked retains
	// its focused state, creating confusion through css styles
	function handleMouseUp(e) {
		buttonRef.current.blur()
		onMouseUp(e)
	}

	useImperativeHandle(outerRef, () => buttonRef.current)

	return (
		<button ref={buttonRef} onMouseUp={handleMouseUp} {...rest}>
			{children}
		</button>
	)
}

export default forwardRef(Button)
