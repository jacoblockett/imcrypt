import { useState } from "react"
import { usePath } from "crossroad"
import Input from "../components/Input"
import Button from "../components/Button"
import { useToast } from "../components/Toast"
import { useDatabaseState, useLoadedImageState, clearWorkingState } from "../store"
import { restoreWorkingState } from "../session"
import {
	CheckRecovery, RestoreRecovery, DeleteRecovery, OpenRecoveryCurrent,
	HasStorage, ReadLoadedImage, UnlockLoadedImage, HasTwoFactorAuthentication, CloseSession
} from "../../wailsjs/go/main/App"

export default function Recovery() {
	const [, setPath] = usePath()
	const toast = useToast()
	const [password, setPassword] = useState("")
	const [info, setInfo] = useState(null)
	const [step, setStep] = useState("password")
	const [busy, setBusy] = useState(false)

	async function openVault() {
		const [existsErr, hasStorage] = await HasStorage()
		if (existsErr) throw new Error(existsErr)
		const [imageErr, binary] = await ReadLoadedImage()
		if (imageErr) throw new Error(imageErr)
		useLoadedImageState.setState({ binary })

		if (!hasStorage) {
			setPath("/encrypt/text", { mode: "replace" })
			return
		}
		const [err] = await UnlockLoadedImage(password)
		if (err) throw new Error(err)
		const [authErr, needsTOTP] = await HasTwoFactorAuthentication()
		if (authErr) throw new Error(authErr)
		if (needsTOTP) {
			setPath("/decrypt/auth", { mode: "replace" })
		} else {
			const [loadErr] = await useDatabaseState.getState().load()
			if (loadErr) throw loadErr
			await restoreWorkingState()
			setPath("/home", { mode: "replace" })
		}
	}

	async function run(action) {
		if (busy) return
		setBusy(true)
		try { await action() }
		catch (err) { toast.showError(String(err?.message || err)) }
		finally { setBusy(false) }
	}

	function inspect() {
		run(async () => {
			if (!password) throw new Error("Password cannot be empty")
			const [err, found, details] = await CheckRecovery(password)
			if (err) throw new Error("Unable to authenticate recovery journal with that password")
			if (!found) {
				const [openErr] = await OpenRecoveryCurrent(password)
				if (openErr) throw new Error(openErr)
				await openVault()
				return
			}
			setInfo(details)
			setStep("review")
		})
	}

	function restore() {
		run(async () => {
			const [err] = await RestoreRecovery(password)
			if (err) throw new Error(err)
			await openVault()
		})
	}

	function openCurrent(deleteJournal) {
		run(async () => {
			const [openErr] = await OpenRecoveryCurrent(password)
			if (openErr) throw new Error(openErr)
			if (deleteJournal) {
				const [deleteErr] = await DeleteRecovery(password)
				if (deleteErr) throw new Error(deleteErr)
			}
			await openVault()
			if (!deleteJournal) toast.showInfo("Recovery journal retained. Further saves require resolving it first.")
		})
	}

	function cancel() {
		run(async () => {
			await CloseSession()
			clearWorkingState()
			useLoadedImageState.setState({ binary: "" })
			setPath("/open", { mode: "replace" })
		})
	}

	return (
		<div id="decrypt" className="page">
			{step === "password" ? (
				<>
					<h1>Check for interrupted save</h1>
					<p>Enter your master password to inspect an encrypted recovery file. No files will be changed.</p>
					<div className="input-field">
						<Input type="password" value={password} onChange={e => setPassword(e.target.value)}
							label="Master password" onSubmit={inspect} />
						<Button disabled={busy} onClick={inspect}>Continue</Button>
					</div>
				</>
			) : step === "review" ? (
				<>
					<h1>Recovery available</h1>
					<p>Image: {info.name}</p>
					<p>Recovery created: {new Date(info.created * 1000).toLocaleString()}</p>
					<p>{info.state === "missing"
						? "The original image is missing. Imcrypt can reconstruct it using this recovery journal."
						: info.state === "completed"
						? "The current image matches the completed save. The journal contains the older version."
						: info.state === "original"
						? "The current image matches the version saved before the interrupted operation."
						: "The current image differs from the recovery copy. It may be incomplete or contain newer data."}</p>
					<p>Restoring replaces the current image if one exists. Any newer changes in that image will be lost.</p>
					<Button disabled={busy} onClick={restore}>Restore previous image</Button>
					{info.state !== "missing" && (
						<Button disabled={busy} onClick={() => setStep("keep")}>Open current image instead</Button>
					)}
				</>
			) : step === "keep" ? (
				<>
					<h1>Keep the recovery journal?</h1>
					<p>You have chosen not to restore. Keeping the journal allows recovery later, but prevents further saves to this image until you resolve it.</p>
					<Button disabled={busy} onClick={() => openCurrent(false)}>Keep journal and open image</Button>
					<Button disabled={busy} onClick={() => setStep("confirmDelete")}>Delete recovery journal</Button>
					<button className="option-btn gradient-text" onClick={() => setStep("review")}>Back</button>
				</>
			) : (
				<>
					<h1>Delete recovery permanently?</h1>
					<p>Deleting the journal permanently discards the previous image version. It cannot be recovered afterward. The current image will not be replaced.</p>
					<Button disabled={busy} onClick={() => openCurrent(true)}>Delete journal and open current image</Button>
					<Button disabled={busy} onClick={() => openCurrent(false)}>Keep recovery journal</Button>
					<button className="option-btn gradient-text" onClick={() => setStep("keep")}>Back</button>
				</>
			)}
			<button className="option-btn gradient-text" disabled={busy} onClick={cancel}>Choose a different file</button>
		</div>
	)
}
