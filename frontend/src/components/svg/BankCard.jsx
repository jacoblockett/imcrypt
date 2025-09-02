export default function BankCard({ className }) {
	return (
		<svg
			className={`icon-bank-card${className ? ` ${className}` : ""}`}
			viewBox="0 0 24 24"
			strokeWidth="1.5"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			color="#000000">
			<path
				d="M22 9V17C22 18.1046 21.1046 19 20 19H4C2.89543 19 2 18.1046 2 17V7C2 5.89543 2.89543 5 4 5H20C21.1046 5 22 5.89543 22 7V9ZM22 9H6"
				stroke="#000000"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"></path>
		</svg>
	)
}
