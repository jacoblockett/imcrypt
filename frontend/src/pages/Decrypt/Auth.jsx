import { useState, useEffect } from "react"
import Input from "../../components/Input"
import Button from "../../components/Button"
import RightArrow from "../../components/svg/RightArrow"
import { useToast } from "../../components/Toast"
import { usePath } from "crossroad"
import { useDatabaseState, useLoadedImageState, useLoginPanelState, useRulesetPanelState } from "../../store"
import { ValidateTwoFactorCode, CloseSession } from "../../../wailsjs/go/main/App"
import useFocusTrap from "../../components/FocusTrap"

export default function DecryptAuth() {
	const [codeInput, setCodeInput] = useState("")
	const toast = useToast()
	const [, setPath] = usePath()

	async function handleSubmit() {
		const [err, isValid] = await ValidateTwoFactorCode(codeInput, true)

		if (err) {
			return toast.showError(err)
		}

		if (!isValid) {
			return toast.showError("Invalid input")
		}

		const [loadErr] = await useDatabaseState.getState().load()
		if (loadErr) throw loadErr

		setPath("/home", { mode: "replace" })
	}

	function handleLostAccess() {
		setPath("/decrypt/lost", { mode: "replace" })
	}

	async function handleRelease() {
		await CloseSession()

		useLoadedImageState.setState({ binary: null })
		useLoginPanelState.setState({ isOpen: false })
		useRulesetPanelState.setState({ isOpen: false })
		setPath("/", { mode: "replace" })
	}

	useEffect(() => {
		useFocusTrap("#decrypt-auth")
	}, [])

	return (
		<div className="page" id="decrypt-auth">
			<h1>Enter the 6-digit code from your authenticator.</h1>
			<div className="code-input-section">
				<Input
					className="code-input"
					type="number"
					value={codeInput}
					onChange={e => setCodeInput(e.target.value)}
					onSubmit={handleSubmit}
				/>
				<Button className="submit-btn" onClick={handleSubmit}>
					<RightArrow />
				</Button>
			</div>
			<button className="gradient-text option-btn" onClick={handleRelease}>
				Choose a different file
			</button>
			<button className="gradient-text option-btn" onClick={handleLostAccess}>
				I lost access to my authenticator
			</button>
		</div>
	)
}
