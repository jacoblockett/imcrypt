import { createContext, useRef, useState } from "react"
import Toast from "../components/Toast"

export const ToastContext = createContext()

export function ToastProvider({ children }) {
	const ref = useRef()
	const [type, setType] = useState("")
	const [message, setMessage] = useState("")

	function handleMessage(message) {
		setType("")
		setMessage(message)
		ref.current.show()
	}

	function handleErrorMessage(message) {
		setType("error")
		setMessage(message)
		ref.current.show()
	}

	return (
		<ToastContext.Provider value={{ message: handleMessage, error: handleErrorMessage }}>
			{children}
			<Toast ref={ref} type={type} message={message} />
		</ToastContext.Provider>
	)
}
