import { useState, useEffect } from "react"
import Input from "../../components/Input"
import Button from "../../components/Button"
import RightArrow from "../../components/svg/RightArrow"
import { DeleteTwoFactorSecret, ValidateTwoFactorRecoveryCode } from "../../../wailsjs/go/main/App"
import { usePath } from "crossroad"
import { useConfirm } from "../../components/Confirm"
import useFocusTrap from "../../components/FocusTrap"
import { useToast } from "../../components/Toast"
import { useDatabaseState } from "../../store"

export default function DecryptLost() {
	const [input, setInput] = useState("")
	const [, setPath] = usePath()
	const confirm = useConfirm()
	const toast = useToast()

	async function handleSubmit() {
		const [valErr, isValid] = await ValidateTwoFactorRecoveryCode(input)

		if (valErr) {
			return toast.showError(valErr)
		}

		if (!isValid) {
			return toast.showError("Invalid input")
		}

		confirm.open({
			title: "Are you sure want to continue?",
			message: "Your two-factor authentication will be erased and you'll have to set it up again.",
			confirmText: "Continue",
			onConfirm: async () => {
				const [err] = await DeleteTwoFactorSecret()

				if (err) {
					return toast.showError(err)
				}

				toast.showInfo("TFA has been erased from this file.")
				useDatabaseState.getState().load()
				setPath("/home", { mode: "replace" })
			}
		})
	}

	function handleLostRecoveryCode() {
		confirm.open({
			message: "Unfortunately there's no way to recover your data without the TFA recovery code.",
			noCancel: true
		})
	}

	useEffect(() => {
		useFocusTrap("#decrypt-lost")
	}, [])

	return (
		<div className="page" id="decrypt-lost">
			<h1>Enter the recovery code given to you when you setup TFA.</h1>
			<div className="code-input-section">
				<Input className="code-input" value={input} onChange={e => setInput(e.target.value)} onSubmit={handleSubmit} />
				<Button className="submit-btn" onClick={handleSubmit}>
					<RightArrow />
				</Button>
			</div>
			<button className="gradient-text option-btn" onClick={handleLostRecoveryCode}>
				I don't have the recovery code
			</button>
			<button className="gradient-text option-btn" onClick={() => setPath("/decrypt/auth", { mode: "replace" })}>
				Nevermind, I have access to my authenticator
			</button>
		</div>
	)
}
