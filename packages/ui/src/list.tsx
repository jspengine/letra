import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./utils";

type ListTone = "default" | "surface";
type ListItemTone = "default" | "warning" | "danger" | "success" | "info";

interface ListProps extends HTMLAttributes<HTMLUListElement> {
	tone?: ListTone;
}

interface ListItemProps extends Omit<HTMLAttributes<HTMLLIElement>, "title"> {
	leading?: ReactNode;
	title: ReactNode;
	description?: ReactNode;
	meta?: ReactNode;
	action?: ReactNode;
	tone?: ListItemTone;
}

const itemToneClass: Record<ListItemTone, string> = {
	default: "border-[var(--color-border)]",
	warning: "ds-list-item--warning",
	danger: "ds-list-item--danger",
	success: "ds-list-item--success",
	info: "ds-list-item--info",
};

export function List({ tone = "default", className, children, ...props }: ListProps) {
	return (
		<ul
			className={cn(
				"grid gap-[var(--layout-list-gap)]",
				tone === "surface" && "rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-base)] p-[var(--layout-list-gap)]",
				className,
			)}
			{...props}
		>
			{children}
		</ul>
	);
}

export function ListItem({
	leading,
	title,
	description,
	meta,
	action,
	tone = "default",
	className,
	children,
	...props
}: ListItemProps) {
	return (
		<li
			className={cn(
				"grid gap-[var(--layout-cluster-gap)] rounded-[var(--radius-sm)] border bg-[var(--color-bg-base)] p-[var(--layout-list-item-padding)]",
				"transition-[background-color,border-color] duration-[var(--duration-fast)] ease-[var(--ease-standard)] hover:bg-[var(--surface-hover)]",
				"sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center",
				itemToneClass[tone],
				className,
			)}
			{...props}
		>
			{leading ? <div className="flex items-start sm:items-center">{leading}</div> : null}
			<div className="grid min-w-0 gap-[var(--space-1)]">
				{meta ? <div className="ds-cluster">{meta}</div> : null}
				<div className="min-w-0 break-words text-body-sm font-medium text-[var(--color-text-primary)]">{title}</div>
				{description ? (
					<div className="min-w-0 break-words text-caption text-[var(--color-text-secondary)]">{description}</div>
				) : null}
				{children}
			</div>
			{action ? <div className="flex min-w-0 flex-wrap items-center sm:justify-end">{action}</div> : null}
		</li>
	);
}
