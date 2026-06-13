import type { InputHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
	return (
		<input
			className={cn(
				"w-full rounded-lg px-3 py-2 text-sm border transition-colors",
				"focus:outline-none focus:ring-2 focus:ring-primary/30",
				className,
			)}
			style={{
				background: "var(--background)",
				borderColor: "var(--border)",
				color: "var(--foreground)",
			}}
			{...props}
		/>
	);
}
