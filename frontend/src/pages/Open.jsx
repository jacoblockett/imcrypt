import FilePicker from "../components/FilePicker"
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

		const [loadErr, kind] = await LoadImage(paths[0])
		if (loadErr) throw loadErr
		useLoadedImageState.setState({ binary: "" })
		if (kind === "journal" || kind === "candidate") {
			setPath("/recover", { mode: "replace" })
			return
		}

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
			<FilePicker type="image" text="Select an image or recovery journal to open." onData={handleData} />
		</div>
	)
}
