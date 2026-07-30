import { cn } from "./utils";

interface SparklineProps {
	data: number[];
	width?: number;
	height?: number;
	color?: string;
	className?: string;
}

export function Sparkline({
	data,
	width = 80,
	height = 24,
	color = "var(--color-primary)",
	className,
}: SparklineProps) {
	if (data.length < 2) return null;

	const min = Math.min(...data);
	const max = Math.max(...data);
	const range = max - min || 1;
	const strokeWidth = 1.5;

	const points = data.map((v, i) => {
		const x = (i / (data.length - 1)) * (width - strokeWidth);
		const y = height - ((v - min) / range) * (height - strokeWidth * 2) - strokeWidth;
		return `${x},${y}`;
	});

	const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"}${p}`).join(" ");

	return (
		<svg
			width={width}
			height={height}
			viewBox={`0 0 ${width} ${height}`}
			className={cn("shrink-0 overflow-visible", className)}
			aria-hidden="true"
		>
			<path
				d={pathD}
				fill="none"
				stroke={color}
				strokeWidth={strokeWidth}
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<path
				d={`${pathD} L${width - strokeWidth},${height} L0,${height} Z`}
				fill={`color-mix(in srgb, ${color} 12%, transparent)`}
			/>
		</svg>
	);
}
