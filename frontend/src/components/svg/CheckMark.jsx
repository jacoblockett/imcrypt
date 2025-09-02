export default function CheckMark({ className }) {
	return (
		<svg
			className={`icon-check-mark${className ? ` ${className}` : ""}`}
			strokeWidth="1.5"
			viewBox="0 0 24 24"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			color="#000000">
			<path d="M5 13L9 17L19 7" stroke="#000000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
		</svg>
	)
}
