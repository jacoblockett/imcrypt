import { create } from "zustand"
import Button from "./Button"
import useFocusTrap from "./FocusTrap"
import { tabbable } from "tabbable"

const confirmState = create((set, get) => ({
	title: "",
	message: "",
	confirmText: "Confirm",
	cancelText: "Cancel",
	noCancel: false,
	onConfirm: () => {},
	onCancel: () => {}
}))

export function useConfirm() {
	function open(init) {
		confirmState.setState({
			title: typeof init?.title === "string" ? init.title : "",
			message: init?.message ?? "",
			confirmText: typeof init?.confirmText === "string" ? init.confirmText : "Confirm",
			cancelText: typeof init?.cancelText === "string" ? init.cancelText : "Cancel",
			noCancel: typeof init?.noCancel === "boolean" ? init.noCancel : false,
			onConfirm: typeof init?.onConfirm === "function" ? init.onConfirm : () => {},
			onCancel: typeof init?.onCancel === "function" ? init.onCancel : () => {}
		})

		const modal = document.querySelector("#confirm-modal-container")
		const btns = modal.querySelectorAll("button")

		modal.classList.add("visible")
		btns.forEach(btn => (btn.tabIndex = 0))

		useFocusTrap("#confirm-modal")

		const formTabList = tabbable(document.querySelector("#confirm-modal"))
		const first = formTabList[0]

		first.focus()
	}

	function close() {
		const modal = document.querySelector("#confirm-modal-container")
		const btns = modal.querySelectorAll("button")

		modal.classList.remove("visible")
		btns.forEach(btn => (btn.tabIndex = -1))

		confirmState.setState({
			title: "",
			message: "",
			onConfirm: () => {},
			onCancel: () => {},
			noCancel: false,
			confirmText: "Confirm",
			cancelText: "Cancel"
		})
	}

	return { open, close }
}

export default function Confirm() {
	const { title, message, confirmText, cancelText, noCancel, onCancel, onConfirm } = confirmState()
	const { close } = useConfirm()

	function handleKeyDown(e) {
		if (e.key === "Escape") {
			e.preventDefault()
			e.stopPropagation()

			handleCancel()
		}
	}

	function handleCancel() {
		close()
		onCancel()
	}

	function handleConfirm() {
		close()
		onConfirm()
	}

	return (
		<div id="confirm-modal-container" className="confirm-container">
			<div id="confirm-modal" className="modal">
				{title ? <div className="title">{title}</div> : ""}
				<div className="message">{message}</div>
				<div className="buttons" onKeyDown={handleKeyDown}>
					<Button tabIndex={-1} className="confirm-btn" onClick={handleConfirm}>
						{confirmText}
					</Button>
					{!noCancel ? (
						<Button tabIndex={-1} className="cancel-btn" onClick={handleCancel}>
							{cancelText}
						</Button>
					) : (
						""
					)}
				</div>
			</div>
		</div>
	)
}
