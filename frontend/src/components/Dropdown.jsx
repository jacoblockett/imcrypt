import { useRef, useImperativeHandle, forwardRef, useState, useId, useEffect, useLayoutEffect } from "react"
import Button from "./Button"
import NavArrow from "./svg/NavArrow"

// TODO: Placeholder styles

// onChange reports the index array of all values selected *AFTER* a selection was made, followed by the event object for the second arg
// value should be an index or array of indices existing on the options array representing what has been selected
export function Dropdown(
	{
		className = "",
		label = "",
		labelId = "",
		placeholder = "",
		showPlaceholder = false,
		options = [],
		multiSelect,
		value,
		labelProp = "label",
		dataProp = "data",
		onChange,
		onKeyDown
	},
	outerRef
) {
	if (typeof className !== "string") className = ""
	if (typeof label !== "string") label = ""
	if (typeof labelId !== "string") labelId = ""
	if (label && !labelId) labelId = useId()
	if (typeof placeholder !== "string") placeholder = ""
	if (!Array.isArray(options)) options = []
	if (typeof labelProp !== "string") labelProp = "label"
	if (typeof dataProp !== "string") dataProp = "data"
	if (!Array.isArray(value)) value = [value]

	options = options.reduce((runner, option) => {
		if (Object.prototype.toString.call(option) !== "[object Object]") return runner

		if (!Object.hasOwn(option, labelProp)) option[labelProp] = ""
		if (!Object.hasOwn(option, dataProp)) option[dataProp] = undefined

		option[labelProp] = option[labelProp].toString()

		runner.push(option)

		return runner
	}, [])

	value = value.filter(v => Number.isInteger(v) && v >= 0 && v < options.length)

	const ref = useRef()
	const panelRef = useRef()
	const [open, setOpen] = useState(false)
	const [goUp, setGoUp] = useState(false)

	function handleOpen() {
		setOpen(true)
	}

	function handleClose() {
		setGoUp(false)
		setOpen(false)
	}

	function handleToggle(e) {
		if (!panelRef.current.contains(e.target)) {
			if (open) {
				handleClose()
			} else {
				handleOpen()
			}
		}
	}

	function handleSelectOption(e, optionIndex) {
		e.preventDefault()
		e.stopPropagation()

		const updated = multiSelect
			? value.includes(optionIndex)
				? value.filter(v => v !== optionIndex)
				: [...value, optionIndex].sort()
			: [optionIndex]

		if (typeof onChange === "function") onChange(updated, e)
		if (!multiSelect) handleClose()
	}

	function handleKeyDown(e) {
		if (e.target === ref.current) {
			// Parent container
			if (["ArrowDown", "ArrowUp", "Enter", " ", "Escape"].includes(e.key)) {
				e.preventDefault()
				e.stopPropagation()
			}

			if (e.key === "ArrowDown") {
				if (open) {
					panelRef.current.children[0].focus()
				} else {
					if (multiSelect) {
						handleOpen()
					} else {
						const nextOptionIndex = value.length ? value[0] + 1 : 0

						if (nextOptionIndex < options.length) {
							onChange([nextOptionIndex], e)
						}
					}
				}
			} else if (e.key === "ArrowUp") {
				if (open) {
					handleClose()
				} else if (!multiSelect) {
					const prevOptionIndex = value.length ? value[0] - 1 : 0

					if (prevOptionIndex >= 0) {
						onChange([prevOptionIndex], e)
					}
				}
			} else if (e.key === "Enter" || e.key === " ") {
				if (open) {
					handleClose()
				} else {
					handleOpen()
				}
			} else if (e.key === "Escape" && open) {
				handleClose()
			}
		} else {
			if (["ArrowDown", "ArrowUp", "Escape"].includes(e.key)) {
				e.preventDefault()
				e.stopPropagation()
			}

			if (e.key === "ArrowDown") {
				e.target?.nextElementSibling?.focus()
			} else if (e.key === "ArrowUp") {
				e.target?.previousElementSibling?.focus()
			} else if (e.key === "Escape") {
				handleClose()
				ref.current.focus()
			}
		}

		if (typeof onKeyDown === "function") onKeyDown(e)
	}

	useEffect(() => {
		function handleClickOutside(e) {
			if (ref.current && !ref.current.contains(e.target)) {
				handleClose()
			}
		}

		document.addEventListener("mousedown", handleClickOutside)

		return () => {
			document.removeEventListener("mousedown", handleClickOutside)
		}
	}, [])

	useImperativeHandle(outerRef, () => ref.current)

	useLayoutEffect(() => {
		if (open) {
			const rect = panelRef.current.getBoundingClientRect()

			setGoUp(rect.bottom > window.innerHeight)
		}
	}, [open])

	return (
		<div
			{...(labelId ? { id: labelId } : {})}
			ref={ref}
			tabIndex={0}
			className={`dropdown${open ? " open" : ""}${goUp ? " go-up" : ""}${
				value.length || showPlaceholder ? " with-selected" : ""
			} ${className}`}
			onClick={handleToggle}
			onKeyDown={handleKeyDown}>
			{label ? <label htmlFor={labelId}>{label}</label> : ""}
			{placeholder && !value.length && (!label || (label && open) || showPlaceholder) ? (
				<div className="placeholder">{placeholder}</div>
			) : (
				""
			)}
			{value.length ? (
				<span className="selected-display">
					{options
						.reduce((runner, option, i) => {
							if (value.includes(i)) {
								runner.push(option[labelProp])

								return runner
							} else {
								return runner
							}
						}, [])
						.join(", ")}
				</span>
			) : (
				""
			)}
			<div ref={panelRef} className="dropdown-options" tabIndex={-1}>
				{(function () {
					const optionsJSX = options.reduce((runner, option, i) => {
						if (option.hidden) return runner

						runner.push(
							<Button
								tabIndex={open ? 0 : -1}
								key={i}
								className={`option${value.includes(i) ? " selected" : ""}`}
								onClick={e => handleSelectOption(e, i)}
								onKeyDown={handleKeyDown}>
								{multiSelect ? <span className="checkbox" onClick={e => handleSelectOption(e, i)}></span> : ""}
								{option[labelProp]}
							</Button>
						)

						return runner
					}, [])

					if (optionsJSX.length) return optionsJSX

					return <div className="option no-select">No options</div>
				})()}
			</div>
			<div className="arrow">
				<NavArrow down={!open} />
			</div>
		</div>
	)
}

export default forwardRef(Dropdown)
