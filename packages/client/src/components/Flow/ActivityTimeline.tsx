import type { Workflow } from "@letra/types";
import { Badge, Button, Icon, List, ListItem, Tag } from "@letra/ui";
import type { IconName } from "@letra/ui";
import {
	itemOperationalState,
	orderedStages,
	stagePresentation,
	type ActiveFlowDefinition,
	type OperationalState,
} from "../../lib/active-flow";
import { computeSlug } from "../../lib/item-utils";

interface Props {
	workflow: Workflow;
	activeFlow: ActiveFlowDefinition | null;
	onSelectItem?: (id: string) => void;
}

interface SupervisionSignal {
	id: string;
	itemId: string;
	title: string;
	subtitle: string;
	owner: string;
	age: string;
	stage: string;
	statusLabel: string;
	actionLabel: string;
	tone: "default" | "warning" | "danger" | "success" | "info";
	badgeVariant: "amber" | "success" | "info" | "error" | "agent";
	icon: IconName;
	priority: number;
	createdAt: number;
}

function daysSince(iso: string): number {
	const created = new Date(iso).getTime();
	if (Number.isNaN(created)) return 0;
	return Math.max(0, Math.floor((Date.now() - created) / 86400000));
}

function ageLabel(days: number): string {
	if (days === 0) return "Hoje";
	if (days === 1) return "1d no fluxo";
	return `${days}d no fluxo`;
}

function signalFromState(
	state: OperationalState,
	days: number,
): Pick<SupervisionSignal, "statusLabel" | "actionLabel" | "tone" | "badgeVariant" | "icon" | "priority"> {
	if (state === "waiting") {
		return { statusLabel: "Decisão", actionLabel: "Revisar gate", tone: "warning", badgeVariant: "amber", icon: "clock", priority: 0 };
	}
	if (state === "blocked") {
		return { statusLabel: "Bloqueio", actionLabel: "Examinar causa", tone: "danger", badgeVariant: "error", icon: "shield", priority: 1 };
	}
	if (state === "running") {
		return { statusLabel: "Em execução", actionLabel: "Acompanhar", tone: "info", badgeVariant: "agent", icon: "chevron-right", priority: 2 };
	}
	if (state === "done") {
		return { statusLabel: "Concluído", actionLabel: "Ver evidência", tone: "success", badgeVariant: "success", icon: "check-circle", priority: days > 14 ? 5 : 4 };
	}
	return { statusLabel: days >= 14 ? "Maior espera" : "Na fila", actionLabel: "Avaliar prioridade", tone: "default", badgeVariant: "info", icon: "circle", priority: days >= 14 ? 3 : 6 };
}

export default function ActivityTimeline({ workflow, activeFlow, onSelectItem }: Props) {
	const items = workflow.items;
	const stages = orderedStages(workflow, activeFlow);

	const signals: SupervisionSignal[] = items
		.map((item) => {
			const stageObj = stages.find((stage) => stage.id === item.stage);
			const presentation = stageObj ? stagePresentation(stageObj) : null;
			const state = itemOperationalState(item, workflow, activeFlow);
			const days = daysSince(item.createdAt);
			const signal = signalFromState(state, days);
			const slug = computeSlug(item, [], workflow);
			return {
				id: `signal-${item.id}-${item.stage}`,
				itemId: item.id,
				title: item.description?.trim() || slug,
				subtitle: item.spec ?? slug,
				owner: item.claimedBy ?? stageObj?.roles[0]?.label ?? "Não atribuído",
				age: ageLabel(days),
				stage: stageObj?.name ?? item.stage,
				...signal,
				icon: presentation?.icon ?? signal.icon,
				createdAt: new Date(item.createdAt).getTime(),
			} satisfies SupervisionSignal;
		})
		.sort((a, b) => a.priority - b.priority || b.createdAt - a.createdAt)
		.slice(0, 6);

	const attentionCount = signals.filter((signal) => signal.priority <= 3).length;

	if (signals.length === 0) {
		return (
			<div className="flex flex-col gap-3 p-4">
				<h3 className="app-section-muted text-xs font-semibold uppercase tracking-wider">
					O que observar agora
				</h3>
				<p className="app-section-muted text-xs">
					Nenhum item para observar agora.
				</p>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-3 p-4">
			<div className="grid gap-1">
				<div className="flex items-center justify-between gap-2">
					<h3 className="app-section-muted text-xs font-semibold uppercase tracking-wider">
						O que observar agora
					</h3>
					<Badge variant={attentionCount > 0 ? "amber" : "info"} tone="soft" className="tabular-nums">
						{attentionCount} prioridade{attentionCount === 1 ? "" : "s"}
					</Badge>
				</div>
				<p className="text-caption text-[var(--color-text-secondary)]">
					Decisões, bloqueios e esperas aparecem antes do restante.
				</p>
			</div>

			<List className="gap-2">
				{signals.map((signal) => (
					<ListItem
						key={signal.id}
						tone={signal.tone}
						className="grid-cols-1 items-start p-3 sm:grid-cols-1"
						meta={
							<>
								<Badge variant={signal.badgeVariant} tone="soft" icon={signal.icon}>
									{signal.statusLabel}
								</Badge>
								<Tag>{signal.stage}</Tag>
								<Tag>{signal.age}</Tag>
							</>
						}
						title={<span className="line-clamp-2">{signal.title}</span>}
						description={
							<span className="grid gap-1">
								<span className="truncate font-mono">{signal.subtitle}</span>
								<span className="truncate">{signal.owner} · {signal.actionLabel}</span>
							</span>
						}
						action={
							onSelectItem ? (
								<Button
									type="button"
									variant="secondary"
									size="sm"
									className="w-full justify-between text-caption"
									onClick={() => onSelectItem(signal.itemId)}
									aria-label={`Abrir ${signal.itemId}`}
								>
									Abrir
									<Icon name="chevron-right" size={12} />
								</Button>
							) : null
						}
					/>
				))}
			</List>

			{items.length > signals.length && (
				<p className="app-section-muted text-caption text-center">
					Mostrando 6 de {items.length} itens
				</p>
			)}
		</div>
	);
}
