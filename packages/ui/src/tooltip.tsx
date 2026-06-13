import { useState, type ReactNode } from "react";
import { cn } from "./utils";

interface TooltipProps {
	content: string;
	children: ReactNode;
	position?: "top" | "bottom" | "left" | "right";
	className?: string;
}

export function Tooltip({ content, children, position = "top", className }: TooltipProps) {
	const [visible, setVisible] = useState(false);

	const posClasses: Record<string, string> = {
		top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
		bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
		left: "right-full top-1/2 -translate-y-1/2 mr-2",
		right: "left-full top-1/2 -translate-y-1/2 ml-2",
	};

	return (
		<div
			className={cn("relative inline-flex", className)}
			onMouseEnter={() => setVisible(true)}
			onMouseLeave={() => setVisible(false)}
			onFocus={() => setVisible(true)}
			onBlur={() => setVisible(false)}
		>
			{children}
			{visible && (
				<div
					className={cn(
						"absolute z-50 px-2.5 py-1.5 rounded-lg text-xs whitespace-nowrap pointer-events-none",
						posClasses[position],
					)}
					style={{ background: "var(--foreground)", color: "var(--background)" }}
					role="tooltip"
				>
					{content}
				</div>
			)}
		</div>
	);
}
