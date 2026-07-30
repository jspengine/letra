import {
	ActionPanel,
	Badge,
	Button,
	Card,
	CardContent,
	CardHeader,
	EmptyState,
	Icon,
	List,
	ListItem,
	MetadataRow,
	NavHeader,
	Tag,
} from "@letra/ui";
import type { IconName } from "@letra/ui";

export interface PendingDecision {
	itemId: string;
	title: string;
	stage: string;
	actor: string;
	since: string;
}

export interface AttentionSignal {
	id: string;
	title: string;
	source: string;
	severity: "baixa" | "media" | "alta";
	status?: "novo" | "ciente" | "descartado" | "resolvido";
	detectedAt?: string;
	impact?: string;
	nextAction?: string;
	technicalType?: string;
	relatedSnapshot?: {
		id: string;
		timestamp: string;
		diagnosticId: string;
		diagnosticTitle: string;
		files: { path: string; before: string; after: string }[];
	};
}

export interface ActivityEvent {
	id: string;
	action: string;
	description: string;
	timestamp: string;
	itemId?: string | null;
}

export interface FocusedWork {
	id: string;
	title: string;
	description?: string;
	stage?: string;
	spec?: string;
	ageLabel?: string;
	actor?: string;
}

interface Props {
	decisions: PendingDecision[];
	signals: AttentionSignal[];
	healthSummary?: {
		novo: number;
		ciente: number;
		resolvido: number;
		descartado: number;
	};
	activity: ActivityEvent[];
	signalsAvailable?: boolean;
	activityAvailable?: boolean;
	primaryItemId?: string;
	primaryWork?: FocusedWork;
	onReviewDecision: (itemId: string) => void;
	onOpenItem: (itemId: string) => void;
	onOpenActivity: () => void;
	onOpenWork: () => void;
	onOpenSignal: (signal: AttentionSignal) => void;
	onScanHealth?: () => void;
	healthBusy?: boolean;
}

function eventTime(timestamp: string) {
	try {
		return new Date(timestamp).toLocaleString("pt-BR", {
			day: "2-digit",
			month: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
		});
	} catch {
		return timestamp;
	}
}

function severityVariant(severity: AttentionSignal["severity"]) {
	return severity === "alta" ? "error" : severity === "baixa" ? "info" : "amber";
}

function severityTone(severity: AttentionSignal["severity"]) {
	return severity === "alta" ? "danger" : severity === "baixa" ? "info" : "warning";
}

function statusLabel(status?: AttentionSignal["status"]) {
	if (status === "ciente") return "em acompanhamento";
	if (status === "descartado") return "descartado";
	if (status === "resolvido") return "resolvido";
	return "novo";
}

function statusVariant(status?: AttentionSignal["status"]) {
	if (status === "ciente") return "warning" as const;
	if (status === "resolvido") return "success" as const;
	if (status === "descartado") return "default" as const;
	return "info" as const;
}

function eventPresentation(action: string): {
	icon: IconName;
	variant: "amber" | "success" | "info" | "error" | "agent";
	tagVariant: "default" | "agent" | "success" | "info" | "warning" | "danger";
	tone: "default" | "warning" | "danger" | "success" | "info";
	label: string;
} {
	const normalized = action.toLowerCase();
	if (normalized.includes("fail") || normalized.includes("erro") || normalized.includes("error")) {
		return { icon: "circle-x", variant: "error", tagVariant: "danger", tone: "danger", label: "falha" };
	}
	if (normalized.includes("validate") || normalized.includes("build") || normalized.includes("test")) {
		return { icon: "terminal", variant: "amber", tagVariant: "warning", tone: "warning", label: "validacao" };
	}
	if (normalized.includes("done") || normalized.includes("complete") || normalized.includes("pass")) {
		return { icon: "circle-check", variant: "success", tagVariant: "success", tone: "success", label: "concluido" };
	}
	if (normalized.includes("agent") || normalized.includes("automation")) {
		return { icon: "bot", variant: "agent", tagVariant: "agent", tone: "info", label: "agente" };
	}
	return { icon: "activity", variant: "info", tagVariant: "info", tone: "info", label: "evento" };
}

export default function SupervisionInbox({
	decisions,
	signals,
	healthSummary,
	activity,
	signalsAvailable = true,
	activityAvailable = true,
	primaryItemId,
	primaryWork,
	onReviewDecision,
	onOpenItem,
	onOpenActivity,
	onOpenWork,
	onOpenSignal,
	onScanHealth,
	healthBusy = false,
}: Props) {
	const focusedWork =
		primaryWork ??
		(primaryItemId
			? {
					id: primaryItemId,
					title: primaryItemId,
				}
			: null);

	const nextAction = decisions[0]
		? {
				label: "Revisar decisao prioritaria",
				reason: "Um gate humano impede o fluxo de avancar sem sua decisao.",
				description: `Responder a solicitacao sobre ${decisions[0].itemId}.`,
				consequence: "A revisao abre a evidencia do item; nenhuma mudanca ocorre antes da sua decisao.",
				icon: "shield" as const,
				tone: "warning" as const,
				run: () => onReviewDecision(decisions[0].itemId),
			}
		: signals.length > 0
			? {
					label: "Examinar evidencias",
					reason: "Ha sinal ativo de saude pedindo investigacao antes de qualquer correcao.",
					description: "Compreender o impacto e a evidencia do sinal antes de agir.",
					consequence: "Abre a central de saude; nenhuma correcao e aplicada automaticamente.",
					icon: "alert-triangle" as const,
					tone: "info" as const,
					run: () => onOpenSignal(signals[0]),
				}
			: focusedWork
				? {
						label: "Abrir trabalho em foco",
						reason: "Nao ha decisao ou sinal ativo; acompanhe o item central da sessao.",
						description: `Continuar a supervisao de ${focusedWork.id}.`,
						consequence: "Abre o item sem alterar seu estagio ou estado canonico.",
						icon: "box" as const,
						tone: "default" as const,
						run: () => onOpenItem(focusedWork.id),
					}
				: {
						label: "Ver trabalho disponivel",
						reason: "Nao ha decisao ou sinal ativo; escolha um item para supervisionar.",
						description: "Escolher com seguranca o proximo trabalho a supervisionar.",
						consequence: "Abre Trabalho sem iniciar ou mover qualquer item.",
						icon: "grid" as const,
						tone: "default" as const,
						run: onOpenWork,
					};

	const attentionCount = decisions.length + signals.length;
	const attentionSummary =
		attentionCount > 0 ? (
			<div className="ds-cluster justify-end">
				{decisions.length > 0 ? (
					<Badge icon="shield" variant="amber" tone="soft">
						{decisions.length} decisoes
					</Badge>
				) : null}
				{signals.length > 0 ? (
					<Badge icon="alert-triangle" variant="amber" tone="soft">
						{signals.length} {signals.length === 1 ? "sinal" : "sinais"}
					</Badge>
				) : null}
			</div>
		) : (
			<Badge icon="circle-check" variant="success" tone="soft">
				nada aguardando voce
			</Badge>
		);

	const focusedWorkMetadata = focusedWork
		? [
				{
					label: "Item",
					value: (
						<Badge icon="box" variant="info" tone="soft">
							{focusedWork.id}
						</Badge>
					),
					icon: <Icon name="box" size={14} />,
				},
				...(focusedWork.stage
					? [
							{
								label: "Estagio",
								value: <Tag variant="info">{focusedWork.stage}</Tag>,
								icon: <Icon name="circle" size={14} />,
							},
						]
					: []),
				...(focusedWork.ageLabel
					? [
							{
								label: "Idade",
								value: focusedWork.ageLabel,
								icon: <Icon name="clock" size={14} />,
							},
						]
					: []),
				...(focusedWork.actor
					? [
							{
								label: "Responsavel",
								value: focusedWork.actor,
								icon: <Icon name="user" size={14} />,
							},
						]
					: []),
			]
		: [];

	return (
		<section aria-labelledby="supervision-inbox-title" className="ds-section">
			<NavHeader
				className="rounded-[var(--radius-md)]"
				titleId="supervision-inbox-title"
				title="Supervisao"
				description="O que precisa da sua atencao agora, sem misturar acompanhamento com operacao."
				left={<Icon name="shield" size={20} />}
				right={attentionSummary}
			/>
			<ActionPanel
				tone={nextAction.tone}
				icon={<Icon name={nextAction.icon} size={20} />}
				title="Prioridade agora"
				description={nextAction.description}
				action={<Button onClick={nextAction.run}>{nextAction.label}</Button>}
			>
				<div className="grid gap-[var(--space-1)]">
					<div className="ds-cluster">
						<Tag variant="info">{nextAction.label}</Tag>
						<Tag>nao altera estado</Tag>
					</div>
					<p className="text-caption font-medium text-[var(--color-text-primary)]">
						{nextAction.reason}
					</p>
					<p className="text-caption text-[var(--color-text-secondary)]">
						{nextAction.consequence}
					</p>
				</div>
			</ActionPanel>

			<div className="ds-panel-grid">
				<div className="ds-panel-grid content-start xl:grid-cols-2">
					<Card>
						<CardHeader className="flex flex-wrap items-center justify-between">
							<div className="ds-cluster min-w-0">
								<Icon name="shield" size={16} />
								<div className="min-w-0">
									<h2 className="font-semibold">Decisoes pendentes</h2>
									<p className="text-xs text-muted-foreground">
										Gates humanos que precisam da sua decisao antes do fluxo avancar.
									</p>
								</div>
							</div>
							<Badge icon={decisions.length > 0 ? "alert-triangle" : "circle"} variant={decisions.length > 0 ? "amber" : "info"} tone="soft">
								{decisions.length}
							</Badge>
						</CardHeader>
						<CardContent>
							{decisions.length === 0 ? (
								<EmptyState
									className="items-start text-left"
									icon={<Icon name="circle-check" size={20} />}
									title="Nenhuma decisao aguarda voce."
									description="Quando um gate humano aparecer, ele entra nesta fila com origem e consequencia."
								/>
							) : (
								<List>
									{decisions.map((decision) => (
										<ListItem
											key={decision.itemId}
											leading={<Icon name="shield" size={18} />}
											title={decision.title}
											description="Aguardando decisao humana antes do fluxo avancar."
											meta={
												<>
													<Badge icon="box" variant="info" tone="soft">
														{decision.itemId}
													</Badge>
													<Tag variant="warning">gate humano</Tag>
												</>
											}
											action={
												<Button size="sm" onClick={() => onReviewDecision(decision.itemId)} aria-label={`Revisar ${decision.itemId}`}>
													Revisar
												</Button>
											}
											tone="warning"
										>
											<MetadataRow
												className="mt-[var(--space-2)]"
												items={[
													{ label: "Estagio", value: <Tag variant="info">{decision.stage}</Tag>, icon: <Icon name="circle" size={14} /> },
													{ label: "Responsavel", value: decision.actor, icon: <Icon name="user" size={14} /> },
													{ label: "Desde", value: decision.since, icon: <Icon name="clock" size={14} /> },
												]}
											/>
										</ListItem>
									))}
								</List>
							)}
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="flex flex-wrap items-center justify-between">
							<div className="ds-cluster min-w-0">
								<Icon name="alert-triangle" size={16} />
								<div className="min-w-0">
									<h2 className="font-semibold">Saude do workspace</h2>
									<p className="text-xs text-muted-foreground">
										Sinais priorizados por impacto, evidencia e proxima acao segura.
									</p>
								</div>
							</div>
							<div className="ds-cluster">
								<Badge icon={signals.length > 0 ? "alert-triangle" : "circle"} variant={signals.length > 0 ? "amber" : "info"} tone="soft">
									{signals.length}
								</Badge>
								{onScanHealth ? (
									<Button variant="secondary" size="sm" onClick={onScanHealth} disabled={healthBusy}>
										<Icon name={healthBusy ? "loader-circle" : "activity"} size={14} />
										{healthBusy ? "Verificando" : "Verificar agora"}
									</Button>
								) : null}
							</div>
						</CardHeader>
						<CardContent>
							{healthSummary && signals.length > 0 ? (
								<MetadataRow
									className="mb-[var(--space-4)]"
									items={[
										{ label: "Novos", value: healthSummary.novo, icon: <Icon name="alert-triangle" size={14} /> },
										{ label: "Em acompanhamento", value: healthSummary.ciente, icon: <Icon name="clock" size={14} /> },
										{ label: "Resolvidos", value: healthSummary.resolvido, icon: <Icon name="circle-check" size={14} /> },
										{ label: "Descartados", value: healthSummary.descartado, icon: <Icon name="circle-x" size={14} /> },
									]}
								/>
							) : null}
							{!signalsAvailable ? (
								<EmptyState
									className="items-start text-left"
									icon={<Icon name="alert-circle" size={20} />}
									title="Saude indisponivel agora."
									description="A supervisao continua disponivel, mas sem a fotografia de saude do workspace."
								/>
							) : signals.length === 0 ? (
								<EmptyState
									className="items-start text-left"
									icon={<Icon name="circle-check" size={20} />}
									title="Nenhum sinal ativo de saude."
									description="Historico resolvido ou descartado fica em Atividade; esta area mostra apenas o que pede investigacao agora."
								/>
							) : (
								<List>
									{signals.map((signal) => (
										<ListItem
											key={signal.id}
											leading={<Icon name="alert-triangle" size={18} />}
											title={signal.title}
											description={signal.impact ?? "Pede investigacao antes de qualquer correcao."}
											meta={
												<>
													<Badge icon="alert-triangle" variant={severityVariant(signal.severity)} tone="soft">
														{signal.impact ?? "pede investigacao"}
													</Badge>
													<Tag variant={statusVariant(signal.status)}>{statusLabel(signal.status)}</Tag>
												</>
											}
											action={
												<Button variant="secondary" size="sm" onClick={() => onOpenSignal(signal)}>
													Detalhes
												</Button>
											}
											tone={severityTone(signal.severity)}
										>
											<MetadataRow
												className="mt-[var(--space-2)]"
												items={[
													{ label: "Origem", value: signal.source, icon: <Icon name="file-text" size={14} /> },
													{ label: "Urgencia", value: <Tag variant={signal.severity === "alta" ? "danger" : signal.severity === "baixa" ? "info" : "warning"}>{signal.severity}</Tag>, icon: <Icon name="alert-triangle" size={14} /> },
													{ label: "Acao segura", value: signal.nextAction ?? "investigar", icon: <Icon name="activity" size={14} /> },
												]}
											/>
										</ListItem>
									))}
								</List>
							)}
						</CardContent>
					</Card>
				</div>

				<div className="ds-panel-grid content-start">
					<Card>
						<CardHeader className="flex flex-wrap items-center justify-between">
							<div className="ds-cluster min-w-0">
								<Icon name="box" size={16} />
								<h2 className="font-semibold">Trabalho em foco</h2>
							</div>
							{focusedWork ? <Badge icon="box" variant="info" tone="soft">{focusedWork.id}</Badge> : null}
						</CardHeader>
						<CardContent>
							{focusedWork ? (
								<>
									<div className="grid gap-[var(--space-1)]">
										<div className="ds-cluster">
											<Tag variant="agent">supervisionavel</Tag>
											{focusedWork.actor ? <Tag>{focusedWork.actor}</Tag> : null}
										</div>
										<h3 className="text-body-sm font-semibold text-[var(--color-text-primary)]">
											{focusedWork.title}
										</h3>
										<p className="text-caption text-[var(--color-text-secondary)]">
											{decisions.length > 0
												? "Em foco porque esta relacionado a uma decisao humana."
												: signals.length > 0
													? "Em foco para cruzar sinais ativos com o trabalho atual."
													: "Em foco por ser o item central da sessao atual."}
										</p>
									</div>
									<MetadataRow items={focusedWorkMetadata} />
									<div className="flex flex-wrap items-center gap-[var(--layout-toolbar-gap)]">
										<Button variant="secondary" size="sm" onClick={() => onOpenItem(focusedWork.id)}>
											Abrir item
										</Button>
										<Tag variant="info">somente leitura</Tag>
									</div>
								</>
							) : (
								<EmptyState
									className="items-start text-left"
									icon={<Icon name="grid" size={20} />}
									title="Nenhum trabalho em foco."
									description="Abra Trabalho para escolher o proximo item a supervisionar."
									action={<Button variant="secondary" size="sm" onClick={onOpenWork}>Ver trabalho disponivel</Button>}
								/>
							)}
						</CardContent>
					</Card>
				</div>
			</div>

			<Card>
				<CardHeader className="flex flex-wrap items-center justify-between">
					<div className="ds-cluster min-w-0">
						<Icon name="activity" size={16} />
						<div className="min-w-0">
							<h2 className="font-semibold">Ultimas evidencias</h2>
							<p className="text-xs text-muted-foreground">
								Eventos recentes que comprovam o que aconteceu no workspace.
							</p>
						</div>
					</div>
					<Button variant="ghost" size="sm" onClick={onOpenActivity}>
						Ver toda atividade
					</Button>
				</CardHeader>
				<CardContent>
					{!activityAvailable ? (
						<EmptyState
							className="items-start text-left"
							icon={<Icon name="alert-circle" size={20} />}
							title="Atividade indisponivel no momento."
							description="A timeline completa permanece em Atividade quando o log voltar."
						/>
					) : activity.length === 0 ? (
						<EmptyState
							className="items-start text-left"
							icon={<Icon name="activity" size={20} />}
							title="Nenhuma atividade registrada."
							description="Eventos reais do workspace aparecem aqui como evidencia."
						/>
					) : (
						<List tone="surface">
							{activity.map((event) => {
								const presentation = eventPresentation(event.action);
								return (
									<ListItem
										key={event.id}
										leading={<Icon name={presentation.icon} size={18} />}
										title={event.description}
										description={eventTime(event.timestamp)}
										meta={
											<>
												<Badge icon={presentation.icon} variant={presentation.variant} tone="soft">
													{presentation.label}
												</Badge>
												<Tag variant={presentation.tagVariant}>{event.action}</Tag>
												{event.itemId ? <Tag>{event.itemId}</Tag> : null}
											</>
										}
										action={
											event.itemId ? (
												<Button variant="secondary" size="sm" onClick={() => onOpenItem(event.itemId as string)}>
													Abrir item
												</Button>
											) : null
										}
										tone={presentation.tone}
									/>
								);
							})}
						</List>
					)}
				</CardContent>
			</Card>
		</section>
	);
}
