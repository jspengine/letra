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
		backgroundColor: "#282B32",
		color: "var(--color-text-secondary)",
		borderColor: "#2E3138",
	},
	agent: {
		backgroundColor: "#22203A",
		color: "#C4B5FD",
		borderColor: "#53497C",
	},
	success: {
		backgroundColor: "#1A2B20",
		color: "#4ADE80",
		borderColor: "#1C623A",
	},
	info: {
		backgroundColor: "#1C2636",
		color: "#93C5FD",
		borderColor: "#36547C",
	},
	warning: {
		backgroundColor: "#1C1808",
		color: "#FCD34D",
		borderColor: "#866611",
	},
	danger: {
		backgroundColor: "#2C1A1A",
		color: "#FCA5A5",
		borderColor: "#762C2F",
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
