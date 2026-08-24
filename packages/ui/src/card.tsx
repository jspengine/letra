import type { CSSProperties, HTMLAttributes } from "react";
import { cn } from "./utils";

type Variant = "default" | "agent";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
	variant?: Variant;
}

export function Card({ variant = "default", className, children, style, ...props }: CardProps) {
	return (
		<div
			className={cn(
				"rounded-[var(--radius-md)] border-[length:var(--border-thin)] shadow-sm transition-shadow duration-[var(--motion-fast)] ease-[var(--ease-standard)]",
				variant === "default" && "hover:shadow-[var(--card-hover-shadow)]",
				variant === "agent" && "border-l-2",
				variant === "agent" && "hover:shadow-[var(--card-hover-shadow)]",
				className,
			)}
			style={
				{
					background: "var(--color-bg-surface)",
					borderColor: variant === "agent" ? "var(--color-agent)" : "var(--color-border)",
					"--card-hover-shadow":
						variant === "agent"
							? "0 0 28px color-mix(in oklch, var(--color-agent) 20%, transparent)"
							: "0 0 24px color-mix(in oklch, var(--color-primary) 12%, transparent)",
					...style,
				} as CSSProperties
			}
			{...props}
		>
			{children}
		</div>
	);
}

interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {}
export function CardHeader({ className, children, ...props }: CardHeaderProps) {
	return (
		<div
			className={cn(
				"grid gap-[var(--card-header-gap)] border-b border-[var(--color-border)] p-[var(--card-padding)]",
				className,
			)}
			{...props}
		>
			{children}
		</div>
	);
}

interface CardContentProps extends HTMLAttributes<HTMLDivElement> {}
export function CardContent({ className, children, ...props }: CardContentProps) {
	return (
		<div
			className={cn("grid gap-[var(--card-content-gap)] p-[var(--card-padding)]", className)}
			{...props}
		>
			{children}
		</div>
	);
}

interface CardFooterProps extends HTMLAttributes<HTMLDivElement> {}
export function CardFooter({ className, children, ...props }: CardFooterProps) {
	return (
		<div
			className={cn(
				"flex items-center justify-end gap-[var(--layout-toolbar-gap)] border-t border-[var(--color-border)] p-[var(--card-padding)]",
				className,
			)}
			{...props}
		>
			{children}
		</div>
	);
}
