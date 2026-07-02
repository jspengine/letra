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
	idle: "var(--muted-foreground)",
	running: "var(--primary)",
	done: "var(--success)",
	failed: "var(--error)",
	blocked: "var(--gate-blocked)",
	waiting: "var(--gate-waiting)",
};

export function StageNode({ stage }: { stage: StageNodeData }) {
	const isActive = stage.status === "running" || stage.status === "waiting";
	return (
		<div
			className={cn(
				"flex flex-col items-center gap-1.5 min-w-[80px] px-2 py-2 rounded-lg transition-all duration-200",
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
						? "var(--success)"
						: stage.status === "failed"
							? "var(--error)"
							: stage.status === "blocked"
								? "var(--gate-blocked)"
								: isActive
									? "var(--primary)"
									: "var(--muted)",
					color: stage.status === "idle" ? "var(--muted-foreground)" : "white",
				}}
			>
				{STATUS_ICON[stage.status] ? (
					<Icon name={STATUS_ICON[stage.status]!} size={16} />
				) : (
					<div className="w-2 h-2 rounded-full" style={{ background: "var(--muted-foreground)" }} />
				)}
			</div>
			<span
				className="text-[11px] font-medium text-center leading-tight"
				style={{ color: isActive ? "var(--primary)" : "var(--muted-foreground)" }}
			>
				{stage.label}
			</span>
			{stage.agent && (
				<span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>
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
						<Icon name="bar-chart" size={16} style={{ color: "var(--primary)" }} />
						<span className="text-sm font-semibold">Pipeline</span>
					</div>
					<div className="flex items-center gap-2 text-xs" style={{ color: "var(--muted-foreground)" }}>
						<span>{doneCount}/{totalCount} concluídos</span>
						<span
							className="font-semibold"
							style={{ color: progressPct === 100 ? "var(--success)" : "var(--primary)" }}
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
											? "var(--success)"
											: currentIdx > 0 && idx < currentIdx
												? "var(--success)"
												: "var(--border)",
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
