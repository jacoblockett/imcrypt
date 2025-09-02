import { Route, usePath } from "crossroad"
import { useEffect } from "react"
import { IsAuthenticated } from "../../wailsjs/go/main/App"
import { useConfirm } from "./Confirm"
import { useToast } from "./Toast"

function ProtectedRoute({ children, ...rest }) {
	const [, setPath] = usePath()
	const toast = useToast()
	const confirm = useConfirm()

	function handleRedirectToOpen() {
		toast.showError("Unauthorized access")
		confirm.close()
		setPath("/open", { mode: "replace" })
	}

	useEffect(() => {
		;(async function () {
			const [err, isAuthed] = await IsAuthenticated()

			if (err) {
				console.error("auth error:", err)
				handleRedirectToOpen()
			} else if (!isAuthed) {
				console.error("not authenticated")
				handleRedirectToOpen()
			}
		})()
	})

	return <Route {...rest} />
}

export default ProtectedRoute
