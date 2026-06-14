import { useEffect, useState } from "react";
import type { Workflow, ResolvedSpec } from "@letra/types";
import { Card, CardContent, Badge, Icon } from "@letra/ui";

interface Props {
	workflow: Workflow;
	onSelectItem: (id: string) => void;
	onTabChange?: (tab: "specs" | "flow") => void;
}

interface Decision {
	name: string;
	content: string;
}

interface FocusData {
	active: boolean;
	spec?: string;
	content?: string;
}

function daysSince(dateStr: string): number {
	return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

function daysSinceFile(name: string): number {
	const m = name.match(/^(\d{4}-\d{2}-\d{2})/);
	if (m) return daysSince(`${m[1]}T00:00:00`);
	return 0;
}

function resolveTitle(content: string): string {
	const m = content.match(/^#\s+(.+)/m);
	return m ? m[1] : "";
}

function formatDate(name: string): string {
	const m = name.match(/^(\d{4}-\d{2}-\d{2})/);
	if (m) {
		const [y, mo, d] = m[1].split("-");
		return `${d}/${mo}/${y}`;
	}
	return name.replace(/\.md$/, "").replace(/-/g, " ");
}

function InfoIcon({ tip }: { tip: string }) {
	return (
		<span className="group relative inline-flex items-center">
			<Icon
				name="info"
				size={14}
				className="opacity-40 hover:opacity-70 cursor-help transition-opacity"
				style={{ color: "var(--muted-foreground)" }}
			/>
			<div
				className="absolute top-full left-1/2 -translate-x-1/2 mt-2 hidden group-hover:block z-50 w-48 px-2 py-1.5 text-xs text-left rounded shadow-lg pointer-events-none"
				style={{
					background: "var(--card)",
					color: "var(--card-foreground)",
					border: "1px solid var(--border)",
				}}
			>
				{tip}
			</div>
		</span>
	);
}

function cn(...classes: (string | false | null | undefined)[]): string {
	return classes.filter(Boolean).join(" ");
}

export default function HomeView({ workflow, onSelectItem, onTabChange }: Props) {
	const [specs, setSpecs] = useState<ResolvedSpec[]>([]);
	const [focus, setFocus] = useState<FocusData | null>(null);
	const [decisions, setDecisions] = useState<Decision[]>([]);
	const [localStages, setLocalStages] = useState(workflow.stages);
	const [dragStageIdx, setDragStageIdx] = useState<number | null>(null);
	const [dragItemId, setDragItemId] = useState<string | null>(null);
	const [dragOverStage, setDragOverStage] = useState<string | null>(null);

	useEffect(() => {
		setLocalStages(workflow.stages);
	}, [workflow.stages]);

	useEffect(() => {
		fetch("/api/specs")
			.then((r) => r.json())
			.then((data) => {
				if (Array.isArray(data)) setSpecs(data);
			})
			.catch(() => {});
		fetch("/api/focus")
			.then((r) => r.json())
			.then((data) => setFocus(data))
			.catch(() => {});
		fetch("/api/context?file=decisions")
			.then((r) => r.json())
			.then((data) => {
				if (Array.isArray(data)) setDecisions(data);
			})
			.catch(() => {});
	}, []);

	const totalItems = workflow.items.length;
	const doingItems = workflow.items.filter((it) => {
		const st = workflow.stages.find((s) => s.id === it.stage);
		return (
			st?.zone === "doing" ||
			(!st?.zone &&
				workflow.stages.indexOf(st!) > 0 &&
				workflow.stages.indexOf(st!) < workflow.stages.length - 1)
		);
	}).length;
	const doneItems = workflow.items.filter((it) => {
		const st = workflow.stages.find((s) => s.id === it.stage);
		return (
			st?.zone === "done" ||
			(!st?.zone && workflow.stages.indexOf(st!) === workflow.stages.length - 1)
		);
	}).length;
	const staleItems = workflow.items.filter((it) => daysSince(it.createdAt) > 7).length;

	const specValid = specs.filter(
		(s) =>
			/## Outcome/.test(s.content) &&
			/## Constraints/.test(s.content) &&
			/## Acceptance Criteria/.test(s.content),
	).length;
	const specNoDate = specs.filter(
		(s) => !/> Updated:\s*\d{4}-\d{2}-\d{2}/.test(s.content),
	).length;
	const specDrift = specs.filter((s) => {
		const m = s.content.match(/> Updated:\s*(\d{4}-\d{2}-\d{2})/);
		return m ? daysSince(m[1]) > 7 : false;
	}).length;

	const recentDecisions = decisions.slice(0, 4);

	function handleStageDragStart(idx: number) {
		setDragStageIdx(idx);
	}

	function handleStageDragOver(e: React.DragEvent, idx: number) {
		e.preventDefault();
		if (dragStageIdx === null || dragStageIdx === idx) return;
		setLocalStages((prev) => {
			const next = [...prev];
			const [moved] = next.splice(dragStageIdx, 1);
			next.splice(idx, 0, moved);
			return next.map((s, i) => ({ ...s, order: i }));
		});
		setDragStageIdx(idx);
	}

	function handleStageDragEnd() {
		if (dragStageIdx !== null) {
			const reordered = localStages.map((s, i) => ({ ...s, order: i }));
			fetch("/api/workflow", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ stages: reordered }),
			}).catch(() => {});
		}
		setDragStageIdx(null);
	}

	function handleItemDragStart(e: React.DragEvent, itemId: string) {
		e.dataTransfer.setData("text/plain", itemId);
		e.dataTransfer.effectAllowed = "move";
		setDragItemId(itemId);
	}

	function handleItemDragEnd() {
		setDragItemId(null);
		setDragOverStage(null);
	}

	function handleStageDrop(e: React.DragEvent, targetStageId: string) {
		e.preventDefault();
		setDragOverStage(null);
		const itemId = e.dataTransfer.getData("text/plain");
		if (!itemId) return;
		const item = workflow.items.find((it) => it.id === itemId);
		if (!item || item.stage === targetStageId) return;
		fetch(`/api/items/${itemId}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ stage: targetStageId }),
		}).then(() => {
			onSelectItem(itemId);
		});
	}

	return (
		<div className="flex flex-col h-full">
			<div className="flex-1 overflow-y-auto p-6">
				<div className="flex flex-col gap-6">
					<div>
						<h1 className="text-2xl font-bold">{workflow.name}</h1>
						<p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
							{workflow.description || "AI Memory & Spec Hub"}
						</p>
					</div>

					<div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
						<Card className="p-4 flex flex-col items-center text-center gap-1 transition-all duration-200 hover:shadow-sm hover:-translate-y-0.5 border-muted/60">
							<span
								className="text-xs font-medium uppercase tracking-wider flex items-center gap-1.5"
								style={{ color: "var(--muted-foreground)" }}
							>
								<Icon name="specs" size={14} /> Specs
								<InfoIcon tip="Total de thin specs. Válidas = possuem Outcome, Constraints e Acceptance Criteria. Incompletas = faltam seções obrigatórias." />
							</span>
							<span className="text-2xl font-bold">{specs.length}</span>
							<span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
								{specValid} válidas · {specs.length - specValid} incompletas
							</span>
						</Card>
						<Card className="p-4 flex flex-col items-center text-center gap-1 transition-all duration-200 hover:shadow-sm hover:-translate-y-0.5 border-muted/60">
							<span
								className="text-xs font-medium uppercase tracking-wider flex items-center gap-1.5"
								style={{ color: "var(--muted-foreground)" }}
							>
								<Icon name="alert-circle" size={14} /> Drift
								<InfoIcon tip="Specs com data de atualização há mais de 7 dias — indicam desalinhamento entre spec e implementação." />
							</span>
							<span
								className="text-2xl font-bold"
								style={{
									color:
										specDrift > 0
											? "var(--warning)"
											: specNoDate > 0
												? "var(--muted-foreground)"
												: "var(--success)",
								}}
							>
								{specDrift > 0
									? specDrift
									: specNoDate > 0
										? `${specNoDate}?`
										: "0"}
							</span>
							<span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
								{specDrift > 0
									? `${specDrift} desatualizadas há 7d+`
									: specNoDate > 0
										? `${specNoDate} sem data`
										: "todas atualizadas"}
							</span>
						</Card>
						<Card className="p-4 flex flex-col items-center text-center gap-1 transition-all duration-200 hover:shadow-sm hover:-translate-y-0.5 border-muted/60">
							<span
								className="text-xs font-medium uppercase tracking-wider flex items-center gap-1.5"
								style={{ color: "var(--muted-foreground)" }}
							>
								<Icon name="star" size={14} /> Foco
								<InfoIcon tip="Spec ativa sendo trabalhada agora. Definida via letra focus." />
							</span>
							{focus?.active ? (
								<span className="text-lg font-semibold truncate max-w-full">
									{focus.spec}
								</span>
							) : (
								<span
									className="text-2xl font-bold"
									style={{ color: "var(--muted-foreground)" }}
								>
									—
								</span>
							)}
							<span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
								{focus?.active
									? focus.content
											?.split("\n")
											.find((l) => l.includes("**Outcome**"))
											?.replace(/\*\*/g, "")
											.replace("Outcome:", "")
											.trim() || "Em foco"
									: "nenhum foco definido"}
							</span>
						</Card>
						<Card className="p-4 flex flex-col items-center text-center gap-1 transition-all duration-200 hover:shadow-sm hover:-translate-y-0.5 border-muted/60">
							<span
								className="text-xs font-medium uppercase tracking-wider flex items-center gap-1.5"
								style={{ color: "var(--muted-foreground)" }}
							>
								<Icon name="check-circle" size={14} /> Health
								<InfoIcon tip="Itens parados há mais de 7 dias no pipeline. Stale = número de itens esquecidos. Healthy = nenhum item parado." />
							</span>
							<Badge variant={staleItems > 0 ? "warning" : "success"}>
								{staleItems > 0 ? `${staleItems} stale` : "healthy"}
							</Badge>
							<span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
								{doneItems} done (7d) · {doingItems} in progress
							</span>
						</Card>
					</div>

					<div className="flex flex-col gap-2">
						<h2 className="text-sm font-semibold flex items-center gap-2">
							Pipeline
							<span
								className="text-xs font-normal"
								style={{ color: "var(--muted-foreground)" }}
							>
								(arraste stages para reordenar, itens entre colunas para mover)
							</span>
							<button
								onClick={() => onTabChange?.("flow")}
								className="text-xs text-primary hover:underline font-normal ml-auto"
							>
								[ver fluxo completo]
							</button>
						</h2>
						<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
							{localStages.map((stage, i) => {
								const stageItems = workflow.items.filter(
									(it) => it.stage === stage.id,
								);
								const isDoing =
									stage.zone === "doing" ||
									(i > 0 && i < workflow.stages.length - 1);
								const isOver = dragOverStage === stage.id;
								const miniItems = stageItems.slice(0, 3);
								return (
									<Card
										key={stage.id}
										draggable
										onDragStart={() => handleStageDragStart(i)}
										onDragOver={(e) => {
											e.preventDefault();
											if (dragItemId) {
												setDragOverStage(stage.id);
											} else {
												handleStageDragOver(e, i);
											}
										}}
										onDragEnd={handleStageDragEnd}
										onDrop={(e) => {
											if (dragItemId) {
												handleStageDrop(e, stage.id);
											}
										}}
										className={cn(
											"p-3 transition-all duration-200 border-muted/60",
											"hover:shadow-sm hover:-translate-y-0.5",
											isDoing && "ring-1 ring-primary/10",
											dragStageIdx === i && "opacity-40",
											isOver && dragItemId && "ring-2 ring-primary/40",
										)}
										style={
											stage.color
												? { borderTop: `2px solid ${stage.color}80` }
												: undefined
										}
									>
										<CardContent className="p-0 flex flex-col gap-2">
											<div className="flex items-center gap-1.5 text-xs">
												<span
													className="w-2 h-2 rounded-full shrink-0"
													style={{
														background:
															stage.color ??
															(stage.zone === "todo"
																? "var(--primary)"
																: stage.zone === "done"
																	? "var(--success)"
																	: "var(--warning)"),
													}}
												/>
												{stage.color && (
													<span
														className="w-3 h-0.5 rounded shrink-0"
														style={{ background: `${stage.color}40` }}
													/>
												)}
												<span className="truncate font-medium">
													{stage.name}
												</span>
												<span className="font-bold ml-auto">
													{stageItems.length}
												</span>
											</div>
											<div className="flex flex-col gap-1 min-h-[24px]">
												{miniItems.length === 0 && (
													<div
														className="flex items-center justify-center h-6 rounded border border-dashed"
														style={{ borderColor: "var(--border)" }}
													>
														<span
															className="text-[10px]"
															style={{
																color: "var(--muted-foreground)",
															}}
														>
															—
														</span>
													</div>
												)}
												{miniItems.map((it) => {
													const days = daysSince(it.createdAt);
													return (
														<div
															key={it.id}
															draggable
															onDragStart={(e) =>
																handleItemDragStart(e, it.id)
															}
															onDragEnd={handleItemDragEnd}
															onClick={() => onTabChange?.("flow")}
															className={cn(
																"flex items-center gap-1 px-1.5 py-1 rounded cursor-grab active:cursor-grabbing text-xs transition-all border",
																"hover:shadow-sm hover:-translate-y-0.5",
																dragItemId === it.id &&
																	"opacity-40",
																stage.color
																	? "border-transparent"
																	: "border-border/50",
															)}
															style={{
																background: stage.color
																	? `${stage.color}12`
																	: "var(--muted)",
																borderLeft: stage.color
																	? `2px solid ${stage.color}60`
																	: undefined,
															}}
														>
															<Icon
																name="list-three"
																size={10}
																className="opacity-30 shrink-0"
															/>
															<span className="truncate flex-1">
																{it.id}
															</span>
															<span
																className="shrink-0 tabular-nums"
																style={{
																	color:
																		days <= 2
																			? "var(--muted-foreground)"
																			: days <= 7
																				? "var(--warning)"
																				: "var(--error)",
																}}
															>
																{days}d
															</span>
														</div>
													);
												})}
												{stageItems.length > 3 && (
													<button
														onClick={() => onTabChange?.("flow")}
														className="text-[10px] text-primary hover:underline text-left"
													>
														+{stageItems.length - 3} mais
													</button>
												)}
											</div>
										</CardContent>
									</Card>
								);
							})}
						</div>
					</div>

					<div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-6">
						<div className="lg:col-span-2 xl:col-span-2 flex flex-col gap-4">
							<div className="flex flex-col gap-2">
								<div className="flex items-center justify-between">
									<h2 className="text-sm font-semibold flex items-center gap-1.5">
										<Icon name="specs" size={14} /> Specs Recentes
									</h2>
									<button
										onClick={() => onTabChange?.("specs")}
										className="text-xs text-primary hover:underline"
									>
										[ver todas]
									</button>
								</div>
								<div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
									{specs.slice(0, 4).map((spec) => {
										const hasOutcome = /## Outcome/.test(spec.content);
										const hasAC = /## Acceptance Criteria/.test(spec.content);
										const acDone = (spec.content.match(/-\s+\[x\]/g) || [])
											.length;
										const acTotal = (
											spec.content.match(/-\s+\[(\s|x)\]/g) || []
										).length;
										const pct =
											acTotal > 0 ? Math.round((acDone / acTotal) * 100) : 0;
										return (
											<Card
												key={spec.id}
												className="p-3 transition-all duration-200 hover:shadow-sm hover:-translate-y-0.5 border-muted/60"
											>
												<CardContent className="p-0">
													<div className="flex items-center gap-2">
														<span className="text-sm font-medium truncate flex-1">
															{spec.id}
														</span>
														<Badge
															variant={
																hasOutcome && hasAC
																	? "success"
																	: "warning"
															}
															className="shrink-0"
														>
															{pct}%
														</Badge>
													</div>
													<div
														className="flex items-center gap-2 mt-1 text-xs"
														style={{ color: "var(--muted-foreground)" }}
													>
														<span className="flex items-center gap-1">
															<Icon
																name="check"
																size={14}
																style={{
																	color:
																		hasOutcome && hasAC
																			? "var(--success)"
																			: "var(--warning)",
																}}
															/>
															{acTotal} ACs
														</span>
														<span>
															· {hasOutcome ? "completa" : "rascunho"}
														</span>
													</div>
												</CardContent>
											</Card>
										);
									})}
									{specs.length === 0 && (
										<p
											className="text-sm"
											style={{ color: "var(--muted-foreground)" }}
										>
											Nenhuma spec ainda.
										</p>
									)}
								</div>
							</div>
						</div>

						<div className="flex flex-col gap-4">
							<div className="flex flex-col gap-2">
								<h2 className="text-sm font-semibold flex items-center gap-1.5">
									<Icon name="context" size={14} /> Decisões Recentes
								</h2>
								{recentDecisions.length === 0 ? (
									<p
										className="text-sm"
										style={{ color: "var(--muted-foreground)" }}
									>
										Nenhuma decisão registrada.
									</p>
								) : (
									<div className="flex flex-col gap-2">
										{recentDecisions.map((d) => (
											<Card
												key={d.name}
												className="p-3 transition-all duration-200 hover:shadow-sm hover:-translate-y-0.5 border-muted/60"
											>
												<CardContent className="p-0">
													<div
														className="text-xs"
														style={{ color: "var(--muted-foreground)" }}
													>
														{formatDate(d.name)}
													</div>
													<div className="text-sm font-medium truncate">
														{resolveTitle(d.content) || d.name}
													</div>
												</CardContent>
											</Card>
										))}
									</div>
								)}
								{decisions.length > 4 && (
									<button className="text-xs text-primary hover:underline self-start">
										+{decisions.length - 4} mais
									</button>
								)}
							</div>
						</div>

						<div className="flex flex-col gap-2">
							<h2 className="text-sm font-semibold flex items-center gap-1.5">
								<Icon name="flow" size={14} /> Métricas
							</h2>
							<Card className="p-3 transition-all duration-200 hover:shadow-sm border-muted/60">
								<CardContent className="p-0 flex flex-col gap-1">
									{workflow.stages.map((stage) => {
										const items = workflow.items.filter(
											(it) => it.stage === stage.id,
										);
										const avg =
											items.length > 0
												? Math.round(
														(items.reduce(
															(acc, it) =>
																acc + daysSince(it.createdAt),
															0,
														) /
															items.length) *
															10,
													) / 10
												: 0;
										const max =
											items.length > 0
												? Math.max(
														...items.map((it) =>
															daysSince(it.createdAt),
														),
													)
												: 0;
										return (
											<div
												key={stage.id}
												className="flex items-center gap-2 text-xs py-1 border-b last:border-0 transition-colors duration-150 hover:bg-primary/5"
												style={{ borderColor: "var(--border)" }}
											>
												<span className="w-16 shrink-0">{stage.name}</span>
												<span
													className="flex-1"
													style={{ color: "var(--muted-foreground)" }}
												>
													{items.length} items · avg {avg}d · max {max}d
												</span>
												{avg > 0 && avg > 5 && (
													<Badge variant="warning">bottleneck</Badge>
												)}
											</div>
										);
									})}
								</CardContent>
							</Card>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
