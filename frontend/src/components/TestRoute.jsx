import { useEffect } from "react"
import { useDatabaseState } from "../store"

export default function TestRoute() {
	useEffect(() => {
		const { items, groups, charsets, rulesets, settings } = useDatabaseState.getState()
		console.log({ items, groups, charsets, rulesets, settings })
	}, [])

	return <div>hi</div>
}
