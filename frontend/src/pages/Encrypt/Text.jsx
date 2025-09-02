import { useState, useEffect } from "react"
import Input from "../../components/Input"
import Button from "../../components/Button"
import { InitializeStorage, ReadLoadedImage, CloseSession } from "../../../wailsjs/go/main/App"
import { usePath } from "crossroad"
import { useLoadedImageState, useLoginPanelState, useRulesetPanelState } from "../../store"
import { useConfirm } from "../../components/Confirm"
import useFocusTrap from "../../components/FocusTrap"

export default function EncryptText() {
	const { binary } = useLoadedImageState()
	const [, setPath] = usePath()
	const confirm = useConfirm()
	const [firstValue, setFirstValue] = useState("")
	const [firstError, setFirstError] = useState(false)
	const [firstHint, setFirstHint] = useState("")
	const [secondValue, setSecondValue] = useState("")
	const [secondError, setSecondError] = useState(false)
	const [secondHint, setSecondHint] = useState("")

	async function handleSubmit() {
		if (firstValue !== secondValue) {
			setFirstError(true)
			setFirstHint("Passwords do not match")
			setSecondError(true)
			setSecondHint("Passwords do not match")

			return
		} else if (!firstValue) {
			setFirstError(true)
			setFirstHint("Password cannot be empty")

			return
		}

		const [err] = await InitializeStorage(firstValue)

		if (err) throw new Error(err)

		confirm.open({
			message: "Would you like to set up two-factor authentication?",
			confirmText: "Yes",
			cancelText: "No",
			onConfirm: () => setPath("/encrypt/auth", { mode: "replace" }),
			onCancel: () => setPath("/home", { mode: "replace" })
		})
	}

	function handleFirstInput(e) {
		setFirstValue(e.target.value)

		if (firstError) {
			setFirstError(false)
			setFirstHint("")
		}

		if (secondError) {
			setSecondError(false)
			setSecondHint("")
		}
	}

	function handleSecondInput(e) {
		setSecondValue(e.target.value)

		if (firstError) {
			setFirstError(false)
			setFirstHint("")
		}

		if (secondError) {
			setSecondError(false)
			setSecondHint("")
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
		useFocusTrap("#encrypt")
		if (!binary) {
			;(async function () {
				const [err, binary] = await ReadLoadedImage()
				if (err) throw new Error(err)

				useLoadedImageState.setState({ binary })
			})()
		}
	}, [])

	return (
		<div id="encrypt" className="page">
			<div className="selected-image" style={{ backgroundImage: `url("data:image;base64,${binary}")` }}></div>
			<Input
				type="password"
				value={firstValue}
				onChange={handleFirstInput}
				onSubmit={handleSubmit}
				label="Create a password"
				hint={firstHint}
				error={firstError}
			/>
			<Input
				type="password"
				value={secondValue}
				onChange={handleSecondInput}
				onSubmit={handleSubmit}
				label="Enter it again"
				hint={secondHint}
				error={secondError}
			/>
			<Button onClick={handleSubmit} className="submit-button">
				Submit
			</Button>
			<button className="option-btn gradient-text" onClick={handleRelease}>
				Choose a different file
			</button>
		</div>
	)
}
