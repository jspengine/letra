import type { ButtonHTMLAttributes } from "react";
import { cn } from "./utils";

type Variant = "default" | "secondary" | "outline" | "ghost";
type Size = "sm" | "default" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: Variant;
	size?: Size;
	loading?: boolean;
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

function Spinner() {
	return (
		<svg
			className="animate-spin -ml-1 mr-2"
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			aria-hidden="true"
		>
			<circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25" />
			<path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
		</svg>
	);
}

export function Button({
	variant = "default",
	size = "default",
	loading,
	disabled,
	children,
	className,
	...props
}: ButtonProps) {
	return (
		<button
			className={cn(
				"inline-flex items-center justify-center font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50 disabled:pointer-events-none cursor-pointer",
				loading && "opacity-70",
				variantStyles[variant],
				sizeStyles[size],
				className,
			)}
			disabled={disabled || loading}
			{...props}
		>
			{loading && <Spinner />}
			{children}
		</button>
	);
}
