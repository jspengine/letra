import type { ButtonHTMLAttributes } from "react";
import { cn } from "./utils";

type Variant = "default" | "secondary" | "outline" | "ghost";
type Size = "sm" | "default" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: Variant;
	size?: Size;
}

const variantStyles: Record<Variant, string> = {
	default: "bg-primary text-primary-foreground hover:opacity-90 border border-transparent",
	secondary: "bg-muted text-muted-foreground hover:bg-muted/80 border border-transparent",
	outline: "border border-border bg-transparent hover:bg-muted text-foreground",
	ghost: "bg-transparent hover:bg-muted text-foreground border border-transparent",
};

const sizeStyles: Record<Size, string> = {
	sm: "text-xs px-2.5 py-1.5 rounded-md",
	default: "text-sm px-4 py-2 rounded-lg",
	lg: "text-base px-6 py-2.5 rounded-lg",
};

export function Button({
	variant = "default",
	size = "default",
	className,
	...props
}: ButtonProps) {
	return (
		<button
			className={cn(
				"inline-flex items-center justify-center font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50 disabled:pointer-events-none cursor-pointer",
				variantStyles[variant],
				sizeStyles[size],
				className,
			)}
			{...props}
		/>
	);
}
