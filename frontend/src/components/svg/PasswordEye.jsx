export default function PasswordEye({ className, isOpen }) {
	return isOpen ? (
		<svg
			className={`icon-password-eye${className ? ` ${className}` : ""}`}
			viewBox="0 0 200 200"
			fill="none"
			xmlns="http://www.w3.org/2000/svg">
			<path
				d="M25 108.333C55 41.6666 145 41.6666 175 108.333"
				stroke="#131118"
				strokeWidth="12.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<path
				d="M100 141.667C86.1925 141.667 75 130.474 75 116.667C75 102.859 86.1925 91.6667 100 91.6667C113.807 91.6667 125 102.859 125 116.667C125 130.474 113.807 141.667 100 141.667Z"
				fill="#131118"
				stroke="#131118"
				strokeWidth="12.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	) : (
		<svg
			className={`icon-password-eye ${className}`}
			viewBox="0 0 30 30"
			fill="none"
			xmlns="http://www.w3.org/2000/svg">
			<path d="M24.3751 19.9999L21.2811 15.7547" strokeWidth="1.875" strokeLinecap="round" strokeLinejoin="round" />
			<path d="M15 21.875V17.5" strokeWidth="1.875" strokeLinecap="round" strokeLinejoin="round" />
			<path d="M5.625 19.9999L8.71119 15.7654" strokeWidth="1.875" strokeLinecap="round" strokeLinejoin="round" />
			<path d="M3.75 10C8.25 20 21.75 20 26.25 10" strokeWidth="1.875" strokeLinecap="round" strokeLinejoin="round" />
		</svg>
	)
}
