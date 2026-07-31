import { useCallback, useEffect, useMemo, useState } from "react";
import type { Item, Workflow } from "@letra/types";
import {
	ActionPanel,
	Badge,
	Button,
	Card,
	CardContent,
	CardHeader,
	ErrorBanner,
	Icon,
	List,
	ListItem,
	MetadataRow,
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
	Sheet,
	SheetClose,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
	SkeletonCard,
	Tag,
} from "@letra/ui";
import type { ActiveFlowDefinition } from "../../lib/active-flow";
import { humanGateStageIds, orderedStages, stageAgentLabel } from "../../lib/active-flow";
import SupervisionInbox, {
	type ActivityEvent,
	type AttentionSignal,
	type FocusedWork,
	type PendingDecision,
} from "./SupervisionInbox";

interface Props {
	workflow: Workflow;
	activeFlow: ActiveFlowDefinition | null;
	onTabChange?: (tab: "work" | "activity") => void;
}

interface FocusData {
	active: boolean;
	spec?: string;
	itemId?: string;
}

interface HealthEntry {
	id?: string;
	type?: string;
	title?: string;
	what?: string;
	source?: string;
	where?: string;
	severity?: string;
	status?: "novo" | "ciente" | "descartado" | "resolvido";
	detectedAt?: string;
	resolvedAt?: string | null;
	dismissedAt?: string | null;
	dismissReason?: string | null;
	acknowledgedAt?: string | null;
}

interface HealthResponse {
	summary?: {
		novo?: number;
		ciente?: number;
		resolvido?: number;
		descartado?: number;
	};
	entries?: HealthEntry[];
	active?: HealthEntry[];
}

interface DiagnosticSnapshot {
	id: string;
	timestamp: string;
	diagnosticId: string;
	diagnosticTitle: string;
	files: { path: string; before: string; after: string }[];
}

interface DiagnosticSnapshotsResponse {
	snapshots?: DiagnosticSnapshot[];
}

interface HealthSummaryView {
	novo: number;
	ciente: number;
	resolvido: number;
	descartado: number;
}

interface LogEntry {
	id: string;
	timestamp: string;
	action: string;
	description: string;
	itemId?: string | null;
}

interface LogResponse {
	entries?: LogEntry[];
}

function DashboardSkeleton() {
	return (
		<div className="flex w-full min-w-0 flex-col gap-[var(--layout-page-gap)] p-[var(--layout-page-padding)]">
			<SkeletonCard />
			<div className="ds-panel-grid xl:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
				<SkeletonCard />
				<SkeletonCard />
			</div>
			<SkeletonCard />
		</div>
	);
}

function daysSince(dateStr: string): number {
	return Math.floor(
		(Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24),
	);
}

function formatAgeLabel(createdAt: string): string {
	const days = daysSince(createdAt);
	if (days === 0) return "Hoje";
	if (days === 1) return "1 dia";
	return `${days} dias`;
}

function formatSince(timestamp: string): string {
	const diff = Date.now() - new Date(timestamp).getTime();
	const hours = Math.floor(diff / (1000 * 60 * 60));
	if (hours < 1) {
		const minutes = Math.max(1, Math.floor(diff / (1000 * 60)));
		return `há ${minutes}min`;
	}
	if (hours < 24) return `há ${hours}h`;
	const days = Math.floor(hours / 24);
	return `há ${days}d`;
}

function severityLabel(value?: string): "baixa" | "media" | "alta" {
	if (!value) return "media";
	const normalized = value.toLowerCase();
	if (normalized.includes("crit") || normalized.includes("alta") || normalized.includes("high")) {
		return "alta";
	}
	if (normalized.includes("low") || normalized.includes("baixa")) {
		return "baixa";
	}
	return "media";
}

function signalImpact(severity: "baixa" | "media" | "alta") {
	if (severity === "alta") return "bloqueia conclusao";
	if (severity === "media") return "pede investigacao";
	return "pode aguardar";
}

function signalNextAction(status?: AttentionSignal["status"]) {
	if (status === "ciente") return "acompanhar";
	if (status === "resolvido") return "ver evidencia";
	if (status === "descartado") return "ver justificativa";
	return "investigar";
}

function formatEvidenceDate(timestamp?: string | null) {
	if (!timestamp) return "nao registrado";
	try {
		return new Date(timestamp).toLocaleString("pt-BR", {
			day: "2-digit",
			month: "2-digit",
			year: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	} catch {
		return timestamp;
	}
}

function summarizeHealth(health: HealthResponse): HealthSummaryView {
	const entries = health.entries ?? [];
	return {
		novo: health.summary?.novo ?? entries.filter((entry) => entry.status === "novo").length,
		ciente: health.summary?.ciente ?? entries.filter((entry) => entry.status === "ciente").length,
		resolvido: health.summary?.resolvido ?? entries.filter((entry) => entry.status === "resolvido").length,
		descartado: health.summary?.descartado ?? entries.filter((entry) => entry.status === "descartado").length,
	};
}

function findRelatedSnapshot(entry: HealthEntry, snapshots: DiagnosticSnapshot[]) {
	const candidates = [entry.id, entry.type, entry.source, entry.where, entry.title, entry.what]
		.filter(Boolean)
		.map((value) => String(value).toLowerCase());

	return snapshots.find((snapshot) => {
		const diagnosticId = snapshot.diagnosticId.toLowerCase();
		const diagnosticTitle = snapshot.diagnosticTitle.toLowerCase();
		return candidates.some((candidate) => {
			if (!candidate) return false;
			return diagnosticId === candidate || diagnosticId.includes(candidate) || diagnosticTitle.includes(candidate);
		});
	});
}

function normalizeSnapshots(data: DiagnosticSnapshotsResponse): DiagnosticSnapshot[] {
	return (data.snapshots ?? []).filter((snapshot) => Array.isArray(snapshot.files));
}

function buildDiffPreview(before: string, after: string, maxLines = 16): string[] {
	const beforeLines = before.split(/\r?\n/);
	const afterLines = after.split(/\r?\n/);
	let start = 0;
	while (start < beforeLines.length && start < afterLines.length && beforeLines[start] === afterLines[start]) {
		start += 1;
	}

	let beforeEnd = beforeLines.length - 1;
	let afterEnd = afterLines.length - 1;
	while (beforeEnd >= start && afterEnd >= start && beforeLines[beforeEnd] === afterLines[afterEnd]) {
		beforeEnd -= 1;
		afterEnd -= 1;
	}

	const removed = beforeLines.slice(start, beforeEnd + 1).slice(0, Math.floor(maxLines / 2));
	const added = afterLines.slice(start, afterEnd + 1).slice(0, maxLines - removed.length);
	const preview = [
		...removed.map((line) => `- ${line || "(linha vazia)"}`),
		...added.map((line) => `+ ${line || "(linha vazia)"}`),
	];
	return preview.length > 0 ? preview : ["Sem diferenca textual entre before/after."];
}

function mapHealthSignals(health: HealthResponse, snapshots: DiagnosticSnapshot[] = []): AttentionSignal[] {
	return (health.active ?? []).slice(0, 4).map((entry, index) => {
		const severity = severityLabel(entry.severity);
		return {
			id: entry.id ?? `health-${index}`,
			title: entry.title ?? entry.what ?? "Alerta ativo",
			source: entry.source ?? entry.where ?? "health",
			severity,
			status: entry.status ?? "novo",
			detectedAt: entry.detectedAt,
			impact: signalImpact(severity),
			nextAction: signalNextAction(entry.status),
			technicalType: entry.type,
			relatedSnapshot: findRelatedSnapshot(entry, snapshots),
		};
	});
}

function GovernanceSummary({
	spec,
	primaryItem,
	primaryStageName,
}: {
	spec: string;
	primaryItem?: Item;
	primaryStageName?: string;
}) {
	return (
		<ActionPanel
			density="compact"
			tone="info"
			icon={<Icon name="file-text" size={20} />}
			title="Governança do workspace"
			description="Contexto canônico usado para interpretar decisões, evidências e trabalho em foco nesta sessão."
			meta={
				<>
					<Badge icon="file-text" variant="info" tone="soft">
						{spec}
					</Badge>
					<Tag variant="info">contrato ativo</Tag>
				</>
			}
		>
			<MetadataRow
				items={[
					{
						label: "Spec",
						value: spec,
						icon: <Icon name="file-text" size={14} />,
					},
					...(primaryItem
						? [
								{
									label: "Item vinculado",
									value: (
										<Badge icon="box" variant="info" tone="soft">
											{primaryItem.id}
										</Badge>
									),
									icon: <Icon name="box" size={14} />,
								},
							]
						: []),
					...(primaryStageName
						? [
								{
									label: "Estágio",
									value: <Tag variant="info">{primaryStageName}</Tag>,
									icon: <Icon name="circle" size={14} />,
								},
							]
						: []),
				]}
			/>
		</ActionPanel>
	);
}

function ItemSheet({
	item,
	stageName,
	open,
	onOpenChange,
}: {
	item: Item | null;
	stageName: string | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	if (!item) return null;

	const itemMetadata = [
		{
			label: "Estágio",
			value: <Tag variant="info">{stageName ?? item.stage}</Tag>,
			icon: <Icon name="circle" size={14} />,
		},
		{
			label: "Idade",
			value: formatAgeLabel(item.createdAt),
			icon: <Icon name="clock" size={14} />,
		},
		...(item.spec
			? [
					{
						label: "Spec",
						value: item.spec,
						icon: <Icon name="file-text" size={14} />,
					},
				]
			: []),
		...(item.claimedBy
			? [
					{
						label: "Responsável",
						value: item.claimedBy,
						icon: <Icon name="user" size={14} />,
					},
				]
			: []),
	];

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent>
				<SheetHeader>
					<SheetTitle>{item.id}</SheetTitle>
				</SheetHeader>
				<div className="grid gap-[var(--layout-panel-gap)] p-[var(--card-padding)]">
					<Card>
						<CardContent>
							<div className="ds-stack">
								<div className="grid gap-[var(--space-1)]">
									<div className="ds-cluster">
										<Badge icon="box" variant="info" tone="soft">
											{item.id}
										</Badge>
										{item.claimedBy ? <Tag>{item.claimedBy}</Tag> : null}
									</div>
									<p className="text-body-sm font-medium text-[var(--color-text-primary)]">
										{item.description || "Sem descrição"}
									</p>
								</div>
								<MetadataRow items={itemMetadata} />
								{item.tasks && item.tasks.length > 0 ? (
									<div className="ds-stack">
										<div className="ds-cluster">
											<Icon name="list-three" size={16} />
											<h3 className="font-semibold">Tasks</h3>
											<Badge variant="info" tone="soft">
												{item.tasks.length}
											</Badge>
										</div>
										<List>
											{item.tasks.map((task) => (
												<ListItem
													key={task.id}
													leading={
														<Icon name={task.done ? "circle-check" : "circle"} size={18} />
													}
													title={task.description}
													meta={
														<Tag variant={task.done ? "success" : "info"}>
															{task.done ? "feito" : "pendente"}
														</Tag>
													}
												/>
											))}
										</List>
									</div>
								) : null}
							</div>
						</CardContent>
					</Card>
				</div>
				<SheetFooter>
					<Button variant="secondary" onClick={() => onOpenChange(false)}>
						Fechar
					</Button>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}

function SignalSheet({
	signal,
	open,
	onOpenChange,
	onAcknowledge,
	onDismiss,
	onScan,
	actionBusy,
	actionMessage,
}: {
	signal: AttentionSignal | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onAcknowledge: (signal: AttentionSignal) => void;
	onDismiss: (signal: AttentionSignal) => void;
	onScan: () => void;
	actionBusy?: boolean;
	actionMessage?: string;
}) {
	if (!signal) return null;
	const diffFile = signal.relatedSnapshot?.files[0];
	const diffPreview = diffFile ? buildDiffPreview(diffFile.before, diffFile.after) : [];

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent
				side="right"
				className="w-full max-w-[100vw] sm:max-w-3xl lg:max-w-4xl"
				aria-labelledby="signal-sheet-title"
				aria-describedby="signal-sheet-description"
			>
				<SheetHeader className="items-start gap-4">
					<div className="grid min-w-0 gap-[var(--space-2)]">
						<div className="ds-cluster">
							<Badge icon="alert-triangle" variant={signal.severity === "alta" ? "error" : signal.severity === "baixa" ? "info" : "amber"} tone="soft">
								{signal.impact ?? "pede investigacao"}
							</Badge>
							<Tag variant={signal.status === "ciente" ? "warning" : signal.status === "resolvido" ? "success" : signal.status === "descartado" ? "default" : "info"}>
								{signal.status === "ciente" ? "em acompanhamento" : signal.status ?? "novo"}
							</Tag>
						</div>
						<SheetTitle id="signal-sheet-title" className="break-words leading-tight">{signal.title}</SheetTitle>
						<SheetDescription id="signal-sheet-description">
							Evidencia do workspace para entender o impacto antes de agir.
						</SheetDescription>
					</div>
					<SheetClose aria-label="Fechar detalhes do sinal" onClick={() => onOpenChange(false)}>
						<Icon name="x" size={16} />
					</SheetClose>
				</SheetHeader>
				<div className="grid gap-[var(--layout-panel-gap)] overflow-y-auto p-[var(--card-padding)]">
					<Card>
						<CardHeader>
							<div className="ds-cluster">
								<Icon name="shield" size={16} />
								<h3 className="font-semibold">Leitura de supervisao</h3>
							</div>
						</CardHeader>
						<CardContent>
							<MetadataRow
								items={[
									{ label: "Impacto", value: signal.impact ?? "pede investigacao", icon: <Icon name="alert-triangle" size={14} /> },
									{ label: "Acao segura", value: signal.nextAction ?? "investigar", icon: <Icon name="activity" size={14} /> },
									{ label: "Detectado em", value: formatEvidenceDate(signal.detectedAt), icon: <Icon name="clock" size={14} /> },
								]}
							/>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<div className="ds-cluster">
								<Icon name="file-text" size={16} />
								<h3 className="font-semibold">Evidencia</h3>
							</div>
						</CardHeader>
						<CardContent>
							<List tone="surface">
								<ListItem
									leading={<Icon name="alert-circle" size={18} />}
									title={signal.title}
									description="Sinal ativo registrado no prontuario de saude do workspace."
									meta={
										<>
											<Tag variant="info">{signal.source}</Tag>
											<Tag>{signal.id}</Tag>
										</>
									}
									tone={signal.severity === "alta" ? "danger" : signal.severity === "baixa" ? "info" : "warning"}
								/>
							</List>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<div className="ds-cluster">
								<Icon name="git-branch" size={16} />
								<h3 className="font-semibold">Comparacao de drift</h3>
							</div>
						</CardHeader>
						<CardContent>
							{signal.relatedSnapshot ? (
								<div className="grid gap-[var(--space-4)]">
									<MetadataRow
										items={[
											{ label: "Snapshot", value: signal.relatedSnapshot.id, icon: <Icon name="info" size={14} /> },
											{ label: "Registrado em", value: formatEvidenceDate(signal.relatedSnapshot.timestamp), icon: <Icon name="clock" size={14} /> },
											{ label: "Arquivos", value: signal.relatedSnapshot.files.length, icon: <Icon name="file-text" size={14} /> },
										]}
									/>
									<List tone="surface">
										{signal.relatedSnapshot.files.map((file) => (
											<ListItem
												key={file.path}
												leading={<Icon name="file-text" size={18} />}
												title={file.path}
												description="Arquivo capturado no snapshot do diagnostico."
												meta={<Tag variant="info">before/after</Tag>}
											/>
										))}
									</List>
									{diffFile ? (
										<pre className="max-h-72 max-w-full overflow-auto rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-sunken)] p-[var(--space-3)] text-xs leading-relaxed text-[var(--color-text-primary)]">
											{diffPreview.join("\n")}
										</pre>
									) : null}
								</div>
							) : (
								<List tone="surface">
									<ListItem
										leading={<Icon name="info" size={18} />}
										title="Nenhum snapshot relacionado encontrado."
										description="Este sinal nao possui comparacao before/after disponivel; a evidencia atual vem do health-record."
										meta={<Tag>fallback honesto</Tag>}
										tone="info"
									/>
								</List>
							)}
						</CardContent>
					</Card>

					<Collapsible>
						<Card>
							<CardHeader className="flex flex-wrap items-center justify-between">
								<div className="ds-cluster">
									<Icon name="code" size={16} />
									<h3 className="font-semibold">Origem tecnica</h3>
								</div>
								<CollapsibleTrigger className="rounded-[var(--radius-md)] px-[var(--space-3)] py-[var(--space-2)] text-body-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--surface-hover)]">
									Mostrar dados
								</CollapsibleTrigger>
							</CardHeader>
							<CollapsibleContent>
								<CardContent>
									<MetadataRow
										items={[
											{ label: "ID", value: signal.id, icon: <Icon name="info" size={14} /> },
											{ label: "Origem", value: signal.source, icon: <Icon name="file-text" size={14} /> },
											{ label: "Tipo", value: signal.technicalType ?? "nao informado", icon: <Icon name="code" size={14} /> },
											{ label: "Urgencia", value: signal.severity, icon: <Icon name="alert-triangle" size={14} /> },
										]}
									/>
								</CardContent>
							</CollapsibleContent>
						</Card>
					</Collapsible>
				</div>
				<SheetFooter className="grid gap-[var(--space-2)] sm:flex sm:flex-wrap sm:justify-between">
					{actionMessage ? (
						<p className="min-w-0 break-words text-caption text-[var(--color-text-secondary)] sm:mr-auto">
							{actionMessage}
						</p>
					) : null}
					<Button className="w-full sm:w-auto" variant="secondary" onClick={onScan} disabled={actionBusy}>
						<Icon name={actionBusy ? "loader-circle" : "activity"} size={14} />
						Verificar agora
					</Button>
					<Button className="w-full sm:w-auto" variant="secondary" onClick={() => onAcknowledge(signal)} disabled={actionBusy || signal.status === "ciente"}>
						<Icon name="clock" size={14} />
						Acompanhar
					</Button>
					<Button className="w-full sm:w-auto" variant="secondary" onClick={() => onDismiss(signal)} disabled={actionBusy}>
						<Icon name="circle-x" size={14} />
						Descartar
					</Button>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}

export default function HomeView({ workflow, activeFlow, onTabChange }: Props) {
	const [focus, setFocus] = useState<FocusData | null>(null);
	const [signals, setSignals] = useState<AttentionSignal[]>([]);
	const [healthSummary, setHealthSummary] = useState<HealthSummaryView | null>(null);
	const [signalsAvailable, setSignalsAvailable] = useState(true);
	const [diagnosticSnapshots, setDiagnosticSnapshots] = useState<DiagnosticSnapshot[]>([]);
	const [activity, setActivity] = useState<ActivityEvent[]>([]);
	const [activityAvailable, setActivityAvailable] = useState(true);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(false);
	const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
	const [selectedSignal, setSelectedSignal] = useState<AttentionSignal | null>(null);
	const [healthBusy, setHealthBusy] = useState(false);
	const [healthActionMessage, setHealthActionMessage] = useState("");

	const applyHealth = useCallback((health: HealthResponse, snapshots: DiagnosticSnapshot[] = []) => {
		const nextSignals = mapHealthSignals(health, snapshots);
		setHealthSummary(summarizeHealth(health));
		setSignals(nextSignals);
		setSignalsAvailable(true);
		setSelectedSignal((current) => {
			if (!current) return current;
			return nextSignals.find((signal) => signal.id === current.id) ?? null;
		});
		return nextSignals;
	}, []);

	const refreshHealthSignals = useCallback(async () => {
		const [healthResponse, snapshotsResponse] = await Promise.all([
			fetch("/api/health"),
			fetch("/api/diagnostics/snapshots?limit=20"),
		]);
		if (!healthResponse.ok) throw new Error("health unavailable");
		const health = (await healthResponse.json()) as HealthResponse;
		const snapshots = snapshotsResponse.ok
			? normalizeSnapshots((await snapshotsResponse.json()) as DiagnosticSnapshotsResponse)
			: diagnosticSnapshots;
		setDiagnosticSnapshots(snapshots);
		return applyHealth(health, snapshots);
	}, [applyHealth]);

	useEffect(() => {
		let cancelled = false;

		async function load() {
			setLoading(true);
			setError(false);

			const [focusResult, healthResult, snapshotsResult, logResult] = await Promise.allSettled([
				fetch("/api/focus").then((response) => response.json()),
				fetch("/api/health").then((response) => response.json()),
				fetch("/api/diagnostics/snapshots?limit=20").then((response) => response.json()),
				fetch("/api/log?limit=4").then((response) => response.json()),
			]);

			if (cancelled) return;

			if (focusResult.status === "fulfilled") {
				setFocus(focusResult.value);
			}

			const snapshots =
				snapshotsResult.status === "fulfilled"
					? normalizeSnapshots(snapshotsResult.value as DiagnosticSnapshotsResponse)
					: [];
			setDiagnosticSnapshots(snapshots);

			if (healthResult.status === "fulfilled") {
				const health = healthResult.value as HealthResponse;
				applyHealth(health, snapshots);
			} else {
				setSignals([]);
				setHealthSummary(null);
				setSignalsAvailable(false);
			}

			if (logResult.status === "fulfilled") {
				const logs = logResult.value as LogResponse;
				setActivity(
					(logs.entries ?? []).slice(0, 4).map((entry) => ({
						id: entry.id,
						action: entry.action,
						description: entry.description,
						timestamp: entry.timestamp,
						itemId: entry.itemId ?? null,
					})),
				);
				setActivityAvailable(true);
			} else {
				setActivity([]);
				setActivityAvailable(false);
			}

			if (focusResult.status === "rejected" && healthResult.status === "rejected" && logResult.status === "rejected") {
				setError(true);
			}

			setLoading(false);
		}

		load();
		return () => {
			cancelled = true;
		};
	}, [applyHealth]);

	const stages = useMemo(() => orderedStages(workflow, activeFlow), [activeFlow, workflow]);

	const decisions = useMemo<PendingDecision[]>(() => {
		const gateStages = humanGateStageIds(workflow, activeFlow);

		return workflow.items
			.filter((item) => gateStages.has(item.stage))
			.map((item) => ({
				itemId: item.id,
				title: item.description || item.id,
				stage:
					stages.find((stage) => stage.id === item.stage)?.name ?? item.stage,
				actor: stageAgentLabel(item.stage, workflow, activeFlow),
				since: formatSince(item.createdAt),
			}));
	}, [activeFlow, stages, workflow]);

	const selectedItem = selectedItemId
		? workflow.items.find((item) => item.id === selectedItemId) ?? null
		: null;
	const selectedStageName = selectedItem
		? stages.find((stage) => stage.id === selectedItem.stage)?.name ?? null
		: null;
	const primaryItemId = focus?.itemId ?? workflow.primaryItemId ?? workflow.items[0]?.id;
	const primaryItem = primaryItemId
		? workflow.items.find((item) => item.id === primaryItemId)
		: undefined;
	const primaryStageName = primaryItem
		? stages.find((stage) => stage.id === primaryItem.stage)?.name ?? primaryItem.stage
		: undefined;
	const primaryWork: FocusedWork | undefined = primaryItem
		? {
				id: primaryItem.id,
				title: primaryItem.description || primaryItem.id,
				description:
					"Resumo operacional do item que está no centro da supervisão agora.",
				stage: primaryStageName,
				spec: primaryItem.spec ?? focus?.spec,
				ageLabel: formatAgeLabel(primaryItem.createdAt),
				actor: primaryItem.claimedBy ?? stageAgentLabel(primaryItem.stage, workflow, activeFlow),
			}
		: undefined;

	function openItem(itemId: string) {
		setSelectedItemId(itemId);
		window.dispatchEvent(new CustomEvent("letra-open-item", { detail: itemId }));
	}

	async function postHealthAction(
		path: "/api/health/scan" | "/api/health/ack" | "/api/health/dismiss",
		body?: Record<string, string>,
	) {
		setHealthBusy(true);
		setHealthActionMessage("Atualizando saude do workspace...");
		try {
			const response = await fetch(path, {
				method: "POST",
				headers: body ? { "Content-Type": "application/json" } : undefined,
				body: body ? JSON.stringify(body) : undefined,
			});
			if (!response.ok) throw new Error("health action failed");
			const nextSignals = await refreshHealthSignals();
			setHealthActionMessage("Saude do workspace atualizada.");
			return nextSignals;
		} catch {
			setHealthActionMessage("Nao foi possivel atualizar a saude agora.");
			return null;
		} finally {
			setHealthBusy(false);
		}
	}

	async function scanHealth() {
		await postHealthAction("/api/health/scan");
	}

	async function acknowledgeSignal(signal: AttentionSignal) {
		const nextSignals = await postHealthAction("/api/health/ack", { id: signal.id });
		if (nextSignals) {
			setSelectedSignal(nextSignals.find((entry) => entry.id === signal.id) ?? null);
		}
	}

	async function dismissSignal(signal: AttentionSignal) {
		const nextSignals = await postHealthAction("/api/health/dismiss", { id: signal.id });
		if (nextSignals) {
			setSelectedSignal(null);
		}
	}

	if (loading) {
		return <DashboardSkeleton />;
	}

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<div className="flex-1 overflow-y-auto">
				<div className="flex w-full min-w-0 flex-col gap-[var(--layout-page-gap)] p-[var(--layout-page-padding)]">
					{error ? (
						<ErrorBanner onRetry={() => window.location.reload()}>
							Não foi possível carregar a supervisão agora.
						</ErrorBanner>
					) : null}

					<SupervisionInbox
						decisions={decisions}
						signals={signals}
						healthSummary={healthSummary ?? undefined}
						activity={activity}
						signalsAvailable={signalsAvailable}
						activityAvailable={activityAvailable}
						primaryItemId={primaryItemId}
						primaryWork={primaryWork}
						onReviewDecision={openItem}
						onOpenItem={openItem}
						onOpenActivity={() => onTabChange?.("activity")}
						onOpenWork={() => onTabChange?.("work")}
						onOpenSignal={setSelectedSignal}
						onScanHealth={scanHealth}
						healthBusy={healthBusy}
					/>

					{focus?.active && focus.spec ? (
						<GovernanceSummary
							spec={focus.spec}
							primaryItem={primaryItem}
							primaryStageName={primaryStageName}
						/>
					) : null}

				</div>
			</div>

			<ItemSheet
				item={selectedItem}
				stageName={selectedStageName}
				open={!!selectedItem}
				onOpenChange={(open) => {
					if (!open) setSelectedItemId(null);
				}}
			/>
			<SignalSheet
				signal={selectedSignal}
				open={!!selectedSignal}
				onOpenChange={(open) => {
					if (!open) setSelectedSignal(null);
				}}
				onAcknowledge={acknowledgeSignal}
				onDismiss={dismissSignal}
				onScan={scanHealth}
				actionBusy={healthBusy}
				actionMessage={healthActionMessage}
			/>
		</div>
	);
}
