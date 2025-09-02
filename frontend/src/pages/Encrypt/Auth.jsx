import { useLayoutEffect, useState } from "react"
import Input from "../../components/Input"
import { GenerateTwoFactorSecret, ValidateTwoFactorCode } from "../../../wailsjs/go/main/App"
import Button from "../../components/Button"
import RightArrow from "../../components/svg/RightArrow"
import { usePath } from "crossroad"
import { useToast } from "../../components/Toast"
import { useConfirm } from "../../components/Confirm"
import useFocusTrap from "../../components/FocusTrap"
import { useDatabaseState } from "../../store"

export default function EncryptAuth() {
	const [img, setImg] = useState("")
	const [input, setInput] = useState("")
	const [codeInput, setCodeInput] = useState("")
	const [recovery, setRecovery] = useState("")
	const [, setPath] = usePath()
	const toast = useToast()
	const confirm = useConfirm()

	async function generate() {
		const [err, sec, qr, rec] = await GenerateTwoFactorSecret()

		if (err) throw new Error(err)

		setImg(qr)
		setInput(sec)
		setRecovery(rec)
	}

	function nevermind() {
		setPath("/home")
	}

	async function validate() {
		const [err, isValid] = await ValidateTwoFactorCode(codeInput, true)

		if (err) {
			return toast.showError(err)
		}

		if (!isValid) {
			return toast.showError("Invalid input")
		}

		confirm.open({
			title: "Success! Now, save the following secret code in case you lose access to your authenticator app.",
			message: <textarea value={recovery}></textarea>,
			confirmText: "Done",
			onConfirm: async () => {
				const [loadErr] = await useDatabaseState.getState().load()
				if (loadErr) throw loadErr

				setPath("/home", { mode: "replace" })
			},
			noCancel: true
		})
	}

	useLayoutEffect(() => {
		useFocusTrap("#encrypt-auth")
		generate()
	}, [])

	return (
		<div className="page" id="encrypt-auth">
			<div className="left-side">
				<div className="instruction">Scan the QR code using your preferred authenticator</div>
				<div className="qr-code">
					<img src={`data:image;base64,${img}`} alt="QR-code for two-factor authentication" />
				</div>
				<hr />
				<div className="instruction or">or enter the code manually</div>
				<Input className="secret-input" value={input} />
				<button onClick={nevermind} className="nevermind gradient-text">
					Nevermind, I'll set this up later.
				</button>
			</div>
			<div className="right-side">
				<div className="instruction">Then enter the 6-digit code from your authenticator app</div>
				<div className="code-input-section">
					<Input
						className="code-input"
						type="number"
						value={codeInput}
						onChange={e => setCodeInput(e.target.value)}
						onSubmit={validate}
					/>
					<Button className="submit-btn" onClick={validate}>
						<RightArrow />
					</Button>
				</div>
			</div>
		</div>
	)
}
