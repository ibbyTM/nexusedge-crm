const HUB = { cx: 17, cy: 30, r: 6 };
const NODE = { cx: 33, cy: 17, r: 3.4 };

export function LogoMark({
	className,
	animate = false,
}: {
	className?: string;
	animate?: boolean;
}) {
	return (
		<svg
			viewBox="0 0 48 48"
			className={className}
			fill="none"
			aria-hidden="true"
		>
			<line
				x1={HUB.cx}
				y1={HUB.cy}
				x2={NODE.cx}
				y2={NODE.cy}
				stroke="currentColor"
				strokeWidth={3}
				strokeLinecap="round"
			/>
			{animate && (
				<circle
					className="logo-ping"
					cx={HUB.cx}
					cy={HUB.cy}
					r={HUB.r}
					stroke="currentColor"
					strokeWidth={2.5}
					fill="none"
					vectorEffect="non-scaling-stroke"
				/>
			)}
			<circle cx={HUB.cx} cy={HUB.cy} r={HUB.r} fill="currentColor" />
			<circle cx={NODE.cx} cy={NODE.cy} r={NODE.r} fill="currentColor" />
		</svg>
	);
}
