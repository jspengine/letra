import { cn } from "../utils";
import type { ReactNode } from "react";

type Status = "default" | "success" | "error" | "info" | "agent";

function statusStyles(status: Status): { dot: string; line: string } {
	switch (status) {
		case "success":
			return { dot: "bg-[var(--color-success)]", line: "bg-[var(--color-success)]" };
		case "error":
			return { dot: "bg-[var(--color-danger)]", line: "bg-[var(--color-danger)]" };
		case "agent":
			return { dot: "bg-[var(--color-agent)]", line: "bg-[var(--color-agent)]" };
		case "info":
			return { dot: "bg-[var(--color-info)]", line: "bg-[var(--color-info)]" };
		default:
			return { dot: "bg-[var(--color-text-secondary)]", line: "bg-[var(--color-border)]" };
	}
}

interface ActivityTimelineProps {
	children: ReactNode;
	className?: string;
}

export function ActivityTimeline({ className, children }: ActivityTimelineProps) {
	return <div className={cn("flex flex-col", className)}>{children}</div>;
}

interface TimelineItemProps {
	title: string;
	description?: string;
	timestamp?: string;
	status?: Status;
	icon?: ReactNode;
	action?: ReactNode;
	className?: string;
	last?: boolean;
}

export function TimelineItem({
	title,
	description,
	timestamp,
	status = "default",
	icon,
	action,
	className,
	last = false,
}: TimelineItemProps) {
	const colors = statusStyles(status);
	return (
		<div className={cn("flex gap-[var(--space-3)]", className)}>
			<div className="flex flex-col items-center">
				<div
					className={cn("mt-1 size-[var(--icon-xs)] shrink-0 rounded-full", colors.dot)}
					aria-hidden="true"
				/>
				{!last && (
					<div
						className={cn("w-px flex-1 my-[var(--space-2)]", colors.line)}
						aria-hidden="true"
					/>
				)}
			</div>
			<div className="min-w-0 flex-1 pb-[var(--space-5)]">
				<div className="flex flex-col gap-[var(--space-3)] sm:flex-row sm:items-start sm:justify-between sm:gap-[var(--space-2)]">
					<div className="min-w-0">
						<div className="flex items-center gap-[var(--space-2)]">
							{icon && (
								<span className="shrink-0 size-[var(--icon-md)] flex items-center justify-center">
									{icon}
								</span>
							)}
							<span
								className="min-w-0 text-body font-medium leading-snug"
								style={{ color: "var(--color-text-primary)" }}
							>
								{title}
							</span>
						</div>
						{description && (
							<p
								className="mt-[var(--space-1)] text-caption leading-relaxed"
								style={{ color: "var(--color-text-secondary)" }}
							>
								{description}
							</p>
						)}
					</div>
					<div className="flex shrink-0 flex-wrap items-center gap-[var(--space-2)] sm:justify-end">
						{timestamp && (
							<span
								className="whitespace-nowrap text-caption tabular-nums"
								style={{ color: "var(--color-text-secondary)" }}
							>
								{timestamp}
							</span>
						)}
						{action && <div className="shrink-0">{action}</div>}
					</div>
				</div>
			</div>
		</div>
	);
}

export function TimelineSeparator({ className }: { className?: string }) {
	return (
		<div
			className={cn("w-px flex-1 my-[var(--space-2)] bg-[var(--color-border)]", className)}
			aria-hidden="true"
		/>
	);
}
