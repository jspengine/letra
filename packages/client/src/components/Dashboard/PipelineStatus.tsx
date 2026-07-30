import { Card, CardContent, Icon } from "@letra/ui";
import type { IconName } from "@letra/ui";
import { cn } from "../../lib/utils";

export type StageStatus = "idle" | "running" | "done" | "failed" | "blocked" | "waiting";

export interface StageNodeData {
	id: string;
	label: string;
	status: StageStatus;
	agent?: string;
}

interface Props {
	stages: StageNodeData[];
}

const STATUS_ICON: Record<StageStatus, IconName | null> = {
	idle: null,
	running: "chevron-right",
	done: "check",
	failed: "x",
	blocked: "x-circle",
	waiting: "clock",
};

const STATUS_COLOR: Record<StageStatus, string> = {
	idle: "var(--color-text-secondary)",
	running: "var(--color-primary)",
	done: "var(--color-success)",
	failed: "var(--color-danger)",
	blocked: "var(--color-danger)",
	waiting: "var(--color-warning)",
};

export function StageNode({ stage }: { stage: StageNodeData }) {
	const isActive = stage.status === "running" || stage.status === "waiting";
	return (
		<div
			className={cn(
				"flex flex-col items-center gap-1.5 min-w-[80px] px-2 py-2 rounded-[var(--radius-sm)] transition-all duration-200",
				isActive && "bg-primary/5",
			)}
		>
			<div
				className={cn(
					"flex items-center justify-center w-8 h-8 rounded-full transition-all duration-200",
					stage.status === "running" && "animate-pulse shadow-sm",
					stage.status === "waiting" && "animate-pulse-gate-waiting",
				)}
				style={{
					background: stage.status === "done"
						? "var(--color-success)"
						: stage.status === "failed"
							? "var(--color-danger)"
							: stage.status === "blocked"
								? "var(--color-danger)"
								: isActive
									? "var(--color-primary)"
									: "var(--color-bg-surface)",
					color: stage.status === "idle" ? "var(--color-text-secondary)" : "white",
				}}
			>
				{STATUS_ICON[stage.status] ? (
					<Icon name={STATUS_ICON[stage.status]!} size={16} />
				) : (
					<div className="w-2 h-2 rounded-full" style={{ background: "var(--color-text-secondary)" }} />
				)}
			</div>
			<span
				className="text-[11px] font-medium text-center leading-tight"
				style={{ color: isActive ? "var(--color-primary)" : "var(--color-text-secondary)" }}
			>
				{stage.label}
			</span>
			{stage.agent && (
				<span className="text-caption" style={{ color: "var(--color-text-secondary)" }}>
					{stage.agent}
				</span>
			)}
		</div>
	);
}

export default function PipelineStatus({ stages }: Props) {
	const doneCount = stages.filter((s) => s.status === "done").length;
	const totalCount = stages.length;
	const currentIdx = stages.findIndex((s) => s.status === "running" || s.status === "waiting");
	const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

	return (
		<Card className="p-4">
			<CardContent className="p-0">
				<div className="flex items-center justify-between mb-4">
					<div className="flex items-center gap-2">
						<Icon name="bar-chart" size={16} style={{ color: "var(--color-primary)" }} />
						<span className="text-sm font-semibold">Pipeline</span>
					</div>
					<div className="flex items-center gap-2 text-xs" style={{ color: "var(--color-text-secondary)" }}>
						<span>{doneCount}/{totalCount} concluídos</span>
						<span
							className="font-semibold"
							style={{ color: progressPct === 100 ? "var(--color-success)" : "var(--color-primary)" }}
						>
							{progressPct}%
						</span>
					</div>
				</div>
				<div
					className="flex gap-1 overflow-x-auto pb-2"
					style={{ scrollbarWidth: "thin" }}
				>
					{stages.map((stage, idx) => (
						<div key={stage.id} className="flex items-center gap-1">
							<StageNode stage={stage} />
							{idx < stages.length - 1 && (
								<div
									className="w-4 h-px shrink-0"
									style={{
										background: stage.status === "done"
											? "var(--color-success)"
											: currentIdx > 0 && idx < currentIdx
												? "var(--color-success)"
												: "var(--color-border)",
									}}
								/>
							)}
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
}
