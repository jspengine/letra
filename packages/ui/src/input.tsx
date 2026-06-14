import type { InputHTMLAttributes } from "react";
import { cn } from "./utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export function Input({ className, ...props }: InputProps) {
	return (
		<input
			className={cn(
				"w-full px-3 py-2 rounded-lg border text-sm transition-colors",
				"focus:outline-none focus:ring-2 focus:ring-primary/30",
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
}
