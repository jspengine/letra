import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "./utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export const Input = forwardRef<HTMLInputElement, InputProps>(
	function Input({ className, ...props }, ref) {
		return (
			<input
				ref={ref}
				className={cn(
					"w-full px-[var(--space-3)] py-[var(--space-2)] rounded-[var(--radius-sm)] border-[length:var(--border-thin)] text-sm transition-colors duration-[var(--duration-fast)] ease-[var(--ease-standard)]",
					"focus-visible:outline-none focus-visible:border-[var(--focus-ring-color)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring-color)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-base)] focus-visible:shadow-[0_0_0_4px_color-mix(in_oklch,var(--color-primary)_14%,transparent)]",
					"placeholder:opacity-50",
					className,
				)}
				style={{
					borderColor: "var(--color-border)",
					background: "var(--color-bg-base)",
					color: "var(--color-text-primary)",
				}}
				{...props}
			/>
		);
	},
);
