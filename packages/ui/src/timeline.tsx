import { cn } from "./utils";
import type { ReactNode } from "react";

interface TimelineProps {
	children: ReactNode;
	className?: string;
}

export function Timeline({ className, children }: TimelineProps) {
	return (
		<div className={cn("flex flex-col gap-[var(--timeline-item-gap)]", className)}>
			{children}
		</div>
	);
}

type NodeStatus = "default" | "success" | "error" | "active" | "agent";

interface TimelineNodeProps {
	title: string;
	description?: string;
	status?: NodeStatus;
	icon?: ReactNode;
	children?: ReactNode;
	last?: boolean;
	className?: string;
}

const nodeStatusStyles: Record<NodeStatus, { dot: string; line: string }> = {
	default: { dot: "var(--color-text-disabled)", line: "var(--color-border)" },
	success: { dot: "var(--color-success)", line: "var(--color-success)" },
	error: { dot: "var(--color-danger)", line: "var(--color-danger)" },
	active: { dot: "var(--color-primary)", line: "var(--color-primary)" },
	agent: { dot: "var(--color-agent)", line: "var(--color-agent)" },
};

export function TimelineNode({
	title,
	description,
	status = "default",
	icon,
	children,
	last = false,
	className,
}: TimelineNodeProps) {
	const colors = nodeStatusStyles[status];
	const isAnimated = status === "active" || status === "agent";

	return (
		<div className={cn("flex gap-[var(--timeline-item-gap)]", className)}>
			<div className="flex flex-col items-center">
				<div
					className={cn(
						"mt-1 size-[var(--icon-xs)] shrink-0 rounded-full",
						isAnimated && "animate-timeline-dot",
					)}
					style={{ background: colors.dot }}
					aria-hidden="true"
				/>
				{!last && (
					<div
						className="my-[var(--layout-inline-gap)] w-px flex-1"
						style={{ background: colors.line }}
						aria-hidden="true"
					/>
				)}
			</div>
			<div className="min-w-0 flex-1 pb-[var(--layout-cluster-gap)]">
				<div className="flex items-start justify-between gap-[var(--layout-inline-gap)]">
					<div className="min-w-0">
						<div className="flex items-center gap-[var(--layout-inline-gap)]">
							{icon && (
								<span className="shrink-0 size-[var(--icon-md)] flex items-center justify-center">
									{icon}
								</span>
							)}
							<span
								className="text-body font-medium truncate"
								style={{ color: "var(--color-text-primary)" }}
							>
								{title}
							</span>
						</div>
						{description && (
							<p
								className="mt-[var(--space-1)] text-caption"
								style={{ color: "var(--color-text-secondary)" }}
							>
								{description}
							</p>
						)}
					</div>
				</div>
				{children && <div className="mt-[var(--layout-inline-gap)]">{children}</div>}
			</div>
		</div>
	);
}

interface TimelineBranchProps {
	children: ReactNode;
	className?: string;
}

export function TimelineBranch({ className, children }: TimelineBranchProps) {
	return (
		<div
			className={cn(
				"ml-[calc(var(--space-3)+var(--icon-xs)/2)] border-l-[length:var(--border-thin)] pl-[var(--space-4)]",
				className,
			)}
			style={{ borderColor: "var(--color-border)" }}
		>
			{children}
		</div>
	);
}
