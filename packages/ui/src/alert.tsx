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
	const token = variant === "error" ? "error" : variant === "warning" ? "warning" : "info";
	return (
		<div
			className={cn("flex gap-2.5 p-3 rounded-lg border", className)}
			style={{
				background: `color-mix(in srgb, var(--${token}) 12%, transparent)`,
				borderColor: `color-mix(in srgb, var(--${token}) 35%, transparent)`,
				color: `var(--${token}-foreground)`,
			}}
		>
			<Icon
				name={variantIcons[variant] || "info"}
				size={16}
				className="shrink-0 mt-0.5"
				style={{
					color: `var(--${token})`,
				}}
			/>
			<div className="text-sm" style={{ color: "var(--foreground)" }}>
				{title && <strong className="block font-semibold mb-0.5">{title}</strong>}
				{children}
			</div>
		</div>
	);
}
