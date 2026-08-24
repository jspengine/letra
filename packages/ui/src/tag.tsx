import type { HTMLAttributes } from "react";
import { cn } from "./utils";

interface TagProps extends HTMLAttributes<HTMLSpanElement> {
	variant?: "default" | "agent" | "success" | "info" | "warning" | "danger";
}

const variantColors: Record<
	NonNullable<TagProps["variant"]>,
	{ backgroundColor: string; color: string; borderColor: string }
> = {
	default: {
		backgroundColor: "color-mix(in oklch, var(--color-text-secondary) 10%, transparent)",
		color: "var(--color-text-secondary)",
		borderColor: "color-mix(in oklch, var(--color-border) 70%, transparent)",
	},
	agent: {
		backgroundColor: "color-mix(in oklch, var(--color-agent) 14%, transparent)",
		color: "var(--color-agent)",
		borderColor: "color-mix(in oklch, var(--color-agent) 42%, transparent)",
	},
	success: {
		backgroundColor: "color-mix(in oklch, var(--color-success) 14%, transparent)",
		color: "var(--color-success)",
		borderColor: "color-mix(in oklch, var(--color-success) 42%, transparent)",
	},
	info: {
		backgroundColor: "color-mix(in oklch, var(--color-info) 14%, transparent)",
		color: "var(--color-info)",
		borderColor: "color-mix(in oklch, var(--color-info) 42%, transparent)",
	},
	warning: {
		backgroundColor: "color-mix(in oklch, var(--color-primary) 16%, transparent)",
		color: "var(--color-primary)",
		borderColor: "color-mix(in oklch, var(--color-primary) 48%, transparent)",
	},
	danger: {
		backgroundColor: "color-mix(in oklch, var(--color-danger) 14%, transparent)",
		color: "var(--color-danger)",
		borderColor: "color-mix(in oklch, var(--color-danger) 42%, transparent)",
	},
};

export function Tag({ variant = "default", className, children, style, ...props }: TagProps) {
	const colors = variantColors[variant];
	return (
		<span
			data-slot="tag"
			className={cn(
				"inline-flex items-center gap-[var(--space-1)] rounded-[var(--radius-full)] border-[length:var(--border-thin)] px-[var(--space-2)] py-[var(--space-1)] text-caption font-medium leading-none",
				className,
			)}
			style={{ ...colors, ...style }}
			{...props}
		>
			{children}
		</span>
	);
}
