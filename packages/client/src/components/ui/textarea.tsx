import type { TextareaHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
	return (
		<textarea
			className={cn(
				"w-full rounded-lg px-3 py-2 text-sm border transition-colors resize-y min-h-[120px]",
				"focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono",
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
