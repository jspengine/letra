import type { ReactNode } from "react";
import { cn } from "../utils";

interface MarchingBorderProps {
	children: ReactNode;
	className?: string;
	containerClassName?: string;
}

export function MarchingBorder({ children, className, containerClassName }: MarchingBorderProps) {
	return (
		<div className={cn("relative rounded-[var(--radius-md)]", containerClassName)}>
			<div
				className={cn("pointer-events-none absolute inset-0 overflow-hidden rounded-[var(--radius-md)]", className)}
				aria-hidden="true"
			>
				<svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
					<rect
						className="animate-dash-march"
						x="1"
						y="1"
						width="calc(100% - 2px)"
						height="calc(100% - 2px)"
						rx="12"
						fill="none"
						stroke="var(--live)"
						strokeDasharray="4 6"
						strokeWidth="1"
					/>
				</svg>
			</div>
			<div className="relative">{children}</div>
		</div>
	);
}
