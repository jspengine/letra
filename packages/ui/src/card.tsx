import type { HTMLAttributes } from "react";
import { cn } from "./utils";

interface CardProps extends HTMLAttributes<HTMLDivElement> {}

export function Card({ className, children, ...props }: CardProps) {
	return (
		<div
			className={cn(
				"rounded-xl border shadow-sm",
				className,
			)}
			style={{ background: "var(--card)", borderColor: "var(--border)" }}
			{...props}
		>
			{children}
		</div>
	);
}

interface CardContentProps extends HTMLAttributes<HTMLDivElement> {}

export function CardContent({ className, children, ...props }: CardContentProps) {
	return (
		<div className={cn("p-4", className)} {...props}>
			{children}
		</div>
	);
}
