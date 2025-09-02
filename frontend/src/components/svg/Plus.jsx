export default function Plus({ className }) {
	return (
		<svg
			className={`icon-plus${className ? ` ${className}` : ""}`}
			strokeWidth="1.5"
			viewBox="0 0 24 24"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			color="#000000">
			<path
				d="M6 12H12M18 12H12M12 12V6M12 12V18"
				stroke="#000000"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"></path>
		</svg>
	)
}
