export default function Filter({ className }) {
	return (
		<svg
			className={`icon-filter${className ? ` ${className}` : ""}`}
			viewBox="0 0 24 24"
			strokeWidth="1.5"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			color="#000000">
			<path d="M3 6H21" stroke="#000000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
			<path d="M7 12L17 12" stroke="#000000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
			<path d="M11 18L13 18" stroke="#000000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
		</svg>
	)
}
