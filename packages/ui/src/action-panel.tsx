import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./utils";

type ActionPanelTone = "default" | "warning" | "danger" | "success" | "info";
type ActionPanelDensity = "default" | "compact";

interface ActionPanelProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
	icon?: ReactNode;
	title: ReactNode;
	description?: ReactNode;
	meta?: ReactNode;
	action?: ReactNode;
	secondaryAction?: ReactNode;
	tone?: ActionPanelTone;
	density?: ActionPanelDensity;
}

const toneClass: Record<ActionPanelTone, string> = {
	default: "border-[var(--color-border)]",
	warning: "ds-action-panel--warning",
	danger: "ds-action-panel--danger",
	success: "ds-action-panel--success",
	info: "ds-action-panel--info",
};

export function ActionPanel({
	icon,
	title,
	description,
	meta,
	action,
	secondaryAction,
	tone = "default",
	density = "default",
	className,
	children,
	...props
}: ActionPanelProps) {
	return (
		<section
			className={cn(
				"grid rounded-[var(--radius-md)] border bg-[var(--color-bg-surface)] shadow-sm",
				density === "compact"
					? "gap-[var(--layout-inline-gap)] p-[var(--space-4)]"
					: "gap-[var(--layout-cluster-gap)] p-[var(--card-padding)]",
				"sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center",
				toneClass[tone],
				className,
			)}
			{...props}
		>
			{icon ? (
				<div
					className={cn(
						"flex items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-bg-sunken)] text-[var(--color-text-secondary)]",
						density === "compact" ? "size-8" : "size-10",
					)}
				>
					{icon}
				</div>
			) : null}
			<div className="grid min-w-0 gap-[var(--space-1)]">
				{meta ? <div className="ds-cluster">{meta}</div> : null}
				<h2
					className={cn(
						"text-[var(--color-text-primary)]",
						density === "compact" ? "text-body-sm font-semibold" : "text-h3 sm:text-h2",
					)}
				>
					{title}
				</h2>
				{description ? (
					<p
						className={cn(
							"max-w-3xl text-[var(--color-text-secondary)]",
							density === "compact" ? "text-caption" : "text-body-sm",
						)}
					>
						{description}
					</p>
				) : null}
				{children}
			</div>
			{action || secondaryAction ? (
				<div className="flex flex-wrap items-center gap-[var(--layout-toolbar-gap)] sm:justify-end">
					{secondaryAction}
					{action}
				</div>
			) : null}
		</section>
	);
}
