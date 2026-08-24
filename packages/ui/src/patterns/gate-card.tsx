import type { ReactNode } from "react";
import { Badge } from "../badge";
import { cn } from "../utils";

type GateStatus = "waiting" | "available" | "approved" | "blocked";

export type { GateStatus };

function statusColor(status: GateStatus): string {
	switch (status) {
		case "approved":
			return "var(--color-success)";
		case "blocked":
			return "var(--color-danger)";
		case "available":
			return "var(--color-primary)";
		default:
			return "var(--color-warning)";
	}
}

function statusLabel(status: GateStatus): string {
	switch (status) {
		case "approved":
			return "Approved";
		case "blocked":
			return "Blocked";
		case "available":
			return "Available";
		default:
			return "Waiting";
	}
}

function statusVariant(status: GateStatus): "amber" | "success" | "error" {
	if (status === "approved") return "success";
	if (status === "blocked") return "error";
	return "amber";
}

interface GateCardProps {
	title: string;
	status?: GateStatus;
	urgency?: "low" | "medium" | "high" | "critical";
	description?: string;
	meta?: ReactNode;
	action?: ReactNode;
	className?: string;
}

export function GateCard({
	title,
	status = "waiting",
	urgency = "medium",
	description,
	meta,
	action,
	className,
}: GateCardProps) {
	return (
		<div
			className={cn(
				"rounded-[var(--radius-md)] border-[length:var(--border-thin)] bg-[var(--color-bg-surface)] p-[var(--space-4)] shadow-sm",
				className,
			)}
			style={{
				borderLeftWidth: "2px",
				borderLeftColor: statusColor(status),
				borderColor: "var(--color-border)",
			}}
		>
			<div className="flex items-start justify-between gap-[var(--space-2)]">
				<div className="min-w-0">
					<div className="flex items-center gap-[var(--space-2)]">
						<span
							className="text-h3 truncate"
							style={{ color: "var(--color-text-primary)" }}
						>
							{title}
						</span>
					</div>
					{description && (
						<p
							className="mt-[var(--space-1)] line-clamp-2 text-caption"
							style={{ color: "var(--color-text-secondary)" }}
						>
							{description}
						</p>
					)}
				</div>
				<div className="flex shrink-0 items-center gap-[var(--space-2)]">
					<Badge variant={statusVariant(status)}>{statusLabel(status)}</Badge>
					{urgency === "critical" && (
						<Badge variant="error" aria-label="Urgency Critical">
							Critical
						</Badge>
					)}
				</div>
			</div>
			{(meta || action) && (
				<div className="mt-[var(--space-3)] flex items-center justify-between gap-[var(--space-2)]">
					{meta && (
						<div
							className="truncate text-caption"
							style={{ color: "var(--color-text-secondary)" }}
						>
							{meta}
						</div>
					)}
					{action && <div className="shrink-0">{action}</div>}
				</div>
			)}
		</div>
	);
}
