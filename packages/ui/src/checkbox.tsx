import type { InputHTMLAttributes } from "react";
import { Icon } from "./icon";
import { cn } from "./utils";

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
	label?: string;
}

export function Checkbox({ className, label, id, ...props }: CheckboxProps) {
	const inputId = id || label?.replace(/\s+/g, "-").toLowerCase();
	return (
		<label htmlFor={inputId} className="group flex cursor-pointer items-center gap-[var(--space-2)]">
			<input
				type="checkbox"
				id={inputId}
				className={cn(
					"peer sr-only",
					className,
				)}
				{...props}
			/>
			<span
				data-slot="checkbox-control"
				aria-hidden="true"
				className="flex size-[var(--icon-md)] shrink-0 items-center justify-center rounded-[var(--radius-xs)] border-[length:var(--border-thin)] border-[var(--color-border)] bg-[var(--color-bg-base)] text-[var(--color-on-accent)] transition-colors [&_svg]:opacity-0 peer-checked:border-[var(--color-primary)] peer-checked:bg-[var(--color-primary)] peer-checked:[&_svg]:opacity-100 peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--focus-ring-color)] peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[var(--color-bg-base)] peer-disabled:opacity-50"
			>
				<Icon name="check" size={12} className="transition-opacity" />
			</span>
			{label && (
				<span
					className="select-none text-sm transition-colors group-hover:text-[var(--color-text-primary)] peer-disabled:opacity-50"
					style={{ color: "var(--color-text-secondary)" }}
				>
					{label}
				</span>
			)}
		</label>
	);
}
