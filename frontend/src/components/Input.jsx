import { useState, forwardRef, useRef, useImperativeHandle, useEffect, Children, isValidElement } from "react"
import PasswordEye from "./svg/PasswordEye"
import Button from "./Button"
import Dropdown from "./Dropdown"
import NavArrow from "./svg/NavArrow"
import Calendar from "./svg/Calendar"

function Input(props, outerRef) {
	if (props.type === "dropdown") return <Dropdown {...props} />

	const {
		className,
		inputElClassName,
		prefixIcon,
		disabled = false,
		hint,
		error,
		required = false,
		type = "text",
		value = "",
		placeholder = "",
		showPlaceholder = false,
		label = "",
		focusKeyboardShortcut,
		autoSelect,
		showIncrementButtons,
		spellCheck,
		onKeyDown = () => {},
		onFocus = () => {},
		onBlur = () => {},
		onSubmit,
		onAction = () => {},
		onChange = () => {},
		min,
		max,
		children,
		...rest
	} = props

	const ref = useRef()
	const [focused, setFocused] = useState(!!value)
	const [visible, setVisible] = useState(type !== "password")
	const [focusedOnce, setFocusedOnce] = useState(false)
	const [requiredError, setRequiredError] = useState(error)
	const PrefixIcon = prefixIcon

	const childArr = Children.toArray(children)

	if (childArr.length > 1) throw new Error("<Input> can only accept a <Button> element as its sole child.")

	if (children && (type === "password" || type === "number")) {
		console.warn(
			"<Input type='password'/>, <Input type='date'/>, and <Input type='number'/> will ignore the action button."
		)
	}

	Children.forEach(children, child => {
		if (!isValidElement(child) || child.type !== Button) {
			throw new Error("<Input> can only accept a <Button> element as its sole child.")
		}

		if (disabled) {
			child.tabIndex = -1 // todo: need to test if this works
		}
	})

	if (min !== undefined && max !== undefined && min > max) {
		throw new Error("min must be lower than max")
	}

	if (max !== undefined && min !== undefined && max < min) {
		throw new Error("max must be greater than min")
	}

	function handleWindowKeyPress(e) {
		const isEditableTarget =
			e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.isContentEditable
		// future todo: this can only handle a single keyboard key, not multiple. consider extending this
		// to an array to represent a chord. if it's a chord, the isEditableTarget probably shouldn't matter,
		// specifically if the chord is some ctrl or alt key, but shift should matter, etc.
		// array, or string of + delimited keys/chord keys, or both?
		if (e.key === focusKeyboardShortcut && !isEditableTarget) {
			e.preventDefault()
			ref.current.focus()
			window.removeEventListener("keypress", handleWindowKeyPress)
		}
	}

	function handleFocus() {
		if (disabled) return
		if (!focused) {
			setFocused(true)
		}

		onFocus(ref.current)
	}

	function handleBlur() {
		if (!focusedOnce) {
			setFocusedOnce(true)
		}

		if (value === "") {
			setFocused(false)
		}

		if (typeof focusKeyboardShortcut === "string" && focusKeyboardShortcut) {
			window.addEventListener("keypress", handleWindowKeyPress)
		}

		onBlur(ref.current)
	}

	function handleReveal() {
		setVisible(!visible)
	}

	function handleTriggerChange(value) {
		// https://stackoverflow.com/a/46012210/8429492
		const nativeSetter = Object.getOwnPropertyDescriptor(
			type === "textbox" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype,
			"value"
		).set

		nativeSetter.call(ref.current, value)

		ref.current.dispatchEvent(new Event("input", { bubbles: true }))
	}

	function handleIncrement(amount) {
		if (disabled) return

		let newValue = `${(+ref.current.value || 0) + amount}`

		if (max !== undefined && newValue > max) newValue = max

		handleTriggerChange(newValue)
	}

	function handleDecrement(amount) {
		if (disabled) return

		let newValue = `${(+ref.current.value || 0) - amount}`

		if (min !== undefined && newValue < min) newValue = min

		handleTriggerChange(newValue)
	}

	function handleKeyDown(e) {
		if (disabled) return

		ref.current.lastKeyDown = e.key

		let spTrigger, pdTrigger
		const alteredEventObject = {
			...e,
			stopPropagation: function () {
				spTrigger = true
			},
			preventDefault: function () {
				pdTrigger = true
			}
		}

		onKeyDown(alteredEventObject)

		if (pdTrigger) e.preventDefault()
		if (spTrigger) e.stopPropagation()

		if (pdTrigger || spTrigger) return

		if (e.key === "Escape") {
			e.preventDefault()

			return ref.current.blur()
		} else if (e.key === "Enter") {
			if (e.ctrlKey || e.altKey) {
				// Insert a new line when Ctrl+Enter is pressed
				const start = ref.current.selectionStart
				const end = ref.current.selectionEnd
				const value = ref.current.value

				const newValue = value.substring(0, start) + "\n" + value.substring(end)
				e.target.selectionStart = e.target.selectionEnd = start + 1

				handleTriggerChange(newValue)

				e.preventDefault() // Prevent default new line behavior
			} else if (typeof onSubmit === "function") {
				e.preventDefault()
				return onSubmit(ref.current)
			}
		} else if (type === "number" && e.key === "ArrowUp") {
			e.preventDefault()

			handleIncrement(1)
		} else if (type === "number" && e.key === "ArrowDown") {
			e.preventDefault()

			handleDecrement(1)
		} else if (
			type === "number" &&
			![
				"0",
				"1",
				"2",
				"3",
				"4",
				"5",
				"6",
				"7",
				"8",
				"9",
				"Backspace",
				"ArrowLeft",
				"ArrowRight",
				"End",
				"Home",
				"Delete",
				"Tab",
				".",
				"-",
				"+"
			].includes(e.key)
		) {
			e.preventDefault()
			return
		} else if (type === "number" && e.key === "-") {
			if (ref.current.value[0] !== "-" && +ref.current.value !== 0) {
				e.preventDefault()
				const newValue = `-${ref.current.value}`

				handleTriggerChange(newValue)
			} else {
				e.preventDefault()
				return
			}
		} else if (type === "number" && e.key === "+") {
			if (ref.current.value[0] === "-") {
				e.preventDefault()
				const newValue = `${+ref.current.value * -1}`

				handleTriggerChange(newValue)
			} else {
				e.preventDefault()
				return
			}
		}
	}

	function handleAction(e) {
		if (disabled) return
		if (type === "password") {
			handleReveal()
		}

		onAction(e)
	}

	useImperativeHandle(outerRef, () => ({
		...ref.current,
		reset: () => {
			setFocused(false)
			setFocusedOnce(false)
			setRequiredError(false)
		}
	}))

	useEffect(() => {
		if (autoSelect) {
			ref.current.select()
		}

		if (typeof focusKeyboardShortcut === "string" && focusKeyboardShortcut) {
			window.addEventListener("keypress", handleWindowKeyPress)

			return () => {
				window.removeEventListener("keypress", handleWindowKeyPress)
			}
		}
	}, [])

	useEffect(() => {
		if (focusedOnce) {
			if (required && !value) {
				setRequiredError(true)
			}

			if (required && value) {
				setRequiredError(false)
			}
		}
	}, [value, focusedOnce])

	return (
		<div
			className={`input-container type-${type}${value || focused || showPlaceholder ? " is-focused" : ""}${
				type === "password" || children ? ` has-action` : ""
			}${error || requiredError ? ` error` : ""}${className ? ` ${className}` : ""}${disabled ? " disabled" : ""}`}>
			{PrefixIcon ? (
				<div className="icon">
					<PrefixIcon />
				</div>
			) : (
				""
			)}
			{label ? <label htmlFor={label}>{label}</label> : ""}
			{placeholder && !value && (!label || (label && focused) || showPlaceholder) ? (
				<div className="placeholder">{placeholder}</div>
			) : (
				""
			)}
			{type === "textbox" ? (
				<textarea
					ref={ref}
					{...(label ? { id: label } : {})}
					className={inputElClassName}
					onFocus={handleFocus}
					onBlur={handleBlur}
					onKeyDown={handleKeyDown}
					onChange={onChange}
					type={visible ? "text" : "password"}
					value={value}
					autoComplete="one-time-code"
					spellCheck={spellCheck ? true : false}
					tabIndex={disabled ? -1 : 0}
					disabled={disabled}
					{...rest}></textarea>
			) : (
				<input
					ref={ref}
					{...(label ? { id: label } : {})}
					className={inputElClassName}
					onFocus={handleFocus}
					onBlur={handleBlur}
					onKeyDown={handleKeyDown}
					onChange={onChange}
					type={type === "date" ? "date" : visible ? "text" : "password"}
					value={value}
					autoComplete="one-time-code"
					required={required}
					spellCheck={spellCheck ? true : false}
					tabIndex={disabled ? -1 : 0}
					disabled={disabled}
					{...rest}
				/>
			)}
			{type === "password" || (type === "number" && showIncrementButtons) || type === "date" || children ? (
				<div className="action-button-wrapper" onClick={type !== "number" && handleAction}>
					{type === "number" ? (
						<>
							<Button
								tabIndex={disabled ? -1 : 0}
								onClick={e => {
									handleIncrement(1)
									ref.current.focus()
									handleAction(e)
								}}>
								<NavArrow />
							</Button>
							<Button
								tabIndex={disabled ? -1 : 0}
								onClick={e => {
									handleDecrement(1)
									ref.current.focus()
									handleAction(e)
								}}>
								<NavArrow down />
							</Button>
						</>
					) : (
						""
					)}
					{type === "password" && value ? (
						<Button tabIndex={disabled ? -1 : 0}>
							<PasswordEye isOpen={visible} />
						</Button>
					) : (
						""
					)}
					{type === "date" ? (
						<Button
							tabIndex={disabled ? -1 : 0}
							onClick={e => {
								if (disabled) return

								ref.current.showPicker()
							}}>
							<Calendar />
						</Button>
					) : (
						""
					)}
					{type !== "password" && type !== "number" && type !== "date" && children ? children : ""}
				</div>
			) : (
				""
			)}
			{hint ? <div className="hint">{hint}</div> : ""}
		</div>
	)
}

export default forwardRef(Input)
