export default function RightArrow({ className }) {
	return (
		<svg
			className={`icon-right-arrow${className ? ` ${className}` : ""}`}
			viewBox="0 0 21 20"
			fill="none"
			xmlns="http://www.w3.org/2000/svg">
			<path d="M1 9.73611H19.5H1ZM19.5 9.73611L10.7639 1L19.5 9.73611ZM19.5 9.73611L10.7639 18.4722L19.5 9.73611Z" />
			<path
				d="M1 9.73611H19.5M19.5 9.73611L10.7639 1M19.5 9.73611L10.7639 18.4722"
				stroke="#DED6F5"
				strokeWidth="1.54167"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	)
}
