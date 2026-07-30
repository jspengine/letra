import type { HTMLAttributes } from "react";
import { cn } from "./utils";

interface GlassPanelProps extends HTMLAttributes<HTMLDivElement> {
	variant?: "default" | "agent";
	radius?: "md" | "lg";
}

export function GlassPanel({
	variant = "default",
	radius = "md",
	className,
	children,
	style,
	...props
}: GlassPanelProps) {
	return (
		<div
			className={cn(
				"border-[length:var(--border-thin)] shadow-lg",
				radius === "md" ? "rounded-[var(--radius-md)]" : "rounded-[var(--radius-lg)]",
				className,
			)}
			style={{
				background: "color-mix(in oklch, var(--color-bg-surface) 65%, transparent)",
				backdropFilter: "blur(12px)",
				WebkitBackdropFilter: "blur(12px)",
				borderColor: variant === "agent"
					? "color-mix(in oklch, var(--color-agent) 50%, transparent)"
					: "color-mix(in oklch, var(--color-border) 60%, transparent)",
				...style,
			}}
			{...props}
		>
			{children}
		</div>
	);
}
