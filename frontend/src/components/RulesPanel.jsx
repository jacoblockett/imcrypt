import { create } from "zustand"
import { useShallow } from "zustand/react/shallow"
import useFocusTrap from "./FocusTrap"
import Button from "./Button"
import Plus from "./svg/Plus"
import Minus from "./svg/Minus"
import { useEffect, useRef, useState } from "react"
import { useDatabaseState, useRulesetPanelState, charsetPresets, constraintPresetTypes } from "../store"
import Input from "./Input"
import Dropdown from "./Dropdown"
import { useConfirm } from "./Confirm"
import { tabbable } from "tabbable"
import { useToast } from "./Toast"
import { GeneratePassword } from "../../wailsjs/go/main/App"
import { sortString } from "../utils"
import isEqual from "lodash.isequal"
import Calendar from "./svg/Calendar"
import { format } from "date-fns"

export default function RulesPanel() {
	const rps = useRulesetPanelState()
	const [saveIsDisabled, setSaveIsDisabled] = useState(true)
	const { open: openConfirm } = useConfirm()
	const toast = useToast()
	const container = useRef()
	const closeBtn = useRef()

	function handleClose(e) {
		e.stopPropagation()

		const state = useRulesetPanelState.getState()
		const isContainer = state.mouseDownTarget === state.mouseUpTarget && state.mouseDownTarget === container.current
		const isCloseBtn =
			closeBtn.current.contains(state.mouseDownTarget) && closeBtn.current.contains(state.mouseUpTarget)

		if (!isContainer && !isCloseBtn) {
			return useRulesetPanelState.setState({ mouseDownTarget: undefined, mouseUpTarget: undefined })
		}

		if (state.wereChangesMade()) {
			return openConfirm({
				message: "Are you sure you want to close this panel? Unsaved changes will be lost.",
				onConfirm: () => {
					useRulesetPanelState.setState({ ...state.snapshot })
					document.querySelector("#ruleset-panel-container").classList.remove("visible")
					useRulesetPanelState.setState({ isOpen: false })
					useFocusTrap.goBack({ refocusTrigger: true })
				}
			})
		}

		document.querySelector("#ruleset-panel-container").classList.remove("visible")
		useRulesetPanelState.setState({ isOpen: false })
		useFocusTrap.goBack({ refocusTrigger: true })
	}

	async function handleSave() {
		const state = useRulesetPanelState.getState()
		state.minLengthInput = +state.minLengthInput
		state.maxLengthInput = +state.maxLengthInput

		if (state.minLengthInput > state.maxLengthInput)
			return toast.showError("Password minimum length should not exceed its maximum length")
		if (state.minLengthInput < 1 || state.minLengthInput % 1 !== 0)
			return toast.showError("Password minimum length should be a whole number >= 1")
		if (state.maxLengthInput < 1 || state.maxLengthInput % 1 !== 0)
			return toast.showError("Password maximum length should be a whole number >= 1")
		if (!state.charsetTextInput.length) return toast.showError("Allowed characters must have at least 1 character")

		for (const constraintInput of state.constraintInputs) {
			constraintInput.iterations = +constraintInput.iterations

			if (constraintInput.type === "ALC") {
				if (constraintInput.iterations < 1 || constraintInput.iterations % 1 !== 0)
					return toast.showError("'have at least' constraints must have an expected iteration number >= 1")
				if (!constraintInput.charset.length)
					return toast.showError("'have at least' constraints must have at least 1 character")
			} else if (constraintInput.type === "AMC") {
				if (constraintInput.iterations < 0 || constraintInput.iterations % 1 !== 0)
					return toast.showError("'have at most' constraints must have an expected iteration number >= 0")
				if (!constraintInput.charset.length)
					return toast.showError("'have at most' constraints must have at least 1 character")
			} else if (constraintInput.type === "SCM") {
				if (constraintInput.iterations < 1 || constraintInput.iterations % 1 !== 0)
					return toast.showError(
						"'not use the same character more than' constraints must have an expected iteration number >= 1"
					)
			}
		}

		const [invalidReason] = await state.validateRuleset()

		if (invalidReason) return toast.showError(`ruleset failed to generate a valid password: ${invalidReason}`)

		rps.setSnapshot()
		useRulesetPanelState.setState({ saved: true })
		document.querySelector("#ruleset-panel-container").classList.remove("visible")
		useRulesetPanelState.setState({ isOpen: false })
		useFocusTrap.goBack({ refocusTrigger: true })
	}

	// Panel-specific functions
	function handleCharsetTextInputChange(e) {
		const preset = charsetPresets.findIndex(c => sortString(c.charset) === sortString(e.target.value))

		useRulesetPanelState.setState({
			charsetInput: preset === -1 ? [charsetPresets.length] : [preset],
			charsetTextInput: e.target.value
		})
	}

	function handleCharsetPresetSelect(key) {
		useRulesetPanelState.setState({ charsetInput: key, charsetTextInput: charsetPresets[key].charset })
	}

	function handleAddConstraint() {
		useRulesetPanelState.setState({
			constraintInputs: [...useRulesetPanelState.getState().constraintInputs, { type: "", iterations: 1, charset: "" }]
		})
	}

	function handleRemoveConstraint(index) {
		useRulesetPanelState.setState({
			constraintInputs: useRulesetPanelState.getState().constraintInputs.filter((_, preIndex) => preIndex !== index)
		})
	}

	// NOTE: constraintIndex is the corresponding constraint in rulesConstraints
	function handleConstraintTypeSelect(dropdownKey, constraintIndex) {
		useRulesetPanelState.setState({
			constraintInputs: useRulesetPanelState
				.getState()
				.constraintInputs.map((c, i) =>
					i === constraintIndex ? { ...c, type: constraintPresetTypes[dropdownKey].abbr } : c
				)
		})
	}

	function handleConstraintIterationsChange(value, constraintIndex) {
		useRulesetPanelState.setState({
			constraintInputs: useRulesetPanelState
				.getState()
				.constraintInputs.map((c, i) => (i === constraintIndex ? { ...c, iterations: value } : c))
		})
	}

	function handleConstraintCharsetChange(value, constraintIndex) {
		useRulesetPanelState.setState({
			constraintInputs: useRulesetPanelState
				.getState()
				.constraintInputs.map((c, i) => (i === constraintIndex ? { ...c, charset: value } : c))
		})
	}

	function handleMinLengthChange(e) {
		const n = +e.target.value
		const trueN = n < 0 ? 0 : n

		return useRulesetPanelState.setState({ minLengthInput: trueN })
	}

	function handleMaxLengthChange(e) {
		const n = +e.target.value
		const trueN = n < 0 ? 0 : n

		return useRulesetPanelState.setState({ maxLengthInput: trueN })
	}

	useEffect(() => {
		if (rps.wereChangesMade()) {
			setSaveIsDisabled(false)
		} else {
			setSaveIsDisabled(true)
		}
	}, [rps])

	return (
		<div
			ref={container}
			id={"ruleset-panel-container"}
			className="panel-container"
			onClick={handleClose}
			onMouseDown={e => useRulesetPanelState.setState({ mouseDownTarget: e.target })}
			onMouseUp={e => useRulesetPanelState.setState({ mouseUpTarget: e.target })}>
			<div id="ruleset-panel" className="panel">
				<div className="panel-action-bar">
					<Button
						ref={closeBtn}
						className="close-panel-btn"
						onClick={handleClose}
						onMouseDown={e => useRulesetPanelState.setState({ mouseDownTarget: e.target })}
						onMouseUp={e => useRulesetPanelState.setState({ mouseUpTarget: e.target })}>
						<Plus />
					</Button>
					<div className="title">Ruleset</div>
					<Button className="save-form-btn" disabled={saveIsDisabled} onClick={handleSave}>
						Save
					</Button>
				</div>
				<div className="form">
					<section>
						<div className="general-rule">
							<div className="question">Rules are optional:</div>
							<div className="answer toggle">
								<Button
									className={rps.optionalInput ? "selected" : ""}
									onClick={() => useRulesetPanelState.setState({ optionalInput: true })}>
									Yes
								</Button>
								<Button
									className={!rps.optionalInput ? "selected" : ""}
									onClick={() => useRulesetPanelState.setState({ optionalInput: false })}>
									No
								</Button>
							</div>
						</div>
						<div className="general-rule">
							<div className="question">Password length:</div>
							<div className="answer">
								<Input
									className="min"
									min={1}
									type="number"
									value={rps.minLengthInput}
									onChange={handleMinLengthChange}
								/>
								<span>to</span>
								<Input
									className="max"
									min={1}
									type="number"
									value={rps.maxLengthInput}
									onChange={handleMaxLengthChange}
								/>
							</div>
						</div>
						<div className="general-rule">
							<div className="question">Password expires in:</div>
							<div className="answer">
								<Input
									className="password-ttl-number"
									value={rps.passwordTTLIncrementInput}
									min={1}
									type="number"
									onChange={e => useRulesetPanelState.setState({ passwordTTLIncrementInput: e.target.value })}
								/>
								<Dropdown
									className="password-ttl-dropdown"
									value={rps.passwordTTLUnitInput}
									options={[
										{ label: `day${rps.passwordTTLIncrementInput > 1 ? "s" : ""}` },
										{ label: `month${rps.passwordTTLIncrementInput > 1 ? "s" : ""}` },
										{ label: `year${rps.passwordTTLIncrementInput > 1 ? "s" : ""}` }
									]}
									onChange={value => useRulesetPanelState.setState({ passwordTTLUnitInput: value })}
								/>
							</div>
						</div>
						<div className="general-rule">
							<div className="question">Allow passwords to be reused:</div>
							<div className="answer toggle">
								<Button
									className={rps.allowPasswordReuseInput ? "selected" : ""}
									onClick={() => useRulesetPanelState.setState({ allowPasswordReuseInput: true })}>
									Yes
								</Button>
								<Button
									className={!rps.allowPasswordReuseInput ? "selected" : ""}
									onClick={() => useRulesetPanelState.setState({ allowPasswordReuseInput: false })}>
									No
								</Button>
							</div>
						</div>
					</section>
					<section>
						<hr />
						<Dropdown
							options={[...charsetPresets.map(p => ({ label: p.name })), { label: "Custom", hidden: true }]}
							value={rps.charsetInput}
							onChange={handleCharsetPresetSelect}
						/>
						<Input
							type="textbox"
							className="character-set-input"
							label="Charset"
							value={rps.charsetTextInput}
							onChange={handleCharsetTextInputChange}
						/>
					</section>
					<section>
						<hr />
						{rps.constraintInputs.map(({ type, iterations, charset }, index) => (
							<div key={`constraint-${index}`} className="constraint">
								<Button className="delete-btn" onClick={() => handleRemoveConstraint(index)}>
									<Minus />
								</Button>
								<div className="sentence">
									<span>Must</span>
									<Dropdown
										className="constraint-type"
										options={constraintPresetTypes.map(({ abbr, selectText }) => ({ label: selectText, value: abbr }))}
										value={constraintPresetTypes.findIndex(s => s.abbr === type)}
										onChange={selected => handleConstraintTypeSelect(selected, index)}
									/>
									{type === "ALC" || type === "AMC" ? (
										<>
											<Input
												type="number"
												min={1}
												max={999}
												value={iterations}
												onChange={e => handleConstraintIterationsChange(e.target.value, index)}
											/>
											<span>of</span>
											<Input
												value={charset}
												onChange={e => handleConstraintCharsetChange(e.target.value, index)}
												placeholder="Enter a charset"
											/>
										</>
									) : type === "SCM" ? (
										<>
											<Input
												type="number"
												value={iterations}
												onChange={e => handleConstraintIterationsChange(e.target.value, index)}
											/>
											<span>time{iterations > 1 ? "s" : ""}</span>
										</>
									) : (
										""
									)}
								</div>
							</div>
						))}
						<Button className="init-constraints-btn" onClick={handleAddConstraint}>
							Add a constraint
						</Button>
					</section>
				</div>
			</div>
		</div>
	)
}

// NOTE: Not separating the action bar/wrapper boilerplate into its own separate components was
// a deliberate decision. Separating it only caused more headaches than it solved
