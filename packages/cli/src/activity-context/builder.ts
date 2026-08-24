import { resolveActivityIntent } from "./intent.js";
import { getStageName, loadActivityContextSources } from "./sources.js";
import type {
	ActivityContext,
	ActivityContextCurrentItem,
	ActivityContextRisk,
	ActivityContextSignal,
	ActivityKind,
	BuildActivityContextOptions,
} from "./types.js";

function buildSignals(
	activity: ActivityKind,
	intentSignal: { code: string; message: string } | null,
	focusDiverged: boolean,
	alertCount: number,
	highSeverityCount: number,
	hasCurrentItem: boolean,
	pendingAcs: number,
): ActivityContextSignal[] {
	const signals: ActivityContextSignal[] = [];
	if (!hasCurrentItem) {
		signals.push({
			level: "warning",
			code: "no-current-item",
			message: "Nenhum item em andamento. Selecione um item no Kanban para começar.",
		});
	}
	if (focusDiverged) {
		signals.push({
			level: "error",
			code: "focus-diverged",
			message: "Foco desatualizado. Atualize focus.md ou selecione o item correto.",
		});
	}
	if (alertCount > 0) {
		signals.push({
			level: highSeverityCount > 0 ? "error" : "warning",
			code: "active-health-alerts",
			message: `${alertCount} alerta(s) ativo(s). Verifique o painel de supervisão antes de continuar.`,
		});
	}
	if ((activity === "review" || activity === "gate") && pendingAcs > 0) {
		signals.push({
			level: "warning",
			code: "pending-acceptance-criteria",
			message: `${pendingAcs} AC(s) pendente(s). Complete os critérios antes de prosseguir.`,
		});
	}
	if (intentSignal) {
		signals.push({ level: "info", ...intentSignal });
	}
	return signals;
}

function buildRisks(
	activity: ActivityKind,
	alertCount: number,
	highSeverityCount: number,
	pendingAcs: number,
): ActivityContextRisk[] {
	const risks: ActivityContextRisk[] = [];
	if (highSeverityCount > 0) {
		risks.push({
			level: "high",
			message: `${highSeverityCount} alerta(s) de severidade alta ainda estão ativos.`,
		});
	}
	if (pendingAcs > 0) {
		risks.push({
			level: activity === "review" || activity === "gate" ? "high" : "medium",
			message: `${pendingAcs} AC(s) ainda pendente(s) na spec ativa.`,
		});
	}
	if (alertCount > 0 && highSeverityCount === 0) {
		risks.push({
			level: "low",
			message: "Há alertas ativos que podem sinalizar drift ou inconsistência operacional.",
		});
	}
	return risks;
}

export function buildActivityContext(options: BuildActivityContextOptions): ActivityContext {
	const { activity, workspaceRoot } = options;
	const sources = loadActivityContextSources(workspaceRoot);
	const intent = resolveActivityIntent(activity, sources);
	const currentItem = sources.currentItem;
	const currentItemContext: ActivityContextCurrentItem | null = currentItem
		? {
				id: currentItem.id,
				description: currentItem.description,
				stage: currentItem.stage,
				stageName:
					sources.activeFlowStage?.name ??
					(sources.workflow
						? getStageName(sources.workflow, currentItem.stage)
						: currentItem.stage),
				currentPhase: sources.currentPhase ?? undefined,
				spec: currentItem.spec ?? null,
				outcome: sources.spec?.outcome ?? sources.focus?.outcome ?? null,
				acs: sources.spec?.acs ?? { pending: 0, done: 0, total: 0 },
			}
		: null;
	const stage = currentItem
		? {
				id: currentItem.stage,
				name:
					sources.activeFlowStage?.name ??
					(sources.workflow
						? getStageName(sources.workflow, currentItem.stage)
						: currentItem.stage),
			}
		: null;
	const highSeverityCount = sources.activeAlerts.filter(
		(entry) => entry.severity === "alta",
	).length;
	const pendingAcs = sources.spec?.acs.pending ?? 0;

	return {
		activity,
		objective: intent.objective,
		currentItem: currentItemContext,
		stage,
		mustRead: intent.mustRead,
		mustNotDo: intent.mustNotDo,
		nextActions: intent.nextActions,
		risks: buildRisks(activity, sources.activeAlerts.length, highSeverityCount, pendingAcs),
		signals: buildSignals(
			activity,
			intent.signal,
			sources.focusDiverged,
			sources.activeAlerts.length,
			highSeverityCount,
			!!currentItem,
			pendingAcs,
		),
	};
}
