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
				"flex flex-col items-center justify-center text-center py-12 px-6",
				className,
			)}
		>
			{icon && (
				<div className="mb-4" style={{ color: "var(--muted-foreground)" }}>
					{icon}
				</div>
			)}
			<h3 className="text-sm font-semibold mb-1">{title}</h3>
			{description && (
				<p className="text-sm max-w-sm mb-4" style={{ color: "var(--muted-foreground)" }}>
					{description}
				</p>
			)}
			{action}
		</div>
	);
}
