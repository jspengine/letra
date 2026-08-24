import type { Workflow } from "@letra/types";
import { Badge, Card, CardContent, EmptyState, Icon, SkeletonAgentList } from "@letra/ui";
import { orderedStages, roleCatalog, type ActiveFlowDefinition } from "../../lib/active-flow";

interface AgentDetailProps {
	workflow: Workflow;
	activeFlow: ActiveFlowDefinition | null;
	loading?: boolean;
}

interface RuntimeActor {
	id: string;
	itemCount: number;
	stageNames: string[];
}

function runtimeActors(
	workflow: Workflow,
	activeFlow: ActiveFlowDefinition | null,
): RuntimeActor[] {
	const stages = orderedStages(workflow, activeFlow);
	const actors = new Map<string, { itemCount: number; stageIds: Set<string> }>();
	for (const item of workflow.items) {
		if (!item.claimedBy) continue;
		const current = actors.get(item.claimedBy) ?? { itemCount: 0, stageIds: new Set<string>() };
		current.itemCount += 1;
		current.stageIds.add(item.stage);
		actors.set(item.claimedBy, current);
	}
	return [...actors.entries()].map(([id, value]) => ({
		id,
		itemCount: value.itemCount,
		stageNames: [...value.stageIds].map(
			(stageId) => stages.find((stage) => stage.id === stageId)?.name ?? stageId,
		),
	}));
}

export default function AgentDetail({ workflow, activeFlow, loading }: AgentDetailProps) {
	if (loading) return <SkeletonAgentList />;

	const roles = roleCatalog(activeFlow);
	const actors = runtimeActors(workflow, activeFlow);
	const stages = orderedStages(workflow, activeFlow);

	return (
		<main className="grid flex-1 grid-cols-1 gap-6 overflow-auto p-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.6fr)]">
			<section className="flex min-w-0 flex-col gap-4">
				<header className="flex flex-col gap-1">
					<h1 className="text-xl font-bold">Papéis do flow</h1>
					<p className="text-sm text-muted-foreground">
						{roles.length} {roles.length === 1 ? "papel" : "papéis"} declarado
						{roles.length === 1 ? "" : "s"} pelo harness ativo.
					</p>
				</header>

				{roles.length === 0 ? (
					<Card>
						<EmptyState
							icon={<Icon name="cpu" size={24} />}
							title="Nenhum papel declarado"
							description="O flow atual não fornece papéis. A interface mantém uma apresentação neutra."
						/>
					</Card>
				) : (
					<div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
						{roles.map((role) => {
							const allowedStageNames = role.allowedStages.map(
								(stageId) =>
									stages.find((stage) => stage.id === stageId)?.name ?? stageId,
							);
							return (
								<Card key={role.id}>
									<CardContent className="flex h-full flex-col gap-3">
										<div className="flex items-start gap-3">
											<div className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-primary/10 text-primary">
												<Icon name="cpu" size={16} />
											</div>
											<div className="min-w-0 flex-1">
												<h2 className="truncate text-sm font-semibold">
													{role.label}
												</h2>
												<p className="text-xs text-muted-foreground">
													{role.description}
												</p>
											</div>
											<Badge variant="info">{role.id}</Badge>
										</div>

										<div className="flex flex-col gap-2">
											<p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
												Stages permitidos
											</p>
											<div className="flex flex-wrap gap-1.5">
												{allowedStageNames.length > 0 ? (
													allowedStageNames.map((name) => (
														<Badge key={name} variant="info">
															{name}
														</Badge>
													))
												) : (
													<span className="text-xs text-muted-foreground">
														Não informado
													</span>
												)}
											</div>
										</div>

										<div className="flex flex-col gap-2">
											<p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
												Capacidades
											</p>
											<div className="flex flex-wrap gap-1.5">
												{role.capabilities.length > 0 ? (
													role.capabilities.map((capability) => (
														<Badge key={capability} variant="info">
															{capability}
														</Badge>
													))
												) : (
													<span className="text-xs text-muted-foreground">
														Não informadas
													</span>
												)}
											</div>
										</div>
									</CardContent>
								</Card>
							);
						})}
					</div>
				)}
			</section>

			<section className="flex min-w-0 flex-col gap-4">
				<header className="flex flex-col gap-1">
					<h2 className="text-base font-semibold">Atores em execução</h2>
					<p className="text-sm text-muted-foreground">
						Presenças observadas nos itens do workspace.
					</p>
				</header>

				{actors.length === 0 ? (
					<Card>
						<EmptyState
							icon={<Icon name="activity" size={24} />}
							title="Nenhum ator ativo"
							description="Nenhum item está atribuído neste momento."
						/>
					</Card>
				) : (
					<div className="grid grid-cols-1 gap-3">
						{actors.map((actor) => (
							<Card key={actor.id}>
								<CardContent className="flex flex-col gap-3">
									<div className="flex items-center gap-3">
										<div className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
											<span className="text-xs font-bold">
												{actor.id.charAt(0).toUpperCase()}
											</span>
										</div>
										<div className="min-w-0 flex-1">
											<p className="truncate text-sm font-semibold">
												{actor.id}
											</p>
											<p className="text-xs text-muted-foreground">
												{actor.itemCount} item
												{actor.itemCount === 1 ? "" : "s"} atribuído
												{actor.itemCount === 1 ? "" : "s"}
											</p>
										</div>
										<Badge variant="success">Ativo</Badge>
									</div>
									<div className="flex flex-wrap gap-1.5">
										{actor.stageNames.map((stageName) => (
											<Badge key={stageName} variant="info">
												{stageName}
											</Badge>
										))}
									</div>
								</CardContent>
							</Card>
						))}
					</div>
				)}
			</section>
		</main>
	);
}
