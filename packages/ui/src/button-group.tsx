import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { Button } from "./button";
import { cn } from "./utils";

interface ButtonGroupProps extends HTMLAttributes<HTMLDivElement> {
	ariaLabel: string;
}

interface ButtonGroupItemProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	selected?: boolean;
	count?: ReactNode;
}

export function ButtonGroup({ ariaLabel, className, children, ...props }: ButtonGroupProps) {
	return (
		<div
			role="group"
			aria-label={ariaLabel}
			className={cn(
				"inline-flex min-w-0 flex-wrap items-center gap-0.5 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg-sunken)] p-0.5",
				className,
			)}
			{...props}
		>
			{children}
		</div>
	);
}

export function ButtonGroupItem({
	selected = false,
	count,
	children,
	className,
	type = "button",
	...props
}: ButtonGroupItemProps) {
	return (
		<Button
			type={type}
			size="sm"
			variant="ghost"
			aria-pressed={selected}
			data-selected={selected ? "true" : "false"}
			className={cn(
				"h-7 min-w-0 rounded-[var(--radius-xs)] border-transparent px-2 text-caption text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface)] hover:text-[var(--color-text-primary)]",
				"data-[selected=true]:border-[var(--color-border)] data-[selected=true]:bg-[var(--color-bg-surface)] data-[selected=true]:text-[var(--color-text-primary)] data-[selected=true]:shadow-sm",
				className,
			)}
			{...props}
		>
			<span className="min-w-0 truncate">{children}</span>
			{count !== undefined ? (
				<span className="font-mono text-[11px] tabular-nums text-[var(--color-text-tertiary)]">
					{count}
				</span>
			) : null}
		</Button>
	);
}
