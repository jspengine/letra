import { cn } from "../utils";
import type { ReactNode } from "react";

type KanbanColumn = {
	id: string;
	title: string;
	children: ReactNode;
	className?: string;
};

interface KanbanBoardProps {
	columns: KanbanColumn[];
	className?: string;
}

export function KanbanBoard({ columns, className }: KanbanBoardProps) {
	return (
		<div className={cn("flex w-full gap-[var(--space-4)] overflow-x-auto", className)}>
			{columns.map((col) => (
				<div
					key={col.id}
					className={cn(
						"flex min-w-[260px] flex-col gap-[var(--space-2)] rounded-[var(--radius-md)] border-[length:var(--border-thin)] bg-[var(--color-bg-surface)] p-[var(--space-3)]",
						col.className,
					)}
					style={{ borderColor: "var(--color-border)" }}
				>
					<div className="flex items-center justify-between px-[var(--space-1)] py-[var(--space-1)]">
						<span
							className="text-caption font-semibold"
							style={{ color: "var(--color-text-primary)" }}
						>
							{col.title}
						</span>
					</div>
					<div className="flex flex-col gap-[var(--space-2)]">{col.children}</div>
				</div>
			))}
		</div>
	);
}

interface KanbanItemProps {
	title: string;
	subtitle?: string;
	tag?: ReactNode;
	onClick?: () => void;
	className?: string;
}

export function KanbanItem({ title, subtitle, tag, onClick, className }: KanbanItemProps) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				"w-full rounded-[var(--radius-md)] border-[length:var(--border-thin)] bg-[var(--color-bg-base)] p-[var(--space-3)] text-left transition-colors hover:border-[var(--color-text-secondary)] cursor-pointer",
				className,
			)}
			style={{ borderColor: "var(--color-border)" }}
		>
			<div className="flex items-center justify-between gap-[var(--space-2)]">
				<span
					className="text-body font-medium"
					style={{ color: "var(--color-text-primary)" }}
				>
					{title}
				</span>
				{tag && <span className="shrink-0">{tag}</span>}
			</div>
			{subtitle && (
				<span
					className="mt-[var(--space-1)] block text-caption"
					style={{ color: "var(--color-text-secondary)" }}
				>
					{subtitle}
				</span>
			)}
		</button>
	);
}
