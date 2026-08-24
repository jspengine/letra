import type { ReactNode } from "react";
import type { IconName } from "./icon";
import { Icon } from "./icon";
import { cn } from "./utils";

interface AlertProps {
	title?: string;
	children: ReactNode;
	variant?: "info" | "success" | "warning" | "error";
	className?: string;
}

const variantIcons: Record<string, IconName> = {
	info: "info",
	success: "check-circle",
	warning: "alert-triangle",
	error: "x-circle",
};

export function Alert({ title, children, variant = "info", className }: AlertProps) {
	const tokenMap: Record<string, string> = {
		info: "color-info",
		success: "color-success",
		warning: "color-warning",
		error: "color-danger",
	};
	const token = tokenMap[variant] ?? "color-info";
	return (
		<div
			className={cn(
				"flex gap-[var(--space-2)] p-[var(--space-3)] rounded-[var(--radius-md)] border-[length:var(--border-thin)]",
				className,
			)}
			style={{
				background: `color-mix(in srgb, var(--${token}) 12%, transparent)`,
				borderColor: `color-mix(in srgb, var(--${token}) 35%, transparent)`,
				color: "var(--color-text-primary)",
			}}
		>
			<Icon
				name={variantIcons[variant] || "info"}
				width="var(--icon-md)"
				height="var(--icon-md)"
				className="shrink-0 mt-0.5"
				style={{ color: `var(--${token})` }}
			/>
			<div className="text-body" style={{ color: "var(--color-text-primary)" }}>
				{title && <strong className="block font-semibold mb-0.5">{title}</strong>}
				{children}
			</div>
		</div>
	);
}
