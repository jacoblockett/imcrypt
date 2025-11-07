import { useLayoutEffect, useState } from "react"
import { useFaviconCache } from "../store"

function ProfilePicture({ website, title }) {
	const faviconCache = useFaviconCache()
	const [favicon, setFavicon] = useState({ src: "", exists: false })

	async function getFavicon() {
		const result = await faviconCache.getFavicon(website)

		setFavicon(result)
	}

	useLayoutEffect(() => {
		if (website && navigator.onLine) {
			getFavicon()
		}
	}, [website])

	return (
		<div className={`pfp${!navigator.onLine || !favicon.exists ? " with-bg" : ""}`}>
			{!navigator.onLine || !favicon.exists ? (
				title[0].toUpperCase()
			) : (
				<img src={favicon.src} alt={`${website} favicon`} draggable={false} />
			)}
		</div>
	)
}

export default ProfilePicture
