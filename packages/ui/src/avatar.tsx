import type { HTMLAttributes, ImgHTMLAttributes } from "react";
import { cn } from "./utils";

type Size = "sm" | "md" | "lg";

const sizeStyles: Record<Size, string> = {
	sm: "h-8 w-8 text-xs",
	md: "h-10 w-10 text-sm",
	lg: "h-12 w-12 text-base",
};

interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
	size?: Size;
}

export function Avatar({ className, size = "md", children, ...props }: AvatarProps) {
	return (
		<div
			className={cn(
				"relative flex shrink-0 overflow-hidden rounded-full",
				sizeStyles[size],
				className,
			)}
			{...props}
		>
			{children}
		</div>
	);
}

interface AvatarImageProps extends ImgHTMLAttributes<HTMLImageElement> {}

export function AvatarImage({ className, ...props }: AvatarImageProps) {
	return (
		<img
			className={cn("aspect-square h-full w-full object-cover", className)}
			{...props}
		/>
	);
}

interface AvatarFallbackProps extends HTMLAttributes<HTMLSpanElement> {
	delayMs?: number;
}

export function AvatarFallback({
	className,
	delayMs,
	children,
	...props
}: AvatarFallbackProps) {
	return (
		<span
			className={cn(
				"flex items-center justify-center rounded-full bg-muted font-medium ring-2 ring-background",
				className,
			)}
			style={{ animationDelay: `${delayMs ?? 0}ms` }}
			{...props}
		>
			{children}
		</span>
	);
}