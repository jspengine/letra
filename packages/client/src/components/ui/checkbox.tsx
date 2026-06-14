import type { InputHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
	label?: string;
}

export function Checkbox({ className, label, id, ...props }: CheckboxProps) {
	const inputId = id || label?.replace(/\s+/g, "-").toLowerCase();
	return (
		<label htmlFor={inputId} className="flex items-center gap-2 cursor-pointer group">
			<input
				type="checkbox"
				id={inputId}
				className={cn(
					"w-4 h-4 rounded border transition-colors cursor-pointer",
					"focus:outline-none focus:ring-2 focus:ring-primary/30",
					"accent-primary",
					className,
				)}
				style={{ borderColor: "var(--border)" }}
				{...props}
			/>
			{label && (
				<span
					className="text-sm select-none group-hover:text-foreground transition-colors"
					style={{ color: "var(--muted-foreground)" }}
				>
					{label}
				</span>
			)}
		</label>
	);
}
