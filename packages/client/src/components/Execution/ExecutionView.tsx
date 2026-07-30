import type { Workflow } from "@letra/types";
import { Card, CardContent, Badge, Button, Icon, ConfirmDialog, EmptyState, SkeletonPipeline } from "@letra/ui";
import type { IconName } from "@letra/ui";
import { cn } from "../../lib/utils";
import { useState } from "react";

export type ExecStatus = "idle" | "running" | "done" | "failed" | "blocked" | "waiting";

export interface ExecStage {
	id: string;
	label: string;
	agent: string;
	agentIcon: IconName;
	status: ExecStatus;
	isHumanGate?: boolean;
	nextStageId?: string;
	rejectStageId?: string;
	output?: string;
	duration?: string;
	error?: string;
}

interface Props {
	stages: ExecStage[];
	workflow: Workflow;
	flowName?: string;
	loading?: boolean;
}

const STAGE_ICONS: Record<ExecStatus, IconName> = {
	idle: "circle",
	running: "chevron-right",
	done: "check-circle",
	failed: "alert-circle",
	blocked: "x-circle",
	waiting: "clock",
};

const STAGE_COLORS: Record<ExecStatus, string> = {
	idle: "var(--color-text-secondary)",
	running: "var(--color-primary)",
	done: "var(--color-success)",
	failed: "var(--color-danger)",
	blocked: "var(--color-danger)",
	waiting: "var(--color-warning)",
};

export function AgentThinking() {
	return (
		<div className="flex items-center gap-2 py-1">
			<div className="animate-agent-thinking w-24 h-2 rounded" />
			<div className="animate-agent-thinking w-16 h-2 rounded" style={{ animationDelay: "0.2s" }} />
			<div className="animate-agent-thinking w-20 h-2 rounded" style={{ animationDelay: "0.4s" }} />
		</div>
	);
}

export default function ExecutionView({ stages, workflow, flowName, loading }: Props) {
	const [rejectTarget, setRejectTarget] = useState<string | null>(null);
	const [rejectReason, setRejectReason] = useState("");

	if (loading) {
		return <SkeletonPipeline />;
	}

	if (stages.length === 0 || workflow.items.length === 0) {
		return (
			<EmptyState
				icon={<Icon name="flow" size={24} />}
				title="Nenhum item em execução"
				description={`Itens aparecerão aqui quando estiverem em andamento no flow ${flowName ?? workflow.name}.`}
			/>
		);
	}

	function handleApprove(stageId: string) {
		const stage = stages.find((entry) => entry.id === stageId);
		const item = workflow.items.find((it) => it.stage === stageId);
		if (!item) return;
		if (!stage?.nextStageId) return;
		fetch(`/api/items/${item.id}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				stage: stage.nextStageId,
			}),
		}).catch(() => {});
	}

	function handleReject(stageId: string, reason: string) {
		const stage = stages.find((entry) => entry.id === stageId);
		const item = workflow.items.find((it) => it.stage === stageId);
		if (!item) return;
		if (!stage?.rejectStageId) return;
		fetch(`/api/items/${item.id}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ stage: stage.rejectStageId }),
		}).catch(() => {});
		setRejectTarget(null);
		setRejectReason("");
	}

	return (
		<div className="flex flex-col gap-1 p-6 max-w-3xl mx-auto w-full">
			<div className="mb-4">
				<h1 className="text-xl font-bold">Execution Flow</h1>
				<p className="text-sm mt-1" style={{ color: "var(--color-text-secondary)" }}>
					{workflow.name} · {workflow.items.length} items
				</p>
			</div>

			<div className="relative">
				{/* Vertical line */}
				<div
					className="absolute left-[19px] top-0 bottom-0 w-px"
					style={{ background: "var(--color-border)" }}
				/>

				<div className="flex flex-col gap-0">
					{stages.map((stage, idx) => {
						const isLast = idx === stages.length - 1;
						const color = STAGE_COLORS[stage.status];
						const isGate = stage.isHumanGate === true;

						return (
							<div key={stage.id} className="relative flex gap-4 pb-6 last:pb-0">
								{/* Status dot */}
								<div className="relative z-10 flex flex-col items-center">
									<div
										className={cn(
											"flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-300",
											stage.status === "running" && "animate-pulse shadow-md",
											stage.status === "waiting" && "animate-pulse-gate-waiting",
										)}
										style={{
											borderColor: color,
											background: stage.status === "done"
												? "var(--color-success)"
												: stage.status === "failed"
													? "var(--color-danger)"
													: "var(--color-bg-surface)",
											color: stage.status === "done" || stage.status === "failed"
												? "white"
												: color,
										}}
									>
										<Icon name={STAGE_ICONS[stage.status]} size={16} />
									</div>
								</div>

								{/* Content card */}
								<div className="flex-1 min-w-0 pt-1">
									<Card
										className={cn(
											"transition-all duration-200",
											stage.status === "running" && "ring-1",
											stage.status === "waiting" && "ring-1",
										)}
										style={{
											borderColor: stage.status === "idle" ? "var(--color-border)" : color,
											...(stage.status === "running" || stage.status === "waiting"
												? { boxShadow: `0 0 0 1px ${color}40` }
												: {}),
										}}
									>
										<CardContent className="p-4">
											{/* Header */}
											<div className="flex items-center justify-between mb-2">
												<div className="flex items-center gap-2">
													<Icon name={stage.agentIcon} size={16} style={{ color }} />
													<span className="text-sm font-semibold">{stage.label}</span>
												</div>
												<div className="flex items-center gap-2">
													{stage.duration && (
														<span className="text-caption" style={{ color: "var(--color-text-secondary)" }}>
															{stage.duration}
														</span>
													)}
													<Badge
														variant={
															stage.status === "done" ? "success"
															: stage.status === "failed" ? "amber"
															: stage.status === "waiting" ? "amber"
															: "info"
														}
														className="text-caption"
													>
														{stage.status === "idle" ? "Aguardando"
														: stage.status === "running" ? "Executando"
														: stage.status === "done" ? "Concluído"
														: stage.status === "failed" ? "Falhou"
														: stage.status === "blocked" ? "Bloqueado"
														: "Aguardando aprovação"}
													</Badge>
												</div>
											</div>

											{/* Agent info */}
											<div className="flex items-center gap-2 mb-2">
												<span className="text-xs font-medium" style={{ color: "var(--color-text-secondary)" }}>
													Ator: {stage.agent}
												</span>
											</div>

											{/* Running shimmer */}
											{stage.status === "running" && <AgentThinking />}

											{/* Output */}
											{stage.output && (
												<div
													className="text-xs p-2 rounded mt-1 font-mono whitespace-pre-wrap max-h-24 overflow-y-auto"
													style={{
														background: "var(--color-bg-surface)",
														color: "var(--color-text-secondary)",
													}}
												>
													{stage.output}
												</div>
											)}

											{/* Error */}
											{stage.error && (
												<div
													className="text-xs p-2 rounded mt-1 font-mono whitespace-pre-wrap"
													style={{
														background: "color-mix(in oklch, var(--color-danger) 10%, transparent)",
														color: "var(--color-danger)",
													}}
												>
													{stage.error}
												</div>
											)}

											{/* Gate actions */}
											{isGate && stage.status === "waiting" && (
												<div className="flex items-center gap-2 mt-3 pt-3 border-t" style={{ borderColor: "var(--color-border)" }}>
													<Button variant="primary" size="sm" onClick={() => handleApprove(stage.id)}>
														<Icon name="check" size={14} />
														Aprovar
													</Button>
													<Button variant="ghost" size="sm">
														<Icon name="edit" size={14} />
														Solicitar Alterações
													</Button>
													<Button variant="ghost" size="sm" onClick={() => setRejectTarget(stage.id)}>
														<Icon name="x" size={14} />
														Rejeitar
													</Button>
												</div>
											)}
										</CardContent>
									</Card>
								</div>
							</div>
						);
					})}
				</div>
			</div>

			<ConfirmDialog
				open={rejectTarget !== null}
				onClose={() => { setRejectTarget(null); setRejectReason(""); }}
				onConfirm={() => rejectTarget && handleReject(rejectTarget, rejectReason)}
				title="Rejeitar item?"
				message="O item será movido para o backlog. Informe o motivo:"
				confirmLabel="Rejeitar"
				variant="danger"
			/>
		</div>
	);
}
