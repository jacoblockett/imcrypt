import { useRef, useEffect, Fragment, useImperativeHandle, forwardRef } from "react"
import Button from "./Button"
import More from "./svg/More"
import { useGroupPanelState } from "../store"
import { useShallow } from "zustand/react/shallow"
import useFocusTrap from "./FocusTrap"

function Menu({ id, menu }, outerRef) {
	const menuBtnRef = useRef()
	const menuRef = useRef()
	const { withMenuOpen } = useGroupPanelState(useShallow(s => ({ withMenuOpen: s.withMenuOpen })))

	function handleToggleMenu(e) {
		e.preventDefault()
		e.stopPropagation()

		if (useGroupPanelState.getState().withMenuOpen === id) {
			useGroupPanelState.setState({ withMenuOpen: "", menuOpenTrigger: undefined })
			useFocusTrap.goBack()
		} else {
			useGroupPanelState.setState({ withMenuOpen: id, menuOpenTrigger: menuBtnRef })
		}
	}

	function handleItemActivate(e, action) {
		e.preventDefault()
		e.stopPropagation()

		useGroupPanelState.setState({ withMenuOpen: "", menuOpenTrigger: undefined })
		useFocusTrap.goBack({ refocusTrigger: true })
		action()
	}

	function handleItemKeyDown(e, action) {
		if (e.key === "Escape" || e.key === "ArrowLeft") {
			e.preventDefault()
			e.stopPropagation()
			useGroupPanelState.setState({ withMenuOpen: "", menuOpenTrigger: undefined })
			useFocusTrap.goBack({ refocusTrigger: true })
		} else if (e.key === "Enter" || e.key === " ") {
			e.preventDefault()
			e.stopPropagation()
			handleItemActivate(e, action)
		} else if (e.key === "ArrowUp") {
			e.preventDefault()
			e.stopPropagation()
			useFocusTrap.focusPrevious()
		} else if (e.key === "ArrowDown") {
			e.preventDefault()
			e.stopPropagation()
			useFocusTrap.focusNext()
		}
	}

	useImperativeHandle(outerRef, () => menuRef.current)

	useEffect(() => {
		function handleCloseKeyDown(e) {
			if (e.key === "Escape" || e.key === "ArrowLeft") {
				e.preventDefault()
				useGroupPanelState.setState({ withMenuOpen: "", menuOpenTrigger: undefined })
				useFocusTrap.goBack({ refocusTrigger: true })
				menuBtnRef.current.focus()
			}
		}

		function handleFocusOutside(e) {
			if (!menuRef.current.contains(e.target) && !menuBtnRef.current.contains(e.target)) {
				e.preventDefault()

				useGroupPanelState.setState({ withMenuOpen: "", menuOpenTrigger: undefined })
				useFocusTrap.goBack()
			}
		}

		if (withMenuOpen === id && menuRef.current) {
			useFocusTrap(menuRef, { trigger: useGroupPanelState.getState().menuOpenTrigger, exclude: ".divider" })

			document.addEventListener("keydown", handleCloseKeyDown)
			document.addEventListener("mousedown", handleFocusOutside)

			return () => {
				document.removeEventListener("keydown", handleCloseKeyDown)
				document.removeEventListener("mousedown", handleFocusOutside)
			}
		} else {
			document.removeEventListener("keydown", handleCloseKeyDown)
			document.removeEventListener("mousedown", handleFocusOutside)
		}
	}, [withMenuOpen])

	return (
		<>
			<Button ref={menuBtnRef} id={`group-${id}-menu-btn`} className="menu-button" onClick={handleToggleMenu}>
				<div className="visual-layer">
					<More />
				</div>
			</Button>
			{withMenuOpen === id ? (
				<div ref={menuRef} id={`group-${id}-menu`} className="menu">
					{menu.map((menuItem, index, arr) => (
						<Fragment key={`menuItem-${index + 1}`}>
							<Button
								className="menu-item"
								onClick={e => handleItemActivate(e, menuItem.action)}
								onKeyDown={e => handleItemKeyDown(e, menuItem.action)}>
								{menuItem.name}
							</Button>
							{index !== arr.length - 1 ? <div className="divider"></div> : ""}
						</Fragment>
					))}
				</div>
			) : (
				""
			)}
		</>
	)
}

export default forwardRef(Menu)
