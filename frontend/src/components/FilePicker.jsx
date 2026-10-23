import { OpenFileDialog } from "../../wailsjs/go/main/App"
// Retired until Wails v3:
// import { OnFileDrop, OnFileDropOff } from "../../wailsjs/runtime/runtime"
// import { useEffect } from "react"
import OpenFolder from "./svg/OpenFolder"
import Images from "./svg/Images"
import Button from "./Button"

export default function FilePicker({ text, type, onData = () => {} }) {
	async function handleFileSelectThroughDialog() {
		const [err, data] = await OpenFileDialog("Select an image or recovery journal", "*")

		if (err) throw new Error(err)

		onData([data])
	}

	// File-drop callbacks are deferred until the Wails v3 migration.
	// https://github.com/wailsapp/wails/issues/3563
	// https://github.com/wailsapp/wails/issues/3782
	// useEffect(() => {
	//     OnFileDrop(async (x, y, paths) => {
	//         if (paths && typeof paths === "string") {
	//             paths = [paths]
	//         }
	//         onData(paths)
	//     }, false)
	//     return () => OnFileDropOff()
	// }, [])

	return (
		<div className="file-picker">
			<div className="icon">{type === "image" ? <Images /> : <OpenFolder />}</div>
			<div className="message">{text}</div>
			<Button onClick={handleFileSelectThroughDialog}>Choose file</Button>
		</div>
	)
}
