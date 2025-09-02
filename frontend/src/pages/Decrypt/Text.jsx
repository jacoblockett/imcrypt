import { useState, useEffect } from "react"
import Input from "../../components/Input"
import Button from "../../components/Button"
import RightArrow from "../../components/svg/RightArrow"
import {
	CloseSession,
	HasTwoFactorAuthentication,
	ReadLoadedImage,
	UnlockLoadedImage
} from "../../../wailsjs/go/main/App"
import { usePath } from "crossroad"
import { useDatabaseState, useLoadedImageState, useLoginPanelState, useRulesetPanelState } from "../../store"
import useFocusTrap from "../../components/FocusTrap"
import { useToast } from "../../components/Toast"

export default function DecryptText() {
	const { binary } = useLoadedImageState()
	const [value, setValue] = useState("")
	const [error, setError] = useState(false)
	const [hint, setHint] = useState("")
	const [, setPath] = usePath()
	const toast = useToast()

	async function handleSubmit() {
		if (!value) {
			setError(true)
			setHint("Password cannot be empty")

			return
		}

		const [authErr] = await UnlockLoadedImage(value)

		if (authErr) {
			setError(true)
			setHint("Failed to authenticate")

			return console.error("auth err:", authErr)
		}

		const [authCheckErr, hasTwoFactorAuthentication] = await HasTwoFactorAuthentication()

		if (authCheckErr) {
			setError(true)
			setHint("Failed to authenticate")

			return toast.showError(authCheckErr)
		}

		if (hasTwoFactorAuthentication) {
			setPath("/decrypt/auth", { mode: "replace" })
		} else {
			const [loadErr] = await useDatabaseState.getState().load()
			if (loadErr) throw loadErr

			setPath("/home", { mode: "replace" })
		}
	}

	function handleInput(e) {
		setValue(e.target.value)

		if (error) {
			setError(false)
			setHint("")
		}
	}

	async function handleRelease() {
		await CloseSession()
		useLoadedImageState.setState({ binary: null })
		useLoginPanelState.setState({ isOpen: false })
		useRulesetPanelState.setState({ isOpen: false })
		setPath("/", { mode: "replace" })
	}

	useEffect(() => {
		useFocusTrap("#decrypt")
		if (!binary) {
			;(async function () {
				const [err, binary] = await ReadLoadedImage()
				if (err) throw new Error(err)

				useLoadedImageState.setState({ binary })
			})()
		}
	}, [])

	return (
		<div id="decrypt" className="page">
			<div className="selected-image" style={{ backgroundImage: `url("data:image;base64,${binary}")` }}></div>
			<div className="input-field">
				<Input
					type="password"
					value={value}
					onChange={handleInput}
					label="Enter your password"
					hint={hint}
					error={error}
					onSubmit={handleSubmit}
				/>
				<Button onClick={handleSubmit} className="submit-button">
					<RightArrow />
				</Button>
			</div>
			<button className="option-btn gradient-text" onClick={handleRelease}>
				Choose a different file
			</button>
		</div>
	)
}
