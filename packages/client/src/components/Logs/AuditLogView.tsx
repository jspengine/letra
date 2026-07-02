import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, Button, Icon, Input, Badge, Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@letra/ui";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetClose } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface LogEntry {
	id: string;
	timestamp: string;
	action: string;
	description: string;
	itemId?: string | null;
	acId?: string | null;
	details?: {
		systemAction?: boolean;
		actionId?: string;
		outcome?: string;
		trigger?: string;
		cadence?: string;
		cause?: string;
		effect?: string;
		error?: string | null;
		path?: string;
		[key: string]: unknown;
	};
}

interface LogResponse {
	entries: LogEntry[];
	total: number;
	page: number;
	limit: number;
}

interface GroupedEvent {
	date: string;
	label: string;
	groups: EventGroup[];
}

interface EventGroup {
	key: string;
	events: LogEntry[];
	collapsed: boolean;
	isNoise: boolean;
}

const DATE_GROUPS = [
	{ label: "Hoje", days: 0 },
	{ label: "Ontem", days: 1 },
	{ label: "Esta semana", days: 7 },
	{ label: "Este mês", days: 30 },
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

function isSystemEvent(e: LogEntry): boolean {
	return e.details?.systemAction === true || e.action === "system";
}

function noiseKey(e: LogEntry): string | null {
	if (!isSystemEvent(e)) return null;
	const d = e.details;
	if (!d?.actionId) return null;
	return `${d.actionId}:${d.outcome || "unknown"}`;
}

function actionVariant(action: string): "default" | "secondary" | "success" | "warning" {
	if (action.includes("move") || action.includes("approve") || action.includes("create")) return "success";
	if (action.includes("reject") || action.includes("fail") || action.includes("error")) return "warning";
	if (action === "system") return "secondary";
	return "default";
}

function actorLabel(e: LogEntry): string {
	if (isSystemEvent(e)) return "automation";
	if (e.details?.actionId) return e.details.actionId;
	return e.action;
}

function actorColor(e: LogEntry): string {
	if (isSystemEvent(e)) return "var(--muted-foreground)";
	return "var(--primary)";
}

function summaryFromDesc(desc: string): { who: string; what: string; where: string; result: string } {
	const parts = desc.split("|").map((s) => s.trim());
	const who = parts[0] || desc;
	const what = parts[1] || "";
	const where = parts[2] || "";
	const result = parts[3] || "";
	return { who, what, where, result };
}

export default function AuditLogView() {
	const [logs, setLogs] = useState<LogEntry[]>([]);
	const [total, setTotal] = useState(0);
	const [page, setPage] = useState(1);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [search, setSearch] = useState("");
	const [debouncedSearch, setDebouncedSearch] = useState("");
	const [filterAction, setFilterAction] = useState("");
	const [filterSince, setFilterSince] = useState("");
	const [selectedEvent, setSelectedEvent] = useState<LogEntry | null>(null);
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
			params.set("page", String(p));
			params.set("limit", String(limit));

			const res = await fetch(`/api/log?${params}`);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const data: LogResponse = await res.json();
			const list = data.entries || [];
			setLogs(list);
			setTotal(data.total || 0);
			setPage(data.page || 1);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Falha ao carregar log");
			setLogs([]);
			setTotal(0);
		} finally {
			setLoading(false);
		}
	}, [debouncedSearch, filterAction, filterSince]);

	useEffect(() => {
		setPage(1);
	}, [debouncedSearch, filterAction, filterSince]);

	useEffect(() => {
		fetchLogs(page);
	}, [fetchLogs, page]);

	const noised = useMemo(() => {
		const result: LogEntry[] = [];
		let i = 0;
		while (i < logs.length) {
			const key = noiseKey(logs[i]);
			if (key) {
				const group: LogEntry[] = [logs[i]];
				let j = i + 1;
				while (j < logs.length && noiseKey(logs[j]) === key) {
					group.push(logs[j]);
					j++;
				}
				if (group.length > 1) {
					const isExpanded = expandedNoise.has(key);
					if (isExpanded) {
						result.push(...group);
					} else {
						result.push({ ...group[0], _noiseCount: group.length, _noiseKey: key } as LogEntry & { _noiseCount: number; _noiseKey: string });
					}
				} else {
					result.push(group[0]);
				}
				i = j;
			} else {
				result.push(logs[i]);
				i++;
			}
		}
		return result;
	}, [logs, expandedNoise]);

	const grouped = useMemo(() => {
		const groups = new Map<string, LogEntry[]>();
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
		const systemEvents = logs.filter((e) => isSystemEvent(e)).length;
		const humanEvents = totalEvents - systemEvents;
		const todayEvents = logs.filter((e) => getDateGroup(e.timestamp).label === "Hoje").length;
		return { totalEvents, systemEvents, humanEvents, todayEvents };
	}, [logs]);

	const totalPages = Math.ceil(total / limit);

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
			<div className="flex flex-col items-center justify-center gap-3 p-12">
				<Icon name="alert-circle" size={24} style={{ color: "var(--error)" }} />
				<p className="text-sm" style={{ color: "var(--muted-foreground)" }}>{error}</p>
				<Button variant="outline" size="sm" onClick={() => fetchLogs(1)}>
					<Icon name="check" size={12} />
					Tentar novamente
				</Button>
			</div>
		);
	}

	return (
		<div className="flex flex-col flex-1 min-h-0">
			{/* Investigation Sheet */}
			<Sheet open={!!selectedEvent} onOpenChange={(open: boolean) => { if (!open) setSelectedEvent(null); }}>
				<SheetContent side="right" className="w-full sm:max-w-xl">
					{selectedEvent && (
						<>
							<SheetHeader className="border-b px-6 py-4 flex items-center justify-between">
								<SheetTitle>Detalhes do Evento</SheetTitle>
								<SheetClose>
									<Icon name="x" size={16} />
								</SheetClose>
							</SheetHeader>
							<div className="flex-1 overflow-y-auto p-6 space-y-6">
								{/* Who */}
								<section>
									<h4 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--muted-foreground)" }}>
										Quem
									</h4>
									<div className="flex items-center gap-2">
										<span className="w-2 h-2 rounded-full" style={{ background: actorColor(selectedEvent) }} />
										<span className="text-sm font-medium">{actorLabel(selectedEvent)}</span>
										{isSystemEvent(selectedEvent) && (
											<Badge variant="secondary" className="text-[10px]">automation</Badge>
										)}
									</div>
								</section>

								{/* What */}
								<section>
									<h4 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--muted-foreground)" }}>
										O que
									</h4>
									<div className="flex items-center gap-2 mb-1">
										<Badge variant={actionVariant(selectedEvent.action)} className="text-[10px]">
											{selectedEvent.action}
										</Badge>
										{selectedEvent.details?.actionId && (
											<span className="text-xs font-mono" style={{ color: "var(--muted-foreground)" }}>
												{selectedEvent.details.actionId}
											</span>
										)}
									</div>
									<p className="text-sm leading-relaxed">{selectedEvent.description}</p>
								</section>

								{/* Where & When */}
								<section>
									<h4 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--muted-foreground)" }}>
										Quando
									</h4>
									<p className="text-sm font-mono">{fullTime(selectedEvent.timestamp)}</p>
								</section>

								{/* Cause & Effect */}
								{selectedEvent.details?.cause && (
									<section>
										<h4 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--muted-foreground)" }}>
											Causa
										</h4>
										<p className="text-sm">{selectedEvent.details.cause}</p>
									</section>
								)}
								{selectedEvent.details?.effect && (
									<section>
										<h4 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--muted-foreground)" }}>
											Efeito
										</h4>
										<p className="text-sm">{selectedEvent.details.effect}</p>
									</section>
								)}

								{/* Result */}
								{selectedEvent.details?.outcome && (
									<section>
										<h4 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--muted-foreground)" }}>
											Resultado
										</h4>
										<Badge variant={selectedEvent.details.outcome === "completed" ? "success" : "warning"}>
											{selectedEvent.details.outcome}
										</Badge>
									</section>
								)}

								{/* Links */}
								{(selectedEvent.itemId || selectedEvent.acId) && (
									<section>
										<h4 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--muted-foreground)" }}>
											Links
										</h4>
										<div className="flex flex-wrap gap-2">
											{selectedEvent.itemId && (
												<Button variant="outline" size="sm" onClick={() => {
													window.dispatchEvent(new CustomEvent("letra-open-item", { detail: selectedEvent.itemId }));
												}}>
													<Icon name="box" size={12} />
													{selectedEvent.itemId}
												</Button>
											)}
											{selectedEvent.acId && (
												<Badge variant="outline" className="text-[10px]">
													AC: {selectedEvent.acId}
												</Badge>
											)}
										</div>
									</section>
								)}

								{/* Raw Details */}
								{selectedEvent.details && (
									<section>
										<h4 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--muted-foreground)" }}>
											Detalhes brutos
										</h4>
										<pre className="text-xs font-mono p-3 rounded-lg overflow-auto" style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>
											{JSON.stringify(selectedEvent.details, null, 2)}
										</pre>
									</section>
								)}

								{/* Event ID */}
								<p className="text-[10px] font-mono" style={{ color: "var(--muted-foreground)", opacity: 0.5 }}>
									ID: {selectedEvent.id}
								</p>
							</div>
						</>
					)}
				</SheetContent>
			</Sheet>

			{/* Main content */}
			<div className="flex-1 overflow-y-auto">
				<div className="p-6">
					{/* Title */}
					<div className="flex items-center justify-between mb-6">
						<div>
							<h1 className="text-xl font-bold">Auditoria Operacional</h1>
							<p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
								{total} evento{total !== 1 ? "s" : ""} · {metrics.humanEvents} humano{metrics.humanEvents !== 1 ? "s" : ""} · {metrics.systemEvents} sistema
							</p>
						</div>
					</div>

					{/* Metric cards */}
					<div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
						<Card>
							<CardContent className="p-4">
								<p className="text-2xl font-bold">{metrics.totalEvents}</p>
								<p className="text-xs" style={{ color: "var(--muted-foreground)" }}>Total</p>
							</CardContent>
						</Card>
						<Card>
							<CardContent className="p-4">
								<p className="text-2xl font-bold" style={{ color: "var(--muted-foreground)" }}>{metrics.systemEvents}</p>
								<p className="text-xs" style={{ color: "var(--muted-foreground)" }}>Sistema</p>
							</CardContent>
						</Card>
						<Card>
							<CardContent className="p-4">
								<p className="text-2xl font-bold" style={{ color: "var(--primary)" }}>{metrics.humanEvents}</p>
								<p className="text-xs" style={{ color: "var(--muted-foreground)" }}>Humanos</p>
							</CardContent>
						</Card>
						<Card>
							<CardContent className="p-4">
								<p className="text-2xl font-bold">{metrics.todayEvents}</p>
								<p className="text-xs" style={{ color: "var(--muted-foreground)" }}>Hoje</p>
							</CardContent>
						</Card>
					</div>

					{/* Filters */}
					<div className="flex items-center gap-3 mb-6 flex-wrap">
						<div className="flex-1 min-w-[200px] max-w-sm">
							<Input
								placeholder="Buscar em todos os eventos..."
								value={search}
								onChange={(e) => setSearch(e.target.value)}
								aria-label="Buscar eventos"
							/>
						</div>
						<Select value={filterAction} onValueChange={setFilterAction}>
							<SelectTrigger className="text-xs px-3 py-1.5 rounded min-w-[140px]">
								<SelectValue placeholder="Todas ações" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="">Todas ações</SelectItem>
								<SelectItem value="system">Sistema</SelectItem>
								<SelectItem value="flow-move">Movimento</SelectItem>
								<SelectItem value="create">Criação</SelectItem>
								<SelectItem value="approve">Aprovação</SelectItem>
								<SelectItem value="reject">Rejeição</SelectItem>
								<SelectItem value="validate">Validação</SelectItem>
								<SelectItem value="health">Health</SelectItem>
								<SelectItem value="decision">Decisão</SelectItem>
							</SelectContent>
						</Select>
						<Input
							type="date"
							value={filterSince}
							onChange={(e) => setFilterSince(e.target.value)}
							className="w-[140px] text-xs"
							aria-label="Filtrar desde"
						/>
						<Button variant="ghost" size="sm" onClick={() => fetchLogs(page)}>
							<Icon name="check" size={14} />
							Atualizar
						</Button>
						{(search || filterAction || filterSince) && (
							<Button variant="ghost" size="sm" onClick={() => { setSearch(""); setDebouncedSearch(""); setFilterAction(""); setFilterSince(""); }}>
								Limpar filtros
							</Button>
						)}
					</div>

					{/* Timeline */}
					{loading ? (
						<div className="flex items-center justify-center py-16">
							<p className="text-sm" style={{ color: "var(--muted-foreground)" }}>Carregando...</p>
						</div>
					) : logs.length === 0 ? (
						<div className="flex flex-col items-center gap-2 py-16">
							<Icon name="search" size={24} style={{ color: "var(--muted-foreground)" }} />
							<p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
								Nenhum evento encontrado
							</p>
						</div>
					) : (
						<div className="space-y-6">
							{grouped.map((group) => {
								const isOpen = expandedDates.has(group.label);
								return (
									<section key={group.label} role="region" aria-label={`${group.label} — ${group.entries.length} eventos`}>
										<button
											onClick={() => toggleDateGroup(group.label)}
											aria-expanded={isOpen}
											aria-label={`${group.label} — ${group.entries.length} eventos`}
											className="flex items-center gap-2 mb-3 text-xs font-semibold uppercase tracking-wider bg-transparent border-none cursor-pointer"
											style={{ color: "var(--muted-foreground)" }}
										>
											<Icon name={isOpen ? "chevron-down" : "chevron-right"} size={12} />
											{group.label}
											<span className="font-normal normal-case ml-1">{group.entries.length} evento{group.entries.length !== 1 ? "s" : ""}</span>
										</button>
										{isOpen && (
											<div className="space-y-1">
												{group.entries.map((entry, idx) => {
													const isNoiseGroup = (entry as LogEntry & { _noiseCount?: number; _noiseKey?: string })._noiseCount !== undefined;
													const noiseCount = (entry as LogEntry & { _noiseCount?: number })._noiseCount;
													const noiseKeyVal = (entry as LogEntry & { _noiseKey?: string })._noiseKey;
													const { who } = summaryFromDesc(entry.description);
													return (
														<button
															key={`${entry.id}-${idx}`}
															onClick={() => {
																if (isNoiseGroup && noiseKeyVal) {
																	toggleNoise(noiseKeyVal);
																} else {
																	setSelectedEvent(entry);
																}
															}}
															aria-label={isNoiseGroup ? `Grupo de ${noiseCount} eventos similares` : `${entry.action}: ${entry.description.substring(0, 60)}`}
															className={cn(
																"w-full text-left p-3 rounded-lg transition-all duration-150",
																"hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]",
																isNoiseGroup
																	? "border border-dashed cursor-pointer"
																	: "border cursor-pointer",
															)}
															style={{
																borderColor: isNoiseGroup ? "var(--border)" : "var(--border)",
																background: isNoiseGroup ? "color-mix(in oklch, var(--muted) 50%, transparent)" : "var(--card)",
															}}
														>
															{isNoiseGroup ? (
																<div className="flex items-center gap-2">
																	<Icon name={expandedNoise.has(noiseKeyVal || "") ? "chevron-down" : "chevron-right"} size={14} style={{ color: "var(--muted-foreground)" }} />
																	<span className="text-xs font-mono font-medium" style={{ color: "var(--muted-foreground)" }}>
																		{entry.action}
																	</span>
																	<Badge variant="secondary" className="text-[10px]">
																		×{noiseCount}
																	</Badge>
																	<span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
																		eventos similares — clique para expandir
																	</span>
																</div>
															) : (
																<div className="flex items-start gap-3">
																	<span className="text-xs font-mono shrink-0 pt-0.5" style={{ color: "var(--muted-foreground)" }}>
																		{formatTime(entry.timestamp)}
																	</span>
																	<div className="flex items-center gap-1.5 shrink-0 pt-0.5">
																		<span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: actorColor(entry) }} />
																		<Badge variant={actionVariant(entry.action)} className="text-[10px] uppercase">
																			{entry.action}
																		</Badge>
																		{entry.details?.outcome && (
																			<span className="text-[10px] font-mono" style={{ color: "var(--muted-foreground)" }}>
																				{entry.details.outcome}
																			</span>
																		)}
																	</div>
																	<div className="flex-1 min-w-0">
																		<p className="text-sm leading-snug truncate">{entry.description}</p>
																		{who && (
																			<p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
																				{who}
																			</p>
																		)}
																	</div>
																	{entry.itemId && (
																		<span className="text-[10px] font-mono shrink-0 pt-1" style={{ color: "var(--primary)" }}>
																			{entry.itemId}
																		</span>
																	)}
																	<Icon name="chevron-right" size={14} className="shrink-0 pt-1" style={{ color: "var(--muted-foreground)" }} />
																</div>
															)}
														</button>
													);
												})}
											</div>
										)}
									</section>
								);
							})}
						</div>
					)}

					{/* Pagination */}
					{total > 0 && (
						<div className="flex items-center justify-between mt-6 pt-4 border-t text-xs" style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>
							<span>{total} evento{total !== 1 ? "s" : ""} no total</span>
							<div className="flex items-center gap-2">
								<Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
									Anterior
								</Button>
								<span>Página {page} de {totalPages}</span>
								<Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
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
