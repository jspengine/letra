import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "./utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export const Input = forwardRef<HTMLInputElement, InputProps>(
	function Input({ className, ...props }, ref) {
		return (
			<input
				ref={ref}
				className={cn(
					"w-full px-3 py-2 rounded-lg border text-sm transition-colors duration-150",
					"focus:outline-none focus:ring-2 focus:ring-primary/30",
					"focus-visible:border-primary",
					"placeholder:opacity-50",
					className,
				)}
				style={{
					borderColor: "var(--border)",
					background: "var(--background)",
					color: "var(--foreground)",
				}}
				{...props}
			/>
		);
	},
);
