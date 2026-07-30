import type { ReactNode } from "react";
import { cn } from "./utils";

interface NavHeaderProps {
	title?: string;
	titleId?: string;
	description?: string;
	left?: ReactNode;
	right?: ReactNode;
	className?: string;
}

export function NavHeader({ title, titleId, description, left, right, className }: NavHeaderProps) {
	return (
		<header
			className={cn(
				"flex flex-col items-stretch justify-between gap-[var(--layout-cluster-gap)] border-b border-[var(--color-border)] bg-[var(--color-bg-surface)] px-[var(--card-padding)] py-[var(--layout-cluster-gap)] sm:flex-row sm:items-center",
				className,
			)}
			style={{ color: "var(--color-text-primary)" }}
		>
			<div className="flex min-w-0 items-center gap-[var(--layout-cluster-gap)]">
				{left}
				<div className="flex min-w-0 flex-col">
					{title && <h1 id={titleId} className="text-h2">{title}</h1>}
					{description && <span className="text-caption" style={{ color: "var(--color-text-secondary)" }}>{description}</span>}
				</div>
			</div>
			<div className="flex shrink-0 flex-wrap items-center gap-[var(--layout-toolbar-gap)] sm:justify-end">
				{right}
			</div>
		</header>
	);
}
