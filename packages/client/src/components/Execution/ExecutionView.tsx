import type { Workflow } from "@letra/types";
import type { ActiveFlowDefinition } from "../../lib/active-flow";
import AgentDetail from "./AgentDetail";
import { useEffect, useState } from "react";
import type { RunEntity } from "@letra/types";
import { Badge, Card, CardContent, EmptyState, Icon } from "@letra/ui";

interface ExecutionViewProps {
	workflow: Workflow;
	activeFlow: ActiveFlowDefinition | null;
	loading?: boolean;
}

export default function ExecutionView({ workflow, activeFlow, loading }: ExecutionViewProps) {
	const [runs, setRuns] = useState<RunEntity[]>([]);
	const [error, setError] = useState<string | null>(null);
	useEffect(() => {
		let active = true;
		const load = () => fetch("/api/runs").then(async (response) => {
			if (!response.ok) throw new Error("Não foi possível carregar as execuções.");
			return response.json() as Promise<RunEntity[]>;
		}).then((value) => { if (active) { setRuns(Array.isArray(value) ? value : []); setError(null); } }).catch(() => { if (active) setError("Estado das execuções indisponível."); });
		void load();
		const timer = window.setInterval(load, 5000);
		return () => { active = false; window.clearInterval(timer); };
	}, []);
	const stages = new Map((activeFlow?.stages ?? []).map((stage) => [stage.id, stage.name]));
	const items = new Map(workflow.items.map((item) => [item.id, item]));
	const nextAction = (run: RunEntity) => {
		if (run.status === "waiting-human") return "Decisão humana autenticada necessária para retomar.";
		if (run.status === "queued") return `Aguardando claim do executor ${run.binding.executorId}.`;
		if (run.status === "running") return run.lease ? `Acompanhar execução até ${new Date(run.lease.expiresAt).toLocaleString()}.` : "Acompanhar execução e próximo handoff.";
		if (run.status === "failed") return "Inspecionar a falha e executar a recuperação permitida.";
		return "Verificar handoff seguinte ou encerramento do item.";
	};
	return (
		<main className="flex flex-1 flex-col overflow-auto">
			<section aria-labelledby="runs-heading" className="flex flex-col gap-4 border-b border-border p-6">
				<header><h1 id="runs-heading" className="text-xl font-bold">Execuções por Run</h1><p className="text-sm text-muted-foreground">Atenção do workspace é independente das atribuições e permissões abaixo.</p></header>
				{error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
				{runs.length === 0 && !error ? <Card><EmptyState icon={<Icon name="activity" size={24} />} title="Nenhuma execução registrada" description="Claims publicados criarão uma Run canônica e visível aqui." /></Card> : null}
				<div className="grid gap-3 xl:grid-cols-2">{runs.map((run) => {
					const item = items.get(run.itemId);
					const currentStage = activeFlow?.stages.find((stage) => stage.id === (run.workflowStageId ?? item?.stage));
					const waitingGate = run.status === "waiting-human" ? currentStage?.gate : null;
					return <Card key={run.id} data-run-id={run.id}><CardContent className="flex flex-col gap-3">
					<div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">{run.id}</h2><Badge variant={run.status === "running" ? "success" : run.status === "waiting-human" ? "amber" : "info"}>{run.status}</Badge><Badge variant="info">revisão {run.revision}</Badge><Badge variant="info">ciclo {run.cycle.number}</Badge></div>
					<dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm"><div><dt className="text-muted-foreground">Item</dt><dd>{run.itemId}</dd></div><div><dt className="text-muted-foreground">Executor</dt><dd>{run.binding.executorId}</dd></div><div><dt className="text-muted-foreground">Concluído/executado por</dt><dd>{run.binding.actorId} · {run.binding.roleId}</dd></div><div><dt className="text-muted-foreground">Estágio</dt><dd>{stages.get(run.workflowStageId ?? "") ?? run.workflowStageId ?? "Não definido"}</dd></div><div><dt className="text-muted-foreground">Workflow version</dt><dd>{run.workflowVersionId}</dd></div><div><dt className="text-muted-foreground">Lease</dt><dd>{run.lease ? `expira ${new Date(run.lease.expiresAt).toLocaleString()}` : "Sem lease ativo"}</dd></div><div><dt className="text-muted-foreground">Direção</dt><dd className="truncate" title={run.directionRevision}>{run.directionRevision}</dd></div></dl>
					{run.handoffs.length ? <section aria-label="Passagens registradas" className="flex flex-col gap-1 text-sm"><h3 className="font-medium">Passagem e regra aplicada</h3>{run.handoffs.map((handoff, index) => <div key={`${handoff.createdAt}-${index}`}><p>{handoff.fromActorId} → {handoff.toActorId}</p><p className="text-muted-foreground">{handoff.fromStageId && handoff.toStageId ? `${stages.get(handoff.fromStageId) ?? handoff.fromStageId} → ${stages.get(handoff.toStageId) ?? handoff.toStageId}` : "Handoff sem troca de estágio"}{handoff.transitionId ? ` · ${handoff.transitionId}` : ""}</p>{handoff.summary ? <p>{handoff.summary}</p> : null}</div>)}</section> : null}
					{run.status === "waiting-human" ? <section role="status" className="rounded-md border border-warning/40 p-3 text-sm"><h3 className="font-medium">Espera humana</h3><p>{waitingGate?.name ?? "Gate humano configurado"}{item?.handoff?.summary ? ` · ${item.handoff.summary}` : " · decisão autenticada necessária"}</p></section> : null}
					{run.gateDecisions.length ? <section aria-label="Decisões de gate" className="text-sm"><h3 className="font-medium">Decisões registradas</h3>{run.gateDecisions.map((decision) => <p key={decision.id}>{decision.gateId}: {decision.decision} · {decision.decidedBy}</p>)}</section> : null}
					{run.evidence.length ? <section aria-label="Evidências da execução" className="text-sm"><h3 className="font-medium">Evidências ({run.evidence.length})</h3>{run.evidence.map((evidence) => <p key={evidence.id}>{evidence.kind}: <span className="break-all">{evidence.uri}</span></p>)}</section> : null}
					{item?.handoff ? <p className="text-sm">Destinatário atual: {item.handoff.to} · {item.handoff.evidence.length} evidência(s)</p> : null}
					<p className="text-sm"><strong>Próxima ação:</strong> {nextAction(run)}</p>
				</CardContent></Card>;
				})}</div>
			</section>
			<div className="min-h-0 flex-1"><AgentDetail workflow={workflow} activeFlow={activeFlow} loading={loading} /></div>
		</main>
	);
}
