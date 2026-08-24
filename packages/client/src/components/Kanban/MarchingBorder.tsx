import { cn } from "../../lib/utils";

interface MarchingBorderProps {
	className?: string;
}

export function MarchingBorder({ className }: MarchingBorderProps) {
	return (
		<div
			className={cn("absolute pointer-events-none", className)}
			style={{
				top: -2,
				left: -2,
				width: "calc(100% + 4px)",
				height: "calc(100% + 4px)",
			}}
			aria-hidden="true"
		>
			<svg width="100%" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg">
				<rect
					x="0"
					y="0"
					width="100%"
					height="100%"
					rx="8"
					stroke="var(--color-primary)"
					strokeWidth="1.75"
					strokeDasharray="8 4"
					className="animate-dash-march"
				/>
			</svg>
		</div>
	);
}
