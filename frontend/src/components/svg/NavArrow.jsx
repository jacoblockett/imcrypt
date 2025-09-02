export default function NavArrow({ className, down, right, left }) {
	return (
		<svg
			className={`icon-nav-arrow${className ? ` ${className}` : ""}`}
			strokeWidth="1.5"
			viewBox="0 0 24 24"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			transform={`rotate(${down ? 0 : right ? 270 : left ? 90 : 180})`}>
			<path d="M6 9L12 15L18 9" stroke="#000000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
		</svg>
	)
}
