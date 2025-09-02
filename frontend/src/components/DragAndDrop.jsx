import { OpenFileDialog, FocusWindow } from "../../wailsjs/go/main/App"
import { OnFileDrop, OnFileDropOff } from "../../wailsjs/runtime/runtime"
import { useEffect } from "react"
import OpenFolder from "./svg/OpenFolder"
import Images from "./svg/Images"
import Button from "./Button"

export default function DragAndDrop({ text, type, onData = () => {} }) {
	async function handleFileSelectThroughDialog() {
		const [err, data] = await OpenFileDialog("Select an image", type === "image" ? "*.png;*.jpg;*.jpeg" : "*")

		if (err) throw new Error(err)

		onData([data])
	}

	useEffect(() => {
		OnFileDrop(async (x, y, paths) => {
			if (paths && typeof paths === "string") {
				paths = [paths]
			}

			onData(paths)
		}, false)

		return () => {
			OnFileDropOff()
		}
	}, [])

	return (
		<div className="drag-and-drop">
			<div className="icon">{type === "image" ? <Images /> : <OpenFolder />}</div>
			<div className="message">{text}</div>
			<Button onClick={handleFileSelectThroughDialog}>Browse</Button>
		</div>
	)
}
