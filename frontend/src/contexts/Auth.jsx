import { createContext, useContext, useEffect } from "react"
import { Authenticate } from "../../wailsjs/go/main/App"
import { usePath } from "crossroad"
import { attempt } from "../utils"

export const AuthContext = createContext()

// TODO: Should handle auth view in a way that retains previous attempted action's state,
// prompt for login, then continue the action if login is successful
export function AuthProvider({ children }) {
	const [isAuthed, setIsAuthed] = useState(false)
	const [, setPath] = usePath()

	async function authenticate(password) {
		const [err] = await attempt(Authenticate, password)

		if (err) return err

		setIsAuthed(true)
		setPath("/home", { mode: "replace" })
	}

	useEffect(() => {
		// todo: wait for logout event, however I'm supposed to do that...
		return () => {
			setIsAuthed(false)
		}
	}, [])

	return <AuthContext.Provider value={{ authenticate, isAuthenticated: isAuthed }}>{children}</AuthContext.Provider>
}

export function useAuth() {
	return useContext(AuthContext)
}
