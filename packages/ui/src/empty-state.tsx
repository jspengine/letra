import type { ReactNode } from "react";
import { cn } from "./utils";

interface EmptyStateProps {
	icon?: ReactNode;
	title: string;
	description?: string;
	action?: ReactNode;
	className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
	return (
		<div
			className={cn(
				"flex flex-col items-center justify-center gap-[var(--layout-inline-gap)] px-[var(--empty-state-padding-inline)] py-[var(--empty-state-padding-block)] text-center",
				className,
			)}
		>
			{icon && <div style={{ color: "var(--color-text-secondary)" }}>{icon}</div>}
			<h3 className="text-h2" style={{ color: "var(--color-text-primary)" }}>
				{title}
			</h3>
			{description && (
				<p className="max-w-sm text-body" style={{ color: "var(--color-text-secondary)" }}>
					{description}
				</p>
			)}
			{action}
		</div>
	);
}
