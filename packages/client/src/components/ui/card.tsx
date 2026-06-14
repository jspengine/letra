import type { HTMLAttributes } from "react";
import { cn } from "../../lib/utils";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
	noBorder?: boolean;
}

export function Card({ className, children, noBorder, ...props }: CardProps) {
	return (
		<div
			className={cn(
				"rounded-xl bg-card text-card-foreground shadow-sm",
				!noBorder && "border border-border",
				className,
			)}
			{...props}
		>
			{children}
		</div>
	);
}

export function CardHeader({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
	return (
		<div className={cn("px-5 pt-5 pb-3", className)} {...props}>
			{children}
		</div>
	);
}

export function CardTitle({ className, children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
	return (
		<h3 className={cn("text-lg font-semibold leading-tight", className)} {...props}>
			{children}
		</h3>
	);
}

export function CardDescription({
	className,
	children,
	...props
}: HTMLAttributes<HTMLParagraphElement>) {
	return (
		<p className={cn("text-sm text-muted-foreground mt-1", className)} {...props}>
			{children}
		</p>
	);
}

export function CardContent({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
	return (
		<div className={cn("px-5 pb-5", className)} {...props}>
			{children}
		</div>
	);
}
