import type { ReactNode } from "react";
import { Icon } from "./icon";

export interface DocumentSection {
	id: string;
	label: string;
}

interface RulerHeaderProps {
	title: string;
	description?: string;
	progress: number;
	sections: DocumentSection[];
	activeSection: string | null;
	actions?: ReactNode;
}

export function RulerHeader({
	title,
	description,
	progress,
	sections,
	activeSection,
	actions,
}: RulerHeaderProps) {
	const progPct = Math.round(progress * 100);
	const activeLabel = activeSection
		? sections.find((section) => section.id === activeSection)?.label ?? activeSection
		: sections[0]?.label;

	return (
		<div className="shrink-0 border-b border-border bg-[var(--color-bg-surface)]">
			<div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start sm:justify-between lg:px-6">
				<div className="flex min-w-0 flex-1 items-start gap-3">
					<span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-bg-sunken)] text-[var(--color-primary)]">
						<Icon name="file-text" size={16} />
					</span>
					<div className="min-w-0 flex-1">
						<h2 className="truncate text-base font-semibold text-[var(--color-text-primary)]">
							{title}
						</h2>
						{description ? (
							<p className="mt-1 line-clamp-2 text-sm leading-snug text-[var(--color-text-secondary)]">
								{description}
							</p>
						) : null}
						{activeLabel ? (
							<p className="mt-2 text-caption font-medium text-[var(--color-primary)]">
								{activeLabel}
							</p>
						) : null}
					</div>
				</div>

				<div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
					<span className="text-caption tabular-nums text-[var(--color-text-secondary)]">
						{progPct}% lido
					</span>
					{actions}
				</div>
			</div>

			<div className="px-4 pb-3 lg:px-6">
				<div className="h-1 overflow-hidden rounded-full bg-[var(--color-border)]">
					<div
						className="h-full rounded-full bg-[var(--color-primary)] transition-[width] duration-[var(--duration-fast)] ease-[var(--ease-standard)]"
						style={{ width: `${progPct}%` }}
					/>
				</div>

				{sections.length > 0 ? (
					<div className="mt-2 hidden items-center gap-1 overflow-hidden sm:flex">
						{sections.slice(0, 8).map((section) => {
							const isActive = activeSection === section.id;
							return (
								<span
									key={section.id}
									className="flex min-w-0 items-center gap-1 text-caption text-[var(--color-text-secondary)]"
								>
									<span
										className={
											isActive
												? "size-1.5 shrink-0 rounded-full bg-[var(--color-primary)]"
												: "size-1 shrink-0 rounded-full bg-[var(--color-text-disabled)]"
										}
									/>
									<span className={isActive ? "truncate text-[var(--color-primary)]" : "truncate"}>
										{section.label}
									</span>
								</span>
							);
						})}
						{sections.length > 8 ? (
							<span className="text-caption text-[var(--color-text-secondary)]">
								+{sections.length - 8}
							</span>
						) : null}
					</div>
				) : null}
			</div>
		</div>
	);
}
