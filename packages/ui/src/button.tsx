import type { ButtonHTMLAttributes } from "react";
import { cn } from "./utils";
import { Icon } from "./icon";
import type { IconName } from "./icon";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "sm" | "default" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: Variant;
	size?: Size;
	loading?: boolean;
}

const variantStyles: Record<Variant, string> = {
	primary:
		"bg-[var(--color-primary)] text-[var(--color-on-accent)] hover:bg-[var(--color-primary-hover)] hover:scale-[1.02] active:bg-[var(--color-primary-pressed)] border border-transparent",
	secondary:
		"bg-[var(--color-bg-sunken)] text-[var(--color-text-primary)] border border-[var(--color-border)] hover:border-[var(--color-text-secondary)]",
	danger: "bg-[var(--color-danger)] text-[var(--color-on-accent)] border border-transparent hover:opacity-90",
	ghost: "bg-transparent hover:bg-[var(--color-bg-sunken)] text-[var(--color-text-primary)] border border-transparent",
};

const sizeStyles: Record<Size, string> = {
	sm: "h-8 px-[var(--space-3)] text-xs rounded-[var(--radius-sm)]",
	default: "h-10 px-[var(--space-4)] text-sm rounded-[var(--radius-md)]",
	lg: "h-11 px-[var(--space-5)] text-base rounded-[var(--radius-md)]",
};

export function Button({
	variant = "primary",
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
				"inline-flex items-center justify-center gap-[var(--space-2)] font-medium disabled:opacity-50 disabled:pointer-events-none cursor-pointer",
				"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring-color)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-base)]",
				"transition-[background-color,border-color,box-shadow,opacity,color,transform] duration-[var(--motion-fast)] ease-[var(--ease-standard)] active:translate-y-px",
				loading && "opacity-80",
				variantStyles[variant],
				sizeStyles[size],
				className,
			)}
			disabled={disabled || loading}
			{...props}
		>
			{loading && <Icon name="loader-circle" size={14} className="animate-spin" />}
			{children}
		</button>
	);
}
