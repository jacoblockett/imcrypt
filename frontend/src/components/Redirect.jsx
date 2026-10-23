import { usePath } from "crossroad"
import { useEffect } from "react"
import { useToast } from "./Toast"
import { useConfirm } from "./Confirm"

export default function Redirect() {
	const [, setPath] = usePath()
	const toast = useToast()
	const confirm = useConfirm()

	function handleRedirectToLogin() {
		console.trace("expired")
		try {
			toast.showError("Your session has expired")
			confirm.close()
			setPath("/decrypt/text", { mode: "replace" })
		} catch (err) {
			console.error(err)
		}
	}

	useEffect(() => {
		window.runtime.EventsOn("e_authexp", handleRedirectToLogin)
	}, [])
}
