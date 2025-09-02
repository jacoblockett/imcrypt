import { useShallow } from "zustand/react/shallow"
import useFocusTrap from "./FocusTrap"
import Button from "./Button"
import Plus from "./svg/Plus"
import CheckMark from "./svg/CheckMark"
import XMark from "./svg/XMark"
import Lock from "./svg/Lock"
import Refresh from "./svg/Refresh"
import AtSign from "./svg/AtSign"
import Person from "./svg/Person"
import Globe from "./svg/Globe"
import Key from "./svg/Key"
import Pencil from "./svg/Pencil"
import Warning from "./svg/Warning"
import { useEffect, useRef, useState } from "react"
import { useDatabaseState, useLoginPanelState, useRulesetPanelState } from "../store"
import Input from "./Input"
import { useConfirm } from "./Confirm"
import Minus from "./svg/Minus"
import NavArrow from "./svg/NavArrow"
import { useToast } from "./Toast"
import Dropdown from "./Dropdown"
import { graphemeCount } from "../utils"

export default function LoginPanel() {
	const { getGroupsAsArray } = useDatabaseState(
		useShallow(s => ({ getGroupsAsArray: s.getGroupsAsArray, insertItem: s.insertItem }))
	)
	const lps = useLoginPanelState()
	const rps = useRulesetPanelState()
	const [saveIsDisabled, setSaveIsDisabled] = useState(true)
	const [generateIsDisabled, setGenerateIsDisabled] = useState(false)
	const [isScrolled, setIsScrolled] = useState(false)
	const toast = useToast()
	const { open: openConfirm } = useConfirm()
	const container = useRef()
	const panel = useRef()
	const closeBtn = useRef()
	const titleInput = useRef()
	const pwdInput = useRef()

	function handleClose(e) {
		e.stopPropagation()

		const state = useLoginPanelState.getState()
		const isContainer = state.mouseDownTarget === state.mouseUpTarget && state.mouseDownTarget === container.current
		const isCloseBtn =
			closeBtn.current.contains(state.mouseDownTarget) && closeBtn.current.contains(state.mouseUpTarget)

		if (!isContainer && !isCloseBtn) {
			return useLoginPanelState.setState({ mouseDownTarget: undefined, mouseUpTarget: undefined })
		}

		if (state.wereChangesMade()) {
			return openConfirm({
				message: "Are you sure you want to close this panel? Unsaved changes will be lost.",
				onConfirm: () => {
					titleInput.current.reset()
					pwdInput.current.reset()
					useRulesetPanelState.setState({ saved: false })
					document.querySelector("#login-panel-container").classList.remove("visible")
					useFocusTrap.goBack({ refocusTrigger: true })
				}
			})
		}

		titleInput.current.reset()
		pwdInput.current.reset()
		useRulesetPanelState.setState({ saved: false })
		document.querySelector("#login-panel-container").classList.remove("visible")
		useLoginPanelState.setState({ isOpen: false })
		useFocusTrap.goBack({ refocusTrigger: true })
	}

	async function handleSave() {
		const state = useLoginPanelState.getState()

		if (!state.titleInput.trim()) return toast.showError("Title must be filled in")

		const [err, isValid] = await lps.isPasswordValid()

		if (err) return toast.showError(`Couldn't validate password: ${err}`)
		if (!isValid) return toast.showError("Invalid password. Unless ruleset is optional, all rules must be followed.")

		if (state.method === "insert") {
			const [err2] = await lps.insertItem()

			if (err2) return toast.showError(`Couldn't insert item: ${err2}`)

			toast.showInfo("Login item added")
		} else if (state.method === "update") {
			const [err2] = await lps.updateItem()

			if (err2) return toast.showError(`Couldn't update item: ${err2}`)

			toast.showInfo("Login item updated")
		}

		titleInput.current.reset()
		pwdInput.current.reset()
		useRulesetPanelState.setState({ saved: false })
		document.querySelector("#login-panel-container").classList.remove("visible")
		useLoginPanelState.setState({ isOpen: false })
		useFocusTrap.goBack()
	}

	async function handlePasswordChange(e) {
		useLoginPanelState.setState({ passwordInput: e.target.value })

		const [err] = await lps.validatePassword()
		if (err) return toast.showError(`Couldn't validate password: ${err}`)
	}

	function handleWebsiteChange(newValue, index) {
		const { websitesInput } = useLoginPanelState.getState()

		useLoginPanelState.setState({
			websitesInput: websitesInput.map((preValue, preIndex) => (preIndex === index ? newValue : preValue))
		})
	}

	function handleRemoveWebsite(index) {
		const { websitesInput } = useLoginPanelState.getState()

		useLoginPanelState.setState({
			websitesInput: websitesInput.filter((_, preIndex) => preIndex !== index)
		})
	}

	async function handleGeneratePassword() {
		if (!generateIsDisabled) {
			setGenerateIsDisabled(true)
			const [err] = await lps.generatePassword()
			setGenerateIsDisabled(false)
			if (err) return toast.showError(`Couldn't generate a password: ${err}`)
		}
	}

	async function checkSaveIsDisabled() {
		const [err, sid] = await lps.isSaveDisabled()

		if (err) return toast.showError(err)

		setSaveIsDisabled(sid)
	}

	useEffect(() => {
		checkSaveIsDisabled()
	}, [lps, rps.saved])

	useEffect(() => {
		function handleScroll() {
			if (panel.current.scrollTop > 0) {
				setIsScrolled(true)
			} else {
				setIsScrolled(false)
			}
		}

		panel.current?.addEventListener("scroll", handleScroll)

		return () => {
			panel.current?.removeEventListener("scroll", handleScroll)
		}
	}, [])

	return (
		<div
			ref={container}
			id="login-panel-container"
			className="panel-container"
			onClick={handleClose}
			onMouseDown={e => useLoginPanelState.setState({ mouseDownTarget: e.target })}
			onMouseUp={e => useLoginPanelState.setState({ mouseUpTarget: e.target })}>
			<div ref={panel} id="login-panel" className="panel">
				<div className={`panel-action-bar${isScrolled ? " with-scroll" : ""}`}>
					<Button
						ref={closeBtn}
						className="close-panel-btn"
						onClick={handleClose}
						onMouseDown={e => useLoginPanelState.setState({ mouseDownTarget: e.target })}
						onMouseUp={e => useLoginPanelState.setState({ mouseUpTarget: e.target })}>
						<Plus />
					</Button>
					<div className="title">Login</div>
					<Button className="save-form-btn" disabled={saveIsDisabled} onClick={handleSave}>
						Save
					</Button>
				</div>
				<div className="form">
					<div className="required-note">* denotes a required field</div>
					<Input
						ref={titleInput}
						className="title-input"
						label="Title*"
						required
						placeholder="Enter a title"
						value={lps.titleInput}
						onChange={e => useLoginPanelState.setState({ titleInput: e.target.value })}
					/>
					<Dropdown
						className="groups-input"
						label="Groups"
						placeholder="(no groups selected)"
						showPlaceholder
						multiSelect
						options={getGroupsAsArray().map(s => ({ label: s.name, value: s.id }))}
						value={lps.groupsInput}
						onChange={value => useLoginPanelState.setState({ groupsInput: value })}
					/>
					<Input
						className="email-input"
						prefixIcon={AtSign}
						label="Email"
						placeholder="Enter an email"
						value={lps.emailInput}
						onChange={e => useLoginPanelState.setState({ emailInput: e.target.value })}
					/>
					<Input
						className="username-input"
						prefixIcon={Person}
						label="Username"
						placeholder="Enter a username"
						value={lps.usernameInput}
						onChange={e => useLoginPanelState.setState({ usernameInput: e.target.value })}
					/>
					<div className="password-field">
						<Input
							ref={pwdInput}
							className="password-input"
							prefixIcon={Lock}
							required
							label="Password*"
							placeholder="Enter a password"
							value={lps.passwordInput}
							onChange={handlePasswordChange}>
							<Button title="Generate password using rules" onClick={handleGeneratePassword}>
								<Refresh />
							</Button>
						</Input>
						<Button
							className="password-rules"
							title="Edit rules"
							onClick={() => {
								document.querySelector("#ruleset-panel-container").classList.add("visible")
								useRulesetPanelState.setState({ isOpen: true })
								useFocusTrap("#ruleset-panel-container", { trigger: ".password-rules" })
							}}>
							Rules
						</Button>
					</div>
					{lps.originalItem?.passwordIsExpired?.() || lps.originalItem?.passwordHasBeenReused?.(lps.passwordInput) ? (
						<div className="warnings-section">
							<div className="warnings-container">
								{lps.originalItem?.passwordIsExpired?.() ? (
									<div className="warning">
										<Warning />
										Password is expired
									</div>
								) : (
									""
								)}
								{lps.originalItem?.passwordHasBeenReused?.(lps.passwordInput) ? (
									<div className="warning">
										<Warning />
										Password has already been used
									</div>
								) : (
									""
								)}
							</div>
						</div>
					) : (
						""
					)}
					<div className="rules-section">
						<div className="optional">
							<span>Rules{rps.optionalInput ? " (optional)" : ""}</span>
							<div className="line"></div>
						</div>
						<div className="rules-container">
							<div className="rule">
								<div className="left">
									<div className="mark">
										{lps.validationReport.minLength && lps.validationReport.maxLength ? <CheckMark /> : <XMark />}
									</div>
									<span>
										Must be{" "}
										<strong className="highlight">
											{rps.minLengthInput}
											{+rps.minLengthInput !== +rps.maxLengthInput ? `-${rps.maxLengthInput}` : ""}
										</strong>{" "}
										characters long ({graphemeCount(lps.passwordInput)}/
										{+rps.minLengthInput !== +rps.maxLengthInput
											? `${rps.minLengthInput}-${rps.maxLengthInput}`
											: rps.maxLengthInput}
										)
									</span>
								</div>
							</div>
							{(function () {
								const sameCharMax = rps.constraintInputs.find(
									s => s.type === "samecharmax" // "not use the same character more than"
								)?.iterations

								return sameCharMax ? (
									<div className="rule">
										<div className="left">
											<div className="mark">{lps.validationReport.sameCharMax ? <CheckMark /> : <XMark />}</div>
											<span>
												Must not contain the same character more than{" "}
												<strong className="highlight">{sameCharMax}</strong> time
												{+sameCharMax === 1 ? "" : "s"}
											</span>
										</div>
									</div>
								) : (
									""
								)
							})()}
							<hr />
							<div className="rule with-right">
								<div className="left">
									<div className="mark">{lps.validationReport.charset ? <CheckMark /> : <XMark />}</div>
									<span>Must only contain:</span>
								</div>
								<div className="right">{rps.charsetTextInput}</div>
							</div>
							{(function () {
								const { atLeastConstraints, atMostConstraints } = rps.constraintInputs.reduce(
									(p, c) => {
										if (c.type === "atleast") {
											c.valid = lps.validationReport?.atLeastConstraints?.[p.atLeastConstraints.length] || false
											p.atLeastConstraints.push(c)
										} else if (c.type === "atmost") {
											c.valid = lps.validationReport?.atMostConstraints?.[p.atMostConstraints.length] || false
											p.atMostConstraints.push(c)
										}

										return p
									},
									{ atLeastConstraints: [], atMostConstraints: [] }
								)

								return [...atLeastConstraints, ...atMostConstraints].map((s, i) => (
									<div className="rule with-right" key={`rule-list-constraint-no-${i}`}>
										<div className="left">
											<div className="mark">{s.valid ? <CheckMark /> : <XMark />}</div>
											<span>
												Must {s.type} <strong className="highlight">{s.iterations}</strong> of any of:
											</span>
										</div>
										<div className="right">{s.charset}</div>
									</div>
								))
							})()}
						</div>
					</div>
					<div className="separator">
						{!lps.moreFieldsOpen ? (
							<Button
								className="extend-btn"
								onClick={() => useLoginPanelState.setState({ moreFieldsOpen: true })}
								title="More">
								<NavArrow down />
							</Button>
						) : (
							<Button
								className="extend-btn"
								onClick={() => useLoginPanelState.setState({ moreFieldsOpen: false })}
								title="Less">
								<NavArrow />
							</Button>
						)}
					</div>
					{lps.moreFieldsOpen ? (
						<>
							{lps.websitesInput.map((website, index) => {
								return (
									<div className="website-field" key={`website-input-${index}`}>
										{index ? (
											<Button
												className="delete-btn"
												onClick={() => handleRemoveWebsite(index)}
												title={`Delete ${!website.trim() ? "this website field" : `"${website}"`}`}>
												<Minus />
											</Button>
										) : (
											""
										)}
										<Input
											className="website-input"
											prefixIcon={!index ? Globe : ""}
											label={!index ? "Website" : ""}
											placeholder={!index ? "Enter a website" : "Enter another website"}
											value={website}
											onChange={e => handleWebsiteChange(e.target.value, index)}
										/>
										{index === lps.websitesInput.length - 1 ? (
											<Button
												className="extend-btn"
												onClick={() =>
													useLoginPanelState.setState({
														// explicitly grabbing a fresh state jic it's out of sync
														websitesInput: [...useLoginPanelState.getState().websitesInput, ""]
													})
												}
												title="Add another website">
												<Plus />
											</Button>
										) : (
											""
										)}
									</div>
								)
							})}
							<Input
								className="tfa-input"
								prefixIcon={Key}
								label="Two-factor authentication secret"
								placeholder="Enter a two-factor authentication secret"
								value={lps.secretInput}
								onChange={e => useLoginPanelState.setState({ secretInput: e.target.value })}
							/>
							<Input
								type="textbox"
								className="notes-input"
								prefixIcon={Pencil}
								label="Notes"
								placeholder="Write down some notes..."
								value={lps.notesInput}
								onChange={e => useLoginPanelState.setState({ notesInput: e.target.value })}
							/>
						</>
					) : (
						""
					)}
				</div>
			</div>
		</div>
	)
}

// NOTE: Not separating the action bar/wrapper boilerplate into its own separate components was
// a deliberate decision. Separating it only caused more headaches than it solved
