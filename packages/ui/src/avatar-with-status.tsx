import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./utils";

type Status = "online" | "busy" | "away" | "offline" | "thinking";

interface AvatarWithStatusProps extends HTMLAttributes<HTMLDivElement> {
	size?: "sm" | "md" | "lg";
	status?: Status;
	statusClassName?: string;
	children: ReactNode;
}

export function AvatarWithStatus({ size = "md", status = "offline", statusClassName, children, className, ...props }: AvatarWithStatusProps) {
	const diameter = size === "lg" ? "var(--icon-lg)" : size === "sm" ? "var(--icon-sm)" : "var(--icon-md)";
	const statusColor =
		status === "online" ? "var(--color-success)" :
		status === "busy" ? "var(--color-danger)" :
		status === "thinking" ? "var(--color-agent)" :
		status === "away" ? "var(--color-warning)" :
		"var(--color-border)";

	return (
		<div className={cn("relative inline-flex shrink-0", className)} {...props}>
			<div
				className={cn(
					"relative flex shrink-0 overflow-hidden rounded-full border-[length:var(--border-thin)] transition-shadow duration-[var(--motion-base)] ease-[var(--ease-standard)]",
					status === "thinking" && "animate-agent-thinking-avatar",
					size === "lg" ? "h-12 w-12 text-base" : size === "sm" ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm",
				)}
				style={{
					borderColor: status === "thinking" ? "var(--color-agent)" : "var(--color-border)",
					background: "var(--color-bg-sunken)",
					boxShadow: status === "thinking"
						? "0 0 0 3px color-mix(in oklch, var(--color-agent) 16%, transparent), 0 0 16px color-mix(in oklch, var(--color-agent) 28%, transparent)"
						: undefined,
				}}
			>
				{children}
			</div>
			<span
				className={cn(
					"absolute bottom-0 right-0 rounded-full border-2",
					statusClassName,
				)}
				style={{
					width: diameter,
					height: diameter,
					backgroundColor: statusColor,
					borderColor: "var(--color-bg-surface)",
					boxShadow: status === "thinking" ? "0 0 8px var(--color-agent)" : undefined,
				}}
				aria-hidden
			/>
		</div>
	);
}
