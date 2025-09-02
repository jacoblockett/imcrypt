import DragAndDrop from "../components/DragAndDrop"
import { LoadImage, HasStorage, ReadLoadedImage } from "../../wailsjs/go/main/App"
import { usePath } from "crossroad"
import { useLoadedImageState } from "../store"

export default function Open() {
	const [, setPath] = usePath()

	async function handleData(paths) {
		if (!Array.isArray(paths)) {
			console.warn(paths)
			throw new Error("Expected paths to be an Array.")
		}
		if (paths.length !== 1) {
			throw new Error("Expected paths to be an Array with 1 item.")
		}
		if (typeof paths[0] !== "string") {
			throw new Error("Expected paths to be an Array with 1 string.")
		}

		const [loadErr] = await LoadImage(paths[0])
		if (loadErr) throw loadErr

		const [existsErr, hasStorage] = await HasStorage()
		if (existsErr) throw existsErr

		const [readErr, binary] = await ReadLoadedImage()
		if (readErr) throw readErr

		useLoadedImageState.setState({ binary })

		if (hasStorage === true) {
			setPath("/decrypt/text", { mode: "replace" })
		} else {
			setPath("/encrypt/text", { mode: "replace" })
		}
	}

	return (
		<div id="open" className="page">
			<DragAndDrop type="image" text="Drag and drop an image to unlock or use as a vault." onData={handleData} />
		</div>
	)
}
