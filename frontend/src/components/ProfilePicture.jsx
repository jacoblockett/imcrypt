import { useLayoutEffect } from "react"
import { CheckIfFallbackFavicon } from "../../wailsjs/go/main/App"
import { useFaviconCache } from "../store"

function ProfilePicture({ website, title }) {
	const faviconCache = useFaviconCache()

	async function checkIfFallbackFavicon(website) {
		if (faviconCache.hasBeenChecked(website)) return

		const [result] = await CheckIfFallbackFavicon(website)

		useFaviconCache.setState({
			checkedSites: [...useFaviconCache.getState().checkedSites, { website, isFallback: result }]
		})
	}

	useLayoutEffect(() => {
		if (website && navigator.onLine) {
			checkIfFallbackFavicon(website)
		}
	}, [website])

	return (
		<div className={`pfp${!navigator.onLine || faviconCache.isFallback(website) ? " with-bg" : ""}`}>
			{!navigator.onLine || faviconCache.isFallback(website) ? (
				title[0].toUpperCase()
			) : (
				<img
					src={`https://www.google.com/s2/favicons?domain=${website}&sz=256`}
					alt={`${website} favicon`}
					draggable={false}
				/>
			)}
		</div>
	)
}

export default ProfilePicture
