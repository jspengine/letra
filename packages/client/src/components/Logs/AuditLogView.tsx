import { useState, useEffect, useCallback, useMemo } from "react";
import { ActivityTimeline, Badge, Button, ButtonGroup, ButtonGroupItem, Card, CardContent, CardHeader, Collapsible, CollapsibleContent, CollapsibleTrigger, DateField, Icon, Input, List, ListItem, MetadataRow, Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, Tag, TimelineItem } from "@letra/ui";
import type { IconName } from "@letra/ui";
import { translateSubjectType } from "../../lib/term-translations";
import { translateAction } from "../../lib/action-labels";

type EventKind = "flow" | "execution" | "human" | "system";
type EventStatus = "started" | "succeeded" | "failed" | "blocked" | "requested" | "info";

interface OperationalAuditEvent {
	id: string;
	timestamp: string;
	kind: EventKind;
	action: string;
	status: EventStatus;
	actor: { type: "human" | "agent" | "system"; id?: string; label: string };
	source: { surface: string; command?: string };
	subject?: { type: string; id: string; label?: string };
	summary: string;
	reason?: string;
	correlationId?: string;
	details: Record<string, unknown>;
	legacy?: Record<string, unknown>;
}

interface AuditFacets {
	kinds: Record<string, number>;
	statuses: Record<string, number>;
	sources: Record<string, number>;
	actions: Record<string, number>;
}

interface AuditResponse {
	items: OperationalAuditEvent[];
	total: number;
	page: number;
	limit: number;
	facets: AuditFacets;
}

interface GroupedEvent {
	date: string;
	label: string;
	groups: EventGroup[];
}

interface EventGroup {
	key: string;
	events: OperationalAuditEvent[];
	collapsed: boolean;
	isNoise: boolean;
}

const DATE_GROUPS = [
	{ label: "Hoje", days: 0 },
	{ label: "Ontem", days: 1 },
	{ label: "Esta semana", days: 7 },
	{ label: "Este mês", days: 30 },
] as const;

	const KIND_FILTERS = [
		{ label: "Todos", value: "" },
		{ label: "Humano", value: "human" },
		{ label: "Agente", value: "flow" },
		{ label: "Sistema", value: "system" },
		{ label: "Execução", value: "execution" },
	] as const;

function getDateGroup(ts: string): { label: string; order: number } {
	const d = new Date(ts);
	const now = new Date();
	const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
	if (diff === 0) return { label: "Hoje", order: 0 };
	if (diff === 1) return { label: "Ontem", order: 1 };
	if (diff <= 7) return { label: "Esta semana", order: 2 };
	if (diff <= 30) return { label: "Este mês", order: 3 };
	return { label: "Mais antigo", order: 4 };
}

function formatTime(iso: string) {
	try {
		const d = new Date(iso);
		return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
	} catch {
		return iso;
	}
}

function fullTime(iso: string) {
	try {
		const d = new Date(iso);
		return d.toLocaleString("pt-BR", {
			day: "2-digit", month: "2-digit", year: "numeric",
			hour: "2-digit", minute: "2-digit", second: "2-digit",
		});
	} catch {
		return iso;
	}
}

function noiseKey(e: OperationalAuditEvent): string | null {
	if (e.kind !== "system") return null;
	const actionId = e.correlationId || (e.details?.actionId as string);
	if (!actionId) return null;
	return `${actionId}:${e.details?.outcome || "unknown"}`;
}

function statusVariant(status: EventStatus): "success" | "amber" | "info" {
	if (status === "succeeded") return "success";
	if (status === "failed" || status === "blocked") return "amber";
	return "info";
}

function timelineStatus(e: OperationalAuditEvent): "default" | "success" | "error" | "info" | "agent" {
	if (e.status === "failed" || e.status === "blocked") return "error";
	if (e.status === "succeeded") return "success";
	if (e.kind === "system") return "info";
	if (e.kind === "human") return "default";
	return "agent";
}

function timelineIcon(e: OperationalAuditEvent): IconName {
	if (e.status === "failed" || e.status === "blocked") return "circle-x";
	if (e.status === "succeeded") return "circle-check";
	if (e.kind === "system") return "activity";
	if (e.kind === "human") return "user";
	return "bot";
}

function detailText(e: OperationalAuditEvent, key: string): string | null {
	const value = e.details?.[key];
	return typeof value === "string" && value.trim() ? value.trim() : null;
}

function subjectLabel(type: string): string {
	return translateSubjectType(type);
}

function evidenceRefs(e: OperationalAuditEvent): { label: string; value: string; tone: "info" }[] {
	const refs: { label: string; value: string; tone: "info" }[] = [];
	if (e.subject) refs.push({ label: subjectLabel(e.subject.type), value: e.subject.id, tone: "info" });
	const decisionFile = detailText(e, "decisionFile");
	if (decisionFile) refs.push({ label: "Decisão", value: decisionFile, tone: "info" });
	const path = detailText(e, "path");
	if (path) refs.push({ label: "Arquivo", value: path, tone: "info" });
	return refs;
}

function investigationSummary(e: OperationalAuditEvent) {
	const path = detailText(e, "path") ?? detailText(e, "decisionFile");
	return {
		who: e.actor.label,
		what: e.summary || e.action,
		where: e.subject?.id || path || detailText(e, "source") || "Workspace",
		result: detailText(e, "outcome") || (e.details?.effect as string) || "Registrado como evidência",
		why: e.reason || detailText(e, "trigger") || null,
		evidence: evidenceRefs(e),
	};
}

export default function AuditLogView() {
	const [logs, setLogs] = useState<OperationalAuditEvent[]>([]);
	const [facets, setFacets] = useState<AuditFacets>({ kinds: {}, statuses: {}, sources: {}, actions: {} });
	const [total, setTotal] = useState(0);
	const [page, setPage] = useState(1);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [search, setSearch] = useState("");
	const [debouncedSearch, setDebouncedSearch] = useState("");
	const [filterAction, setFilterAction] = useState("");
	const [filterKind, setFilterKind] = useState("");
	const [filterSince, setFilterSince] = useState("");
	const [includeTechnicalEvents, setIncludeTechnicalEvents] = useState(false);
	const [selectedEvent, setSelectedEvent] = useState<OperationalAuditEvent | null>(null);
	const [technicalDetailsOpen, setTechnicalDetailsOpen] = useState(false);
	const [expandedNoise, setExpandedNoise] = useState<Set<string>>(new Set());
	const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set(["Hoje", "Ontem"]));
	const limit = 50;

	useEffect(() => {
		const t = setTimeout(() => setDebouncedSearch(search), 300);
		return () => clearTimeout(t);
	}, [search]);

	const fetchLogs = useCallback(async (p: number) => {
		setLoading(true);
		setError(null);
		try {
			const params = new URLSearchParams();
			if (debouncedSearch) params.set("q", debouncedSearch);
			if (filterAction) params.set("action", filterAction);
			if (filterSince) params.set("since", filterSince);
			if (includeTechnicalEvents) params.set("debug", "true");
			params.set("page", String(p));
			params.set("limit", String(limit));

			const res = await fetch(`/api/log?${params}`);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const data: AuditResponse = await res.json();
			setLogs(data.items || []);
			setFacets(data.facets || { kinds: {}, statuses: {}, sources: {}, actions: {} });
			setTotal(data.total || 0);
			setPage(data.page || 1);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Falha ao carregar log");
			setLogs([]);
			setTotal(0);
		} finally {
			setLoading(false);
		}
	}, [debouncedSearch, filterAction, filterSince, includeTechnicalEvents]);

	useEffect(() => {
		setPage(1);
	}, [debouncedSearch, filterAction, filterKind, filterSince, includeTechnicalEvents]);

	useEffect(() => {
		fetchLogs(page);
	}, [fetchLogs, page]);

	useEffect(() => {
		setTechnicalDetailsOpen(false);
	}, [selectedEvent?.id]);

	const noised = useMemo(() => {
		const filtered = filterKind ? logs.filter((e) => e.kind === filterKind) : logs;
		const result: OperationalAuditEvent[] = [];
		let i = 0;
		while (i < filtered.length) {
			const key = noiseKey(filtered[i]);
			if (key) {
				const group: OperationalAuditEvent[] = [filtered[i]];
				let j = i + 1;
				while (j < filtered.length && noiseKey(filtered[j]) === key) {
					group.push(filtered[j]);
					j++;
				}
				if (group.length > 1) {
					const isExpanded = expandedNoise.has(key);
					if (isExpanded) {
						result.push(...group);
					} else {
						result.push({ ...group[0], _noiseCount: group.length, _noiseKey: key } as OperationalAuditEvent & { _noiseCount: number; _noiseKey: string });
					}
				} else {
					result.push(group[0]);
				}
				i = j;
			} else {
				result.push(filtered[i]);
				i++;
			}
		}
		return result;
	}, [logs, filterKind, expandedNoise]);

	const grouped = useMemo(() => {
		const groups = new Map<string, OperationalAuditEvent[]>();
		for (const entry of noised) {
			const { label } = getDateGroup(entry.timestamp);
			const list = groups.get(label) || [];
			list.push(entry);
			groups.set(label, list);
		}
		const orderMap: Record<string, number> = { "Hoje": 0, "Ontem": 1, "Esta semana": 2, "Este mês": 3 };
		return Array.from(groups.entries())
			.map(([label, entries]) => ({
				label,
				entries,
				order: orderMap[label] ?? 4,
			}))
			.sort((a, b) => a.order - b.order);
	}, [noised]);

	const metrics = useMemo(() => {
		const totalEvents = logs.length;
		const systemEvents = logs.filter((e) => e.kind === "system").length;
		const humanEvents = logs.filter((e) => e.kind === "human").length;
		const agentEvents = logs.filter((e) => e.kind === "execution" || e.kind === "flow").length;
		const todayEvents = logs.filter((e) => getDateGroup(e.timestamp).label === "Hoje").length;
		const succeededEvents = logs.filter((e) => e.status === "succeeded").length;
		const failedEvents = logs.filter((e) => e.status === "failed").length;
		return { totalEvents, systemEvents, humanEvents, agentEvents, todayEvents, succeededEvents, failedEvents };
	}, [logs]);

	const totalPages = Math.ceil(total / limit);
	const selectedSummary = selectedEvent ? investigationSummary(selectedEvent) : null;

	function toggleNoise(key: string) {
		setExpandedNoise((prev) => {
			const next = new Set(prev);
			if (next.has(key)) next.delete(key);
			else next.add(key);
			return next;
		});
	}

	function toggleDateGroup(label: string) {
		setExpandedDates((prev) => {
			const next = new Set(prev);
			if (next.has(label)) next.delete(label);
			else next.add(label);
			return next;
		});
	}

	if (error) {
		return (
			<div className="app-section-shell items-center justify-center gap-3 p-12">
				<Icon name="alert-circle" size={24} style={{ color: "var(--color-danger)" }} />
				<p className="app-section-muted text-sm">{error}</p>
				<Button variant="secondary" size="sm" onClick={() => fetchLogs(1)}>
					<Icon name="check" size={12} />
					Tentar novamente
				</Button>
			</div>
		);
	}

	return (
		<div className="app-section-shell">
			{/* Investigation Sheet */}
			<Sheet open={!!selectedEvent} onOpenChange={(open: boolean) => { if (!open) setSelectedEvent(null); }}>
				<SheetContent side="right" className="w-full sm:max-w-3xl lg:max-w-4xl">
					{selectedEvent && (
						<>
						<SheetHeader className="items-start gap-4">
								<div className="min-w-0 flex-1">
									<div className="mb-3 flex flex-wrap items-center gap-2">
										<Badge variant={statusVariant(selectedEvent.status)} tone="soft" className="text-caption uppercase">
											{translateAction(selectedEvent.action)}
										</Badge>
										<Badge variant={selectedEvent.kind === "human" ? "info" : selectedEvent.kind === "system" ? "info" : "agent"} tone="soft">
											{selectedEvent.actor.label}
										</Badge>
										{selectedEvent.status === "failed" || selectedEvent.status === "blocked" ? (
											<Badge variant="amber" tone="soft">{selectedEvent.status}</Badge>
										) : null}
									</div>
									<SheetTitle className="leading-tight">Evidência da atividade</SheetTitle>
									<SheetDescription className="mt-1">
										{selectedSummary ? `${selectedSummary.what} · ${fullTime(selectedEvent.timestamp)}` : fullTime(selectedEvent.timestamp)}
									</SheetDescription>
								</div>
								<SheetClose aria-label="Fechar detalhes da atividade" onClick={() => setSelectedEvent(null)}>
									<Icon name="x" size={16} />
								</SheetClose>
							</SheetHeader>
							<div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
								{selectedSummary && (
									<Card>
										<CardHeader>
											<div className="grid gap-1">
												<h3 className="text-body font-semibold">Resumo investigativo</h3>
												<p className="text-body-sm leading-relaxed text-[var(--color-text-secondary)]">
													{selectedSummary.who} registrou <strong className="text-[var(--color-text-primary)]">{selectedSummary.what}</strong> em <strong className="text-[var(--color-text-primary)]">{selectedSummary.where}</strong>. Resultado: {String(selectedSummary.result)}.
												</p>
											</div>
										</CardHeader>
										<CardContent>
											<MetadataRow
												items={[
													{ label: "Ator", value: `${selectedEvent.actor.label} (${selectedEvent.actor.type})`, icon: <Icon name="user" size={14} /> },
													{ label: "Quando", value: fullTime(selectedEvent.timestamp), icon: <Icon name="clock" size={14} /> },
													{ label: "Onde", value: selectedEvent.subject?.id || selectedSummary.where, icon: <Icon name="box" size={14} /> },
													{ label: "Resultado", value: selectedEvent.status, icon: <Icon name="check-circle" size={14} /> },
												]}
											/>
											{selectedSummary.why ? (
												<div className="grid gap-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg-sunken)] p-3">
													<h4 className="text-caption font-semibold uppercase text-[var(--color-text-tertiary)]">Por quê</h4>
													<p className="text-body-sm text-[var(--color-text-primary)]">{String(selectedSummary.why)}</p>
												</div>
											) : null}
										</CardContent>
									</Card>
								)}

							{selectedSummary && selectedSummary.evidence.length > 0 ? (
									<Card>
										<CardHeader>
											<div className="grid gap-1">
												<h3 className="text-body font-semibold">Evidências relacionadas</h3>
												<p className="text-body-sm text-[var(--color-text-secondary)]">Referências que sustentam este registro.</p>
											</div>
										</CardHeader>
										<CardContent>
											<List>
												{selectedSummary.evidence.map((ref) => (
													<ListItem
														key={`${ref.label}-${ref.value}`}
														leading={<Icon name={ref.label === "Item" ? "box" : ref.label === "Spec" ? "specs" : "activity"} size={16} />}
														title={ref.value}
														meta={<Badge variant={ref.tone} tone="soft">{ref.label}</Badge>}
														action={ref.label === "Item" ? (
															<Button variant="secondary" size="sm" onClick={() => window.dispatchEvent(new CustomEvent("letra-open-item", { detail: ref.value }))}>
																Abrir
															</Button>
														) : ref.label === "Spec" ? (
															<Button variant="secondary" size="sm" onClick={() => window.dispatchEvent(new CustomEvent("letra-open-spec", { detail: ref.value }))}>
																Abrir
															</Button>
														) : null}
													/>
												))}
											</List>
										</CardContent>
									</Card>
								) : null}

							<Card>
									<CardHeader>
										<div className="grid gap-1">
											<h3 className="text-body font-semibold">Registro original</h3>
											<p className="text-body-sm text-[var(--color-text-secondary)]">Mensagem capturada na trilha de atividade.</p>
										</div>
									</CardHeader>
									<CardContent className="grid gap-3">
										<p className="text-body-sm leading-relaxed text-[var(--color-text-primary)]">{selectedEvent.summary}</p>
										<div className="flex flex-wrap gap-2">
											{selectedEvent.correlationId ? <Tag>{selectedEvent.correlationId}</Tag> : null}
											{selectedEvent.subject ? <Tag>{subjectLabel(selectedEvent.subject.type)}: {selectedEvent.subject.id}</Tag> : null}
											<Tag>{selectedEvent.id}</Tag>
										</div>
									</CardContent>
								</Card>

								{selectedEvent.details ? (
									<Card>
										<Collapsible open={technicalDetailsOpen} onOpenChange={setTechnicalDetailsOpen}>
											<CollapsibleTrigger className="flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-[var(--color-bg-sunken)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring-color)]">
												<div className="grid gap-1">
													<span className="text-body font-semibold text-[var(--color-text-primary)]">Detalhes técnicos</span>
													<span className="text-body-sm text-[var(--color-text-secondary)]">JSON bruto para auditoria e depuração.</span>
												</div>
												<Icon name={technicalDetailsOpen ? "chevron-up" : "chevron-down"} size={16} />
											</CollapsibleTrigger>
											<CollapsibleContent>
												<CardContent className="border-t border-[var(--color-border)] pt-4">
													<pre className="max-h-80 overflow-auto rounded-[var(--radius-sm)] bg-[var(--color-bg-base)] p-4 text-caption text-[var(--color-text-secondary)]">
														{JSON.stringify(selectedEvent.details, null, 2)}
													</pre>
												</CardContent>
											</CollapsibleContent>
										</Collapsible>
									</Card>
								) : null}
							</div>
						</>
					)}
				</SheetContent>
			</Sheet>

			{/* Main content */}
			<div className="flex-1 overflow-y-auto">
				<div className="p-6">
					<Card className="mb-6">
						<CardHeader className="flex flex-wrap items-start justify-between gap-4">
							<div className="min-w-0">
								<div className="mb-2 flex items-center gap-2">
									<Icon name="activity" size={18} />
									<Badge variant="info" className="text-caption">trilha investigativa</Badge>
								</div>
								<h1 className="text-xl font-bold">Atividade</h1>
								<p className="app-section-muted mt-1 max-w-3xl text-sm" style={{ color: undefined }}>
									Origem, resultado e evidências do workspace em uma linha do tempo auditável.
								</p>
							</div>
						<div className="grid grid-cols-3 gap-2 text-right">
								<div>
									<p className="text-lg font-bold">{metrics.succeededEvents}</p>
									<p className="text-caption" style={{ color: "var(--color-text-secondary)" }}>sucesso</p>
								</div>
								<div>
									<p className="text-lg font-bold" style={{ color: "var(--color-primary)" }}>{metrics.failedEvents}</p>
									<p className="text-caption" style={{ color: "var(--color-text-secondary)" }}>falhas</p>
								</div>
								<div>
									<p className="text-lg font-bold">{metrics.todayEvents}</p>
									<p className="text-caption" style={{ color: "var(--color-text-secondary)" }}>hoje</p>
								</div>
							</div>
						</CardHeader>
						<CardContent>
							<div className="grid gap-4 md:grid-cols-4">
								<div className="min-w-0 border-l pl-3" style={{ borderColor: "var(--color-border)" }}>
									<p className="text-xs font-semibold uppercase" style={{ color: "var(--color-text-secondary)" }}>Origem</p>
									<p className="mt-1 text-sm">quem ou qual automação registrou</p>
								</div>
								<div className="min-w-0 border-l pl-3" style={{ borderColor: "var(--color-border)" }}>
									<p className="text-xs font-semibold uppercase" style={{ color: "var(--color-text-secondary)" }}>Evento</p>
									<p className="mt-1 text-sm">o que mudou no trabalho</p>
								</div>
								<div className="min-w-0 border-l pl-3" style={{ borderColor: "var(--color-border)" }}>
									<p className="text-xs font-semibold uppercase" style={{ color: "var(--color-text-secondary)" }}>Evidência</p>
									<p className="mt-1 text-sm">item, AC, decisão ou arquivo</p>
								</div>
								<div className="min-w-0 border-l pl-3" style={{ borderColor: "var(--color-border)" }}>
									<p className="text-xs font-semibold uppercase" style={{ color: "var(--color-text-secondary)" }}>Resultado</p>
									<p className="mt-1 text-sm">efeito observável antes de agir</p>
								</div>
							</div>
						</CardContent>
					</Card>

					{includeTechnicalEvents ? (
						<Card className="mb-6 border-[var(--color-border-warning)]">
							<CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
								<div className="flex min-w-0 items-center gap-3">
									<Icon name="activity" size={18} className="text-[var(--color-warning)]" />
									<div className="min-w-0">
										<p className="text-body-sm font-semibold text-[var(--color-text-primary)]">Eventos técnicos incluídos</p>
										<p className="text-caption text-[var(--color-text-secondary)]">{metrics.systemEvents} automaçõ{metrics.systemEvents !== 1 ? "es" : "o"} nesta consulta</p>
									</div>
								</div>
								<Button variant="secondary" size="sm" onClick={() => setIncludeTechnicalEvents(false)}>
									Ocultar
								</Button>
							</CardContent>
						</Card>
					) : null}

					{/* Metric cards */}
					<div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
						<Card>
							<CardContent className="p-4">
								<p className="text-2xl font-bold">{metrics.totalEvents}</p>
								<p className="text-xs" style={{ color: "var(--color-text-secondary)" }}>Total</p>
							</CardContent>
						</Card>
						<Card>
							<CardContent className="p-4">
								<p className="text-2xl font-bold" style={{ color: "var(--color-text-secondary)" }}>{metrics.systemEvents}</p>
								<p className="text-xs" style={{ color: "var(--color-text-secondary)" }}>Sistema</p>
							</CardContent>
						</Card>
						<Card>
							<CardContent className="p-4">
								<p className="text-2xl font-bold" style={{ color: "var(--color-primary)" }}>{metrics.humanEvents}</p>
								<p className="text-xs" style={{ color: "var(--color-text-secondary)" }}>Humano</p>
							</CardContent>
						</Card>
						<Card>
							<CardContent className="p-4">
								<p className="text-2xl font-bold" style={{ color: "var(--color-success)" }}>{metrics.agentEvents}</p>
								<p className="text-xs" style={{ color: "var(--color-text-secondary)" }}>Agente</p>
							</CardContent>
						</Card>
					</div>

					{/* Filters */}
					<Card className="mb-6">
						<CardContent className="grid gap-4 p-4">
							<div className="flex flex-col gap-3 lg:flex-row lg:items-end">
								<div className="min-w-0 flex-1">
									<label className="mb-1.5 block text-caption font-semibold uppercase text-[var(--color-text-tertiary)]" htmlFor="activity-search">
										Buscar
									</label>
									<Input
										id="activity-search"
										placeholder="Buscar atividade e evidências..."
										value={search}
										onChange={(e) => setSearch(e.target.value)}
										aria-label="Buscar atividade"
									/>
								</div>
								<div className="min-w-0">
									<p className="mb-1.5 text-caption font-semibold uppercase text-[var(--color-text-tertiary)]">
										Ator
									</p>
									<ButtonGroup ariaLabel="Filtrar atividade por ator" className="w-full sm:w-auto">
										{KIND_FILTERS.map((filter) => (
											<ButtonGroupItem
												key={filter.label}
												selected={filterKind === filter.value}
												onClick={() => setFilterKind(filter.value)}
											>
												{filter.label}
											</ButtonGroupItem>
										))}
									</ButtonGroup>
								</div>
								<div className="w-full min-w-0 sm:w-[220px]">
									<DateField
										id="activity-since"
										label="Desde"
										value={filterSince}
										onChange={(e) => setFilterSince(e.target.value)}
									/>
								</div>
								<div className="flex flex-wrap gap-2 lg:pb-0.5">
									<Button variant="secondary" size="sm" onClick={() => fetchLogs(page)}>
										<Icon name="check" size={14} />
										Atualizar
									</Button>
									{(search || filterKind || filterSince) && (
										<Button variant="ghost" size="sm" onClick={() => { setSearch(""); setDebouncedSearch(""); setFilterKind(""); setFilterSince(""); }}>
											Limpar
										</Button>
									)}
								</div>
							</div>
						</CardContent>
					</Card>

					{/* Timeline */}
					{loading ? (
						<div className="flex items-center justify-center py-16">
							<p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>Carregando...</p>
						</div>
					) : logs.length === 0 ? (
						<div className="flex flex-col items-center gap-2 py-16">
							<Icon name="search" size={24} style={{ color: "var(--color-text-secondary)" }} />
							<p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
								Nenhuma atividade encontrada
							</p>
						</div>
					) : (
						<div className="space-y-6">
							{grouped.map((group) => {
								const isOpen = expandedDates.has(group.label);
								return (
									<section key={group.label} role="region" aria-label={`${group.label} — ${group.entries.length} atividades`}>
										<Button
											type="button"
											variant="ghost"
											onClick={() => toggleDateGroup(group.label)}
											aria-expanded={isOpen}
											aria-label={`${group.label} — ${group.entries.length} atividades`}
											className="mb-3 h-auto justify-start gap-2 bg-transparent px-0 py-0 text-xs font-semibold uppercase hover:bg-transparent"
											style={{ color: "var(--color-text-secondary)" }}
										>
											<Icon name={isOpen ? "chevron-down" : "chevron-right"} size={12} />
											{group.label}
											<span className="font-normal normal-case ml-1">{group.entries.length} atividade{group.entries.length !== 1 ? "s" : ""}</span>
										</Button>
										{isOpen && (
											<ActivityTimeline className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4">
												{group.entries.map((entry, idx) => {
													const isNoiseGroup = (entry as OperationalAuditEvent & { _noiseCount?: number; _noiseKey?: string })._noiseCount !== undefined;
													const noiseCount = (entry as OperationalAuditEvent & { _noiseCount?: number })._noiseCount;
													const noiseKeyVal = (entry as OperationalAuditEvent & { _noiseKey?: string })._noiseKey;
													const isLast = idx === group.entries.length - 1;
													if (isNoiseGroup) {
														return (
															<TimelineItem
																key={`${entry.id}-${idx}`}
																status="info"
																icon={<Icon name={expandedNoise.has(noiseKeyVal || "") ? "chevron-down" : "chevron-right"} size={16} />}
																title={translateAction(entry.action)}
																description={`${noiseCount} atividades similares agrupadas para reduzir ruído operacional.`}
																timestamp={formatTime(entry.timestamp)}
																action={(
																	<div className="flex flex-wrap items-center gap-2">
																		<Badge variant="info" tone="soft">x{noiseCount}</Badge>
																		<Button variant="secondary" size="sm" onClick={() => noiseKeyVal && toggleNoise(noiseKeyVal)}>
																			{expandedNoise.has(noiseKeyVal || "") ? "Recolher" : "Expandir"}
																		</Button>
																	</div>
																)}
																last={isLast}
															/>
														);
													}
													return (
														<TimelineItem
															key={`${entry.id}-${idx}`}
															status={timelineStatus(entry)}
															icon={<Icon name={timelineIcon(entry)} size={16} />}
															title={entry.summary || entry.action}
															description={`${entry.actor.label} · ${entry.subject?.id || "workspace"}`}
															timestamp={formatTime(entry.timestamp)}
															action={(
																<div className="flex flex-wrap items-center gap-2">
																	<Badge variant={statusVariant(entry.status)} tone="soft" className="text-caption uppercase">
																		{translateAction(entry.action)}
																	</Badge>
																	<Badge variant={entry.kind === "human" ? "info" : entry.kind === "system" ? "info" : "agent"} tone="soft" className="text-[10px]">
																		{entry.actor.label}
																	</Badge>
																	{entry.subject ? <Tag variant="info">{subjectLabel(entry.subject.type)}: {entry.subject.id}</Tag> : null}
																	<Button variant="secondary" size="sm" onClick={() => setSelectedEvent(entry)}>
																		Detalhes
																	</Button>
																</div>
															)}
															last={isLast}
														/>
													);
												})}
											</ActivityTimeline>
										)}
									</section>
								);
							})}
						</div>
					)}

					{/* Pagination */}
					{total > 0 && (
						<div className="app-section-muted mt-6 flex items-center justify-between border-t pt-4 text-xs" style={{ borderColor: "var(--color-border)", color: undefined }}>
							<span>{total} atividade{total !== 1 ? "s" : ""} no total</span>
							<div className="flex items-center gap-2">
								<Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
									Anterior
								</Button>
								<span>Página {page} de {totalPages}</span>
								<Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
									Próxima
								</Button>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
