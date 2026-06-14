import type { TextareaHTMLAttributes } from "react";
import { cn } from "./utils";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {}

export function Textarea({ className, ...props }: TextareaProps) {
	return (
		<textarea
			className={cn(
				"w-full px-3 py-2 rounded-lg border text-sm transition-colors font-mono",
				"focus:outline-none focus:ring-2 focus:ring-primary/30",
				"resize-y",
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
