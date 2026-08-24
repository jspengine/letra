import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "./utils";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
	{ className, ...props },
	ref,
) {
	return (
		<textarea
			ref={ref}
			className={cn(
				"w-full px-[var(--space-3)] py-[var(--space-2)] rounded-[var(--radius-sm)] border-[length:var(--border-thin)] text-sm transition-colors font-mono",
				"focus-visible:outline-none focus-visible:border-[var(--focus-ring-color)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring-color)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-base)]",
				"resize-y",
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
});
