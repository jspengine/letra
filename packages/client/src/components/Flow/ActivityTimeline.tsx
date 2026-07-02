import type { Workflow } from "@letra/types";
import { Icon } from "@letra/ui";
import type { IconName } from "@letra/ui";
import {
	orderedStages,
	stagePresentation,
	type ActiveFlowDefinition,
} from "../../lib/active-flow";
import { computeSlug } from "../../lib/item-utils";
import { cn } from "../../lib/utils";

interface Activity {
	id: string;
	timestamp: string;
	action: string;
	actor: string;
	target: string;
	stage?: string;
	icon: IconName;
	color: string;
}

interface Props {
	workflow: Workflow;
	activeFlow: ActiveFlowDefinition | null;
}

function timeLabel(iso: string): string {
	const d = new Date(iso);
	return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function groupKey(iso: string): string {
	const d = new Date(iso);
	const now = new Date();
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const yesterday = new Date(today.getTime() - 86400000);
	const dStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());

	if (dStart.getTime() === today.getTime()) return "Hoje";
	if (dStart.getTime() === yesterday.getTime()) return "Ontem";
	const weekAgo = new Date(today.getTime() - 7 * 86400000);
	if (dStart.getTime() >= weekAgo.getTime()) return "Esta semana";
	return "Anterior";
}

const GROUP_ORDER = ["Hoje", "Ontem", "Esta semana", "Anterior"];

export default function ActivityTimeline({ workflow, activeFlow }: Props) {
	const items = workflow.items;
	const stages = orderedStages(workflow, activeFlow);

	const activities: (Activity & { group: string })[] = items
		.slice()
		.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
		.slice(0, 30)
		.map((item) => {
			const stageObj = stages.find((stage) => stage.id === item.stage);
			const presentation = stageObj ? stagePresentation(stageObj) : null;
			const actor = item.claimedBy ?? "Sistema";
			return {
				id: `activity-${item.id}-${item.stage}`,
				timestamp: item.createdAt,
				action: `está em ${stageObj?.name || item.stage}`,
				actor,
				target: computeSlug(item, [], workflow),
				stage: item.stage,
				icon: presentation?.icon ?? "circle",
				color: presentation?.color ?? "var(--muted-foreground)",
				group: groupKey(item.createdAt),
			} as Activity & { group: string };
		});

	const grouped = GROUP_ORDER
		.map((g) => ({ group: g, items: activities.filter((a) => a.group === g) }))
		.filter((g) => g.items.length > 0);

	if (activities.length === 0) {
		return (
			<div className="flex flex-col gap-3 p-4">
				<h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
					Itens observados
				</h3>
				<p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
					Nenhuma atividade registrada
				</p>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-3 p-4">
			<div className="flex items-center justify-between">
				<h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
					Itens observados
				</h3>
				<span className="text-[9px] tabular-nums" style={{ color: "var(--muted-foreground)" }}>
					{activities.length} itens
				</span>
			</div>

			<div className="relative">
				<div className="absolute left-[11px] top-2 bottom-2 w-px" style={{ background: "var(--border)" }} />

				<div className="flex flex-col">
					{grouped.map((g) => (
						<div key={g.group} className="flex flex-col">
							<div className="flex items-center gap-2 py-1.5">
								<div className="w-5 h-5 rounded-full flex items-center justify-center bg-card border z-10" style={{ borderColor: "var(--border)" }}>
									<span className="text-[8px] font-bold" style={{ color: "var(--muted-foreground)" }}>{g.group === "Hoje" ? "H" : g.group === "Ontem" ? "O" : "S"}</span>
								</div>
								<span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
									{g.group}
								</span>
							</div>
							{g.items.map((act, idx) => (
								<div key={act.id} className={cn(
									"flex items-start gap-2.5 py-1.5 pl-0.5",
									idx < g.items.length - 1 ? "pb-2" : "",
								)}>
									<div className="relative z-10 flex items-center justify-center w-[22px] shrink-0">
										{act.actor !== "Sistema" ? (
											<div
												className="w-[18px] h-[18px] rounded-full flex items-center justify-center text-white text-[8px] font-bold border border-white/20"
												style={{ background: "var(--primary)" }}
											>
												{act.actor.charAt(0).toUpperCase()}
											</div>
										) : (
											<div
												className={cn(
													"w-[18px] h-[18px] rounded-full flex items-center justify-center bg-card border",
												)}
												style={{ borderColor: act.color }}
											>
												<Icon name={act.icon} size={10} style={{ color: act.color }} />
											</div>
										)}
									</div>
									<div className="flex-1 min-w-0 flex items-start gap-1.5">
										<div className="flex-1 min-w-0">
											<p className="text-[10px] leading-snug" style={{ color: "var(--foreground)" }}>
												<span className="font-medium">{act.actor}</span>
												<span className="text-muted-foreground"> {act.action}</span>
											</p>
											<p className="text-[9px] font-mono truncate" style={{ color: "var(--muted-foreground)" }}>
												{act.target}
											</p>
										</div>
										<span className="text-[8px] tabular-nums shrink-0 mt-0.5" style={{ color: "var(--muted-foreground)" }}>
											{timeLabel(act.timestamp)}
										</span>
									</div>
								</div>
							))}
						</div>
					))}
				</div>
			</div>

			{items.length > 30 && (
				<p className="text-[9px] text-center" style={{ color: "var(--muted-foreground)" }}>
					+{items.length - 30} mais atividades
				</p>
			)}
		</div>
	);
}
