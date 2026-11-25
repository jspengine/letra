import { useEffect, useState } from "react";
import { Button, Card, CardContent, Dialog, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@letra/ui";
import { diffWorkflow, layoutWorkflow, simulateWorkflow, stagesFromTemplate, workflowImpact } from "./workflow-editor-analysis";

interface WorkflowDefinitionSummary {
	id: string;
	name: string;
	activeVersionId: string | null;
	draftVersionId: string | null;
}

interface WorkflowPhase {
	id: string;
	label: string;
	description: string;
	transitions?: Array<{ target: string; gate?: string; auto?: boolean }>;
	[key: string]: unknown;
}

interface WorkflowStage {
	id: string;
	name?: string;
	zone?: string;
	order?: number;
	final?: boolean;
	transitions?: Array<{ target: string; allowPendingAcceptanceCriteria?: boolean }>;
	gate?: string | { id: string; type?: string; description?: string } | null;
	allow?: string[];
	roleIds?: string[];
	preferredExecutor?: string;
	phases?: { initialState?: string; states?: Record<string, WorkflowPhase> };
	[key: string]: unknown;
}

interface WorkflowSnapshot {
	id?: string;
	number: number | null;
	status?: string;
	basedOnVersionId?: string | null;
	restoredFromVersionId?: string;
	contentHash?: string;
	revision: number;
	content: WorkflowContent;
	createdBy?: string;
	publishedBy?: string;
	createdAt?: string;
	publishedAt?: string;
	changeSummary?: string;
}

interface WorkflowContent {
	name?: string;
	description?: string;
	initialStageId?: string;
	stages?: WorkflowStage[];
	template?: string;
	[key: string]: unknown;
}

interface TemplatePreview {
	name: string;
	stages: WorkflowStage[];
	matchesDraftTemplate: boolean;
}

interface RoleOption { id: string; label: string; allowedStages: string[] }
interface ExecutorOption { id: string; displayName: string; active: boolean; detected: boolean }
interface GateOption { id: string; type?: string; description?: string }

interface WorkflowValidation { valid: boolean; errors: Array<{ code: string; message: string; path?: string }> }

function snapshotStages(snapshot: WorkflowSnapshot | null): WorkflowStage[] {
	return Array.isArray(snapshot?.content?.stages) ? snapshot.content.stages : [];
}

async function readSnapshot(url: string): Promise<WorkflowSnapshot | null> {
	const response = await fetch(url);
	if (response.status === 404) return null;
	if (!response.ok) throw new Error("Não foi possível carregar a versão do fluxo.");
	return response.json() as Promise<WorkflowSnapshot | null>;
}

export default function WorkflowDefinitionPage({ onBack }: { onBack: () => void }) {
	const [definitions, setDefinitions] = useState<WorkflowDefinitionSummary[]>([]);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [draft, setDraft] = useState<WorkflowSnapshot | null>(null);
	const [published, setPublished] = useState<WorkflowSnapshot | null>(null);
	const [editor, setEditor] = useState<WorkflowContent | null>(null);
	const [templatePreview, setTemplatePreview] = useState<TemplatePreview | null>(null);
	const [showDraft, setShowDraft] = useState(true);
	const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
	const [transitionTarget, setTransitionTarget] = useState("");
	const [saving, setSaving] = useState(false);
	const [saveError, setSaveError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [reloadKey, setReloadKey] = useState(0);
	const [validation, setValidation] = useState<WorkflowValidation | null>(null);
	const [validatedRevision, setValidatedRevision] = useState<number | null>(null);
	const [validating, setValidating] = useState(false);
	const [historyOpen, setHistoryOpen] = useState(false);
	const [history, setHistory] = useState<WorkflowSnapshot[] | null>(null);
	const [historyError, setHistoryError] = useState<string | null>(null);
	const [publishOpen, setPublishOpen] = useState(false);
	const [publishReason, setPublishReason] = useState("");
	const [publishing, setPublishing] = useState(false);
	const [roles, setRoles] = useState<RoleOption[]>([]);
	const [executors, setExecutors] = useState<ExecutorOption[]>([]);
	const [catalogError, setCatalogError] = useState(false);
	const [gates, setGates] = useState<GateOption[]>([]);
	const [gateCatalogError, setGateCatalogError] = useState(false);
	const [analysisOpen, setAnalysisOpen] = useState<"simulation" | "impact" | "diff" | null>(null);
	const [operationalWorkflow, setOperationalWorkflow] = useState<unknown>(null);
	const [impactLoading, setImpactLoading] = useState(false);
	const [impactError, setImpactError] = useState(false);
	const [rollbackVersion, setRollbackVersion] = useState<WorkflowSnapshot | null>(null);
	const [rollbackReason, setRollbackReason] = useState("");
	const [rollingBack, setRollingBack] = useState(false);

	useEffect(() => {
		let active = true;
		setLoading(true);
		setError(null);
		fetch("/api/workflow-definitions")
			.then((response) => {
				if (!response.ok) throw new Error("Não foi possível carregar os fluxos.");
				return response.json() as Promise<WorkflowDefinitionSummary[]>;
			})
			.then((items) => {
				if (!active) return;
				const next = Array.isArray(items) ? items : [];
				setDefinitions(next);
				setSelectedId((current) => next.some((item) => item.id === current) ? current : next[0]?.id ?? null);
				setLoading(false);
			})
			.catch((cause: unknown) => {
				if (!active) return;
				setError(cause instanceof Error ? cause.message : "Não foi possível carregar os fluxos.");
				setLoading(false);
			});
		return () => { active = false; };
	}, [reloadKey]);

	useEffect(() => {
		if (!selectedId) return;
		let active = true;
		setLoading(true);
		setError(null);
		setSelectedStageId(null);
		setEditor(null);
		setTemplatePreview(null);
		setSaveError(null);
		setValidation(null);
		setValidatedRevision(null);
		setHistory(null);
		const base = `/api/workflow-definitions/${encodeURIComponent(selectedId)}`;
		Promise.all([readSnapshot(`${base}/draft`), readSnapshot(`${base}/active`)])
			.then(([nextDraft, nextPublished]) => {
				if (!active) return;
				setDraft(nextDraft);
				setEditor(nextDraft ? structuredClone(nextDraft.content) : null);
				setPublished(nextPublished);
				setShowDraft(Boolean(nextDraft));
				setSelectedStageId(snapshotStages(nextDraft ?? nextPublished)[0]?.id ?? null);
				setLoading(false);
			})
			.catch((cause: unknown) => {
				if (!active) return;
				setError(cause instanceof Error ? cause.message : "Não foi possível carregar o fluxo.");
				setLoading(false);
			});
		return () => { active = false; };
	}, [selectedId, reloadKey]);

	useEffect(() => {
		if (!selectedId) return;
		let active = true;
		setGates([]);
		setGateCatalogError(false);
		fetch("/api/harness/templates")
			.then((response) => {
				if (!response.ok) throw new Error("GATE_CATALOG_UNAVAILABLE");
				return response.json() as Promise<Array<{ gates?: GateOption[] }>>;
			})
			.then((templates) => {
				if (!active) return;
				const unique = new Map<string, GateOption>();
				for (const template of Array.isArray(templates) ? templates : []) {
					for (const gate of Array.isArray(template.gates) ? template.gates : []) {
						if (gate.id) unique.set(gate.id, gate);
					}
				}
				setGates([...unique.values()]);
			})
			.catch(() => { if (active) setGateCatalogError(true); });
		return () => { active = false; };
	}, [selectedId, reloadKey]);

	useEffect(() => {
		if (!selectedId) return;
		let active = true;
		setRoles([]);
		setExecutors([]);
		setCatalogError(false);
		Promise.all([fetch("/api/workflow/active-flow"), fetch("/api/workflow/adapters")])
			.then(async ([flowResponse, adaptersResponse]) => {
				if (!flowResponse.ok || !adaptersResponse.ok) throw new Error("CATALOG_UNAVAILABLE");
				const flow = await flowResponse.json() as { roles?: RoleOption[] } | null;
				const adapters = await adaptersResponse.json() as ExecutorOption[];
				if (!active) return;
				setRoles(Array.isArray(flow?.roles) ? flow.roles : []);
				setExecutors(Array.isArray(adapters) ? adapters : []);
			})
			.catch(() => { if (active) setCatalogError(true); });
		return () => { active = false; };
	}, [selectedId, reloadKey]);

	useEffect(() => {
		if (!draft?.content.template || Array.isArray(draft.content.stages)) return;
		let active = true;
		Promise.all([fetch("/api/workflow"), fetch("/api/workflow/active-flow")])
			.then(async ([workflowResponse, flowResponse]) => {
				if (!workflowResponse.ok || !flowResponse.ok) return null;
				const workflow = await workflowResponse.json() as { template?: string };
				const flow = await flowResponse.json() as TemplatePreview;
					return flow && Array.isArray(flow.stages) ? { ...flow, matchesDraftTemplate: workflow.template === draft.content.template } : null;
			})
			.then((flow) => {
				if (active && flow) setTemplatePreview(flow);
			})
			.catch(() => {});
		return () => { active = false; };
	}, [draft?.content.template, selectedId]);

	function changeContent(change: (content: WorkflowContent) => WorkflowContent) {
		setEditor((current) => current ? change(current) : current);
		setSaveError(null);
		setValidation(null);
		setValidatedRevision(null);
	}

	function changeStage(stageId: string, patch: Partial<WorkflowStage>) {
		changeContent((content) => ({ ...content, stages: (content.stages ?? []).map((stage) => stage.id === stageId ? { ...stage, ...patch } : stage) }));
	}

	function addPhase(stage: WorkflowStage) {
		const states = stage.phases?.states ?? {};
		let ordinal = 1;
		while (states[`phase-${ordinal}`]) ordinal++;
		const id = `phase-${ordinal}`;
		changeStage(stage.id, {
			phases: {
				...stage.phases,
				initialState: stage.phases?.initialState || id,
				states: { ...states, [id]: { id, label: "Nova fase", description: "", transitions: [] } },
			},
		});
	}

	function renamePhase(stage: WorkflowStage, phaseId: string, label: string) {
		const states = stage.phases?.states;
		if (!states?.[phaseId]) return;
		changeStage(stage.id, {
			phases: { ...stage.phases, states: { ...states, [phaseId]: { ...states[phaseId], label } } },
		});
	}

	function addStage() {
		const existing = new Set(editor?.stages?.map((stage) => stage.id) ?? []);
		let ordinal = 1;
		while (existing.has(`stage-${ordinal}`)) ordinal++;
		const id = `stage-${ordinal}`;
		changeContent((content) => ({
			...content,
			name: content.name || selectedDefinition?.name || "Fluxo",
			initialStageId: content.initialStageId || id,
			stages: [...(content.stages ?? []), { id, name: "Novo estágio", zone: "doing", order: content.stages?.length ?? 0, transitions: [] }],
		}));
		setSelectedStageId(id);
	}

	function useTemplateStages() {
		if (!templatePreview?.stages.length) return;
		const source = stagesFromTemplate(templatePreview.stages);
		changeContent((content) => ({
			...content,
			name: content.name || selectedDefinition?.name || templatePreview.name,
			initialStageId: source[0].id,
			stages: source,
		}));
		setSelectedStageId(source[0].id);
	}

	function moveStage(stageId: string, delta: number) {
		changeContent((content) => {
			const stages = [...(content.stages ?? [])];
			const from = stages.findIndex((stage) => stage.id === stageId);
			const to = from + delta;
			if (from < 0 || to < 0 || to >= stages.length) return content;
			[stages[from], stages[to]] = [stages[to], stages[from]];
			return { ...content, stages: stages.map((stage, order) => ({ ...stage, order })) };
		});
	}

	async function saveDraft() {
		if (!selectedId || !draft || !editor || saving) return;
		if (!editor.name?.trim()) { setSaveError("Informe o nome do fluxo antes de salvar."); return; }
		setSaving(true);
		setSaveError(null);
		try {
			const response = await fetch(`/api/workflow-definitions/${encodeURIComponent(selectedId)}/draft`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ expectedRevision: draft.revision, content: editor, changeSummary: "Edição visual do rascunho" }),
			});
			if (response.status === 409) throw new Error("O rascunho mudou em outra sessão. Atualize a página antes de salvar novamente.");
			if (response.status === 403) throw new Error("Sua sessão não permite salvar. Recarregue a página para renovar a sessão.");
			if (!response.ok) throw new Error("Não foi possível salvar o rascunho.");
			const updated = await response.json() as WorkflowSnapshot;
			setDraft(updated);
			setEditor(structuredClone(updated.content));
			setValidation(null);
			setValidatedRevision(null);
		} catch (cause) {
			setSaveError(cause instanceof Error ? cause.message : "Não foi possível salvar o rascunho.");
		} finally {
			setSaving(false);
		}
	}

	async function validateDraft() {
		if (!selectedId || !draft || validating) return;
		setValidating(true);
		setSaveError(null);
		try {
			const response = await fetch(`/api/workflow-definitions/${encodeURIComponent(selectedId)}/validate`, { method: "POST" });
			if (!response.ok) throw new Error("Não foi possível validar o rascunho.");
			setValidation(await response.json() as WorkflowValidation);
			setValidatedRevision(draft.revision);
		} catch (cause) {
			setSaveError(cause instanceof Error ? cause.message : "Não foi possível validar o rascunho.");
		} finally {
			setValidating(false);
		}
	}

	async function openHistory() {
		if (!selectedId) return;
		setHistoryOpen(true);
		setHistory(null);
		setHistoryError(null);
		try {
			const response = await fetch(`/api/workflow-definitions/${encodeURIComponent(selectedId)}/versions`);
			if (!response.ok) throw new Error("Não foi possível carregar o histórico.");
			const versions = await response.json() as WorkflowSnapshot[];
			setHistory(Array.isArray(versions) ? versions : []);
		} catch (cause) {
			setHistoryError(cause instanceof Error ? cause.message : "Não foi possível carregar o histórico.");
		}
	}

	async function publishDraft() {
		if (!selectedId || !draft || !publishReason.trim() || publishing || validatedRevision !== draft.revision || !validation?.valid) return;
		setPublishing(true);
		setSaveError(null);
		try {
			const response = await fetch(`/api/workflow-definitions/${encodeURIComponent(selectedId)}/publish`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ expectedRevision: draft.revision, reason: publishReason.trim() }),
			});
			if (response.status === 409) throw new Error("O rascunho mudou em outra sessão. Atualize e valide novamente antes de publicar.");
			if (response.status === 403) throw new Error("Sua sessão não permite publicar. Recarregue a página para renovar a sessão.");
			if (!response.ok) throw new Error("Não foi possível publicar o fluxo.");
			setPublishOpen(false);
			setPublishReason("");
			setValidation(null);
			setValidatedRevision(null);
			setReloadKey((key) => key + 1);
		} catch (cause) {
			setSaveError(cause instanceof Error ? cause.message : "Não foi possível publicar o fluxo.");
		} finally {
			setPublishing(false);
		}
	}

	async function openAnalysis(kind: "simulation" | "impact" | "diff") {
		setAnalysisOpen(kind);
		if (kind !== "impact") return;
		setImpactLoading(true);
		setImpactError(false);
		try {
			const response = await fetch("/api/workflow");
			if (!response.ok) throw new Error("IMPACT_UNAVAILABLE");
			setOperationalWorkflow(await response.json());
		} catch {
			setOperationalWorkflow(null);
			setImpactError(true);
		} finally { setImpactLoading(false); }
	}

	async function rollbackPublished() {
		if (!selectedId || !rollbackVersion?.number || !rollbackReason.trim() || rollingBack) return;
		setRollingBack(true);
		setSaveError(null);
		try {
			const response = await fetch(`/api/workflow-definitions/${encodeURIComponent(selectedId)}/rollback`, {
				method: "POST", headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ versionNumber: rollbackVersion.number, reason: rollbackReason.trim() }),
			});
			if (response.status === 403) throw new Error("Sua sessão não permite rollback. Recarregue para renovar a sessão humana.");
			if (!response.ok) throw new Error("Não foi possível reverter para esta versão.");
			setRollbackVersion(null);
			setRollbackReason("");
			setHistoryOpen(false);
			setReloadKey((key) => key + 1);
		} catch (cause) { setSaveError(cause instanceof Error ? cause.message : "Não foi possível reverter para esta versão."); }
		finally { setRollingBack(false); }
	}

	const selectedDefinition = definitions.find((item) => item.id === selectedId);
	const snapshot = showDraft && draft ? draft : published;
	const editable = Boolean(showDraft && draft && editor);
	const content = editable ? editor : snapshot?.content;
	const stages = Array.isArray(content?.stages) ? content.stages : [];
	const referenceStages = showDraft && stages.length === 0 && templatePreview ? templatePreview.stages : [];
	const visualStages = (stages.length ? stages : referenceStages).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
	const selectedStage = visualStages.find((stage) => stage.id === selectedStageId) ?? visualStages[0];
	const dirty = editable && JSON.stringify(editor) !== JSON.stringify(draft?.content);
	const publishReady = editable && !dirty && validatedRevision === draft?.revision && validation?.valid === true;
	const eligibleRoles = selectedStage ? roles.filter((role) => role.allowedStages?.includes(selectedStage.id) || selectedStage.allow?.includes(role.id)) : [];
	const availableExecutors = executors.filter((executor) => executor.active && executor.detected);
	const selectedGateId = typeof selectedStage?.gate === "string" ? selectedStage.gate : selectedStage?.gate?.id;
	const graph = layoutWorkflow(visualStages, content?.initialStageId);
	const nodeById = new Map(graph.nodes.map((node) => [node.stage.id, node]));
	const differences = content ? diffWorkflow((published?.content ?? null) as Record<string, unknown> | null, content as Record<string, unknown>) : [];
	const impact = workflowImpact(operationalWorkflow, stages.map((stage) => stage.id));

	return (
		<div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4 sm:p-6">
			<header className="mb-3 flex flex-wrap items-start justify-between gap-3">
				<div>
					<Button type="button" variant="ghost" size="sm" onClick={onBack}>{dirty ? "Voltar e descartar alterações" : "Voltar às configurações"}</Button>
					<h1 className="mt-2 text-xl font-semibold">Configuração do fluxo</h1>
				</div>
				<Button type="button" variant="secondary" size="sm" onClick={() => setReloadKey((key) => key + 1)} disabled={saving}>{dirty ? "Descartar alterações e atualizar" : "Atualizar"}</Button>
			</header>

			{error ? (
				<Card role="alert"><CardContent className="space-y-3 p-5"><p>{error}</p><Button type="button" size="sm" onClick={() => setReloadKey((key) => key + 1)}>Tentar novamente</Button></CardContent></Card>
			) : loading ? (
				<p role="status" className="p-5 text-sm text-[var(--color-text-secondary)]">Carregando configuração do fluxo…</p>
			) : definitions.length === 0 ? (
				<Card><CardContent className="p-6"><h2 className="font-semibold">Nenhuma definição versionada</h2><p className="mt-2 text-sm text-[var(--color-text-secondary)]">Este workspace ainda não tem uma definição de fluxo para consultar.</p></CardContent></Card>
			) : (
				<>
					<div className="mb-3 flex flex-wrap items-center justify-between gap-3">
						<div>
						<h2 className="text-lg font-semibold">{content?.name || selectedDefinition?.name || "Fluxo"}</h2>
						<p className="text-sm text-[var(--color-text-secondary)]">{draft ? `Rascunho · revisão ${draft.revision}` : "Sem rascunho"} · {published ? `Publicada v${published.number}` : "Sem versão publicada"}</p>
						{editable ? <p role="status" className="mt-1 text-xs text-[var(--color-text-secondary)]">{saving ? "Salvando rascunho…" : dirty ? "Alterações não salvas" : "Rascunho salvo"}</p> : null}
						{editable ? <Label className="mt-2 grid max-w-sm gap-1 text-sm">Nome do fluxo<Input value={editor?.name ?? ""} onChange={(event) => changeContent((current) => ({ ...current, name: event.target.value }))} disabled={saving} /></Label> : null}
					</div>
						<div className="flex flex-wrap gap-2" role="group" aria-label="Versão exibida">
							{draft ? <Button type="button" size="sm" variant={showDraft ? "secondary" : "ghost"} aria-pressed={showDraft} onClick={() => { setShowDraft(true); setSelectedStageId(snapshotStages(draft)[0]?.id ?? null); }}>Rascunho</Button> : null}
							{published ? <Button type="button" size="sm" variant={!showDraft ? "secondary" : "ghost"} aria-pressed={!showDraft} onClick={() => { setShowDraft(false); setSelectedStageId(snapshotStages(published)[0]?.id ?? null); }}>Publicada v{published.number}</Button> : null}
							{editable ? <Button type="button" size="sm" onClick={saveDraft} disabled={!dirty || saving}>Salvar rascunho</Button> : null}
							<Button type="button" size="sm" variant="ghost" onClick={openHistory}>Histórico</Button>
							{editable ? <Button type="button" size="sm" variant="secondary" onClick={validateDraft} disabled={Boolean(dirty || saving || validating)}>{validating ? "Validando…" : "Validar"}</Button> : null}
							{editable ? <Button type="button" size="sm" onClick={() => setPublishOpen(true)} disabled={!publishReady || saving || publishing} title={!publishReady ? "Salve e valide o rascunho antes de publicar" : undefined}>Publicar</Button> : null}
						</div>
				</div>
				{saveError ? <p role="alert" className="mb-4 rounded-lg border border-[var(--color-error)] p-3 text-sm">{saveError}</p> : null}
				{editable && editor?.template && stages.length > 0 ? <p className="mb-4 rounded-lg border border-[var(--color-border)] p-3 text-sm">Este rascunho partiu do template {editor.template}. Revise estrutura, conexões, gates e regras antes de validar ou publicar.</p> : null}
					<div className="grid min-h-0 grid-cols-1 gap-4 lg:grid-cols-[12rem_minmax(0,1fr)_16rem] 2xl:grid-cols-[14rem_minmax(0,1fr)_18rem]">
						<section aria-label="Elementos" className="order-2 rounded-lg border border-[var(--color-border)] p-3 lg:order-none">
							<h3 className="mb-3 text-sm font-semibold">Elementos</h3>
							<p className="mb-2 text-xs text-[var(--color-text-secondary)]">Fluxos</p>
							<div className="grid gap-1">{definitions.map((item) => <Button key={item.id} type="button" variant={selectedId === item.id ? "secondary" : "ghost"} aria-pressed={selectedId === item.id} className="justify-start text-left" onClick={() => setSelectedId(item.id)} disabled={(dirty || saving) && selectedId !== item.id}>{item.name}</Button>)}</div>
							{editable ? <div className="mt-5 border-t border-[var(--color-border)] pt-4"><h3 className="mb-2 text-sm font-semibold">Estrutura</h3><div className="grid gap-2"><Button type="button" size="sm" variant="secondary" onClick={addStage} disabled={saving}>+ Estágio</Button><Button type="button" size="sm" variant="secondary" onClick={() => selectedStage && addPhase(selectedStage)} disabled={saving || !selectedStage}>+ Fase</Button><p className="text-xs text-[var(--color-text-secondary)]">Gate, papéis e executor são configurados no inspector do estágio selecionado, usando os registries.</p></div></div> : null}
						</section>
						<section aria-label="Mapa do fluxo" className="order-1 min-h-64 rounded-lg border border-[var(--color-border)] p-4 lg:order-none">
							<h3 className="mb-3 text-sm font-semibold">Canvas · mapa do fluxo</h3>
							{stages.length === 0 && editable && editor?.template ? (
								<div className="mb-4 space-y-3 text-sm">
									<p>Rascunho baseado no template <strong>{editor.template}</strong>. A estrutura ainda não foi copiada para edição.</p>
									{templatePreview?.stages.length ? <><p className="text-[var(--color-text-secondary)]">{templatePreview.matchesDraftTemplate ? "Prévia do mesmo template" : "Referência do fluxo operacional atual; é diferente do template deste rascunho"}. O mapa abaixo é somente leitura.</p>{templatePreview.matchesDraftTemplate ? <><p className="text-[var(--color-text-secondary)]">A cópia preserva conexões, gates e regras presentes no template. Revise tudo antes de validar ou publicar.</p><Button type="button" size="sm" variant="secondary" onClick={useTemplateStages}>Usar estágios como ponto de partida</Button></> : null}</> : <p className="text-[var(--color-text-secondary)]">Não há prévia confiável para este template. Adicione os estágios manualmente.</p>}
								</div>
							) : stages.length === 0 ? <p className="text-sm text-[var(--color-text-secondary)]">{content?.template ? `Versão baseada no template ${content.template}, sem grafo versionado disponível nesta página.` : "Esta versão ainda não tem estágios."}</p> : null}
							{visualStages.length > 0 ? <div className="overflow-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)]" aria-label="Grafo visual do fluxo"><div className="relative" style={{ width: graph.width, height: graph.height }}><svg aria-hidden="true" className="absolute inset-0" width={graph.width} height={graph.height}><defs><marker id="workflow-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" /></marker></defs>{graph.edges.map((edge, index) => { const from = nodeById.get(edge.from)!; const to = nodeById.get(edge.to)!; const x1 = from.x + 190; const y1 = from.y + 48; const x2 = to.x; const y2 = to.y + 48; const bend = edge.backward ? Math.max(y1, y2) + 56 : undefined; const path = bend ? `M ${x1} ${y1} C ${x1 + 36} ${bend}, ${x2 - 36} ${bend}, ${x2} ${y2}` : `M ${x1} ${y1} C ${x1 + 38} ${y1}, ${x2 - 38} ${y2}, ${x2} ${y2}`; return <path key={`${edge.from}-${edge.to}-${index}`} d={path} fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray={edge.backward ? "6 4" : undefined} markerEnd="url(#workflow-arrow)" className="text-[var(--color-text-secondary)]" />; })}</svg>{graph.nodes.map(({ stage, x, y }, index) => <Button key={stage.id} type="button" variant={selectedStage?.id === stage.id ? "secondary" : "ghost"} aria-label={stage.name || stage.id} aria-pressed={selectedStage?.id === stage.id} className="absolute h-24 w-[190px] flex-col items-start rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-3 text-left shadow-sm" style={{ left: x, top: y }} onClick={() => { setSelectedStageId(stage.id); setTransitionTarget(""); }}><span className="text-xs text-[var(--color-text-secondary)]">{content?.initialStageId === stage.id || referenceStages.length > 0 && stage.zone === "todo" ? "INÍCIO" : stage.final || referenceStages.length > 0 && stage.zone === "done" ? "FIM" : `ETAPA ${index + 1}`}</span><span className="font-medium">{stage.name || stage.id}{stage.gate ? " ◇" : ""}</span><span className="text-xs text-[var(--color-text-secondary)]">{stage.zone || "zona não definida"}</span></Button>)}</div></div> : null}
						{stages.length > 0 ? <div className="mt-4 border-t border-[var(--color-border)] pt-3 text-xs text-[var(--color-text-secondary)]" aria-label="Relações do fluxo">{stages.flatMap((stage) => (stage.transitions ?? []).map((transition) => `${stage.name || stage.id} → ${stages.find((candidate) => candidate.id === transition.target)?.name || transition.target}`)).join(" · ") || "Nenhuma transição configurada"}</div> : null}
					</section>
						<aside aria-label="Detalhes do estágio" className="order-3 rounded-lg border border-[var(--color-border)] p-4 lg:order-none">
						<h3 className="mb-3 text-sm font-semibold">Inspector</h3>
						{selectedStage && editable && stages.length > 0 ? <div className="grid gap-4 text-sm">
							<Label className="grid gap-1">Nome do estágio<Input value={selectedStage.name ?? ""} onChange={(event) => changeStage(selectedStage.id, { name: event.target.value })} disabled={saving} /></Label>
							<div><span className="text-[var(--color-text-secondary)]">ID imutável</span><p>{selectedStage.id}</p></div>
							<Label className="grid gap-1">Zona<Input value={selectedStage.zone ?? ""} onChange={(event) => changeStage(selectedStage.id, { zone: event.target.value })} disabled={saving} /></Label>
							<div role="group" aria-label="Quem atua" className="grid gap-2 border-t border-[var(--color-border)] pt-3"><h4 className="font-medium">Quem atua</h4>{eligibleRoles.length ? eligibleRoles.map((role) => <Button key={role.id} type="button" size="sm" variant="secondary" aria-pressed={Boolean(selectedStage.allow?.includes(role.id))} onClick={() => changeStage(selectedStage.id, { allow: selectedStage.allow?.includes(role.id) ? selectedStage.allow.filter((id) => id !== role.id) : [...(selectedStage.allow ?? []), role.id] })} disabled={saving} className="justify-start text-left">{role.label || role.id}</Button>) : <p className="text-xs text-[var(--color-text-secondary)]">{catalogError ? "Catálogo de papéis indisponível." : "Nenhum papel do registry permite este estágio."}</p>}</div>
							<div className="grid gap-2"><Label htmlFor="preferred-executor">Executor preferencial</Label><Select value={selectedStage.preferredExecutor ?? "none"} onValueChange={(value) => changeStage(selectedStage.id, { preferredExecutor: value === "none" ? undefined : value })}><SelectTrigger id="preferred-executor" aria-label="Executor preferencial" disabled={saving || availableExecutors.length === 0}><SelectValue>{availableExecutors.find((executor) => executor.id === selectedStage.preferredExecutor)?.displayName ?? selectedStage.preferredExecutor ?? "Sem preferência"}</SelectValue></SelectTrigger><SelectContent><SelectItem value="none">Sem preferência</SelectItem>{selectedStage.preferredExecutor && !availableExecutors.some((executor) => executor.id === selectedStage.preferredExecutor) ? <SelectItem value={selectedStage.preferredExecutor}>{selectedStage.preferredExecutor} (indisponível)</SelectItem> : null}{availableExecutors.map((executor) => <SelectItem key={executor.id} value={executor.id}>{executor.displayName}</SelectItem>)}</SelectContent></Select>{availableExecutors.length === 0 ? <p className="text-xs text-[var(--color-text-secondary)]">{catalogError ? "Catálogo de executores indisponível." : "Nenhum executor ativo e detectado."}</p> : null}</div>
							<div className="grid gap-2"><Label htmlFor="stage-gate">Gate</Label><Select value={selectedGateId ?? "none"} onValueChange={(value) => changeStage(selectedStage.id, { gate: value === "none" ? null : value })}><SelectTrigger id="stage-gate" aria-label="Gate" disabled={saving || gates.length === 0 && !selectedGateId}><SelectValue>{gates.find((gate) => gate.id === selectedGateId)?.id ?? selectedGateId ?? "Sem gate"}</SelectValue></SelectTrigger><SelectContent><SelectItem value="none">Sem gate</SelectItem>{selectedGateId && !gates.some((gate) => gate.id === selectedGateId) ? <SelectItem value={selectedGateId}>{selectedGateId} (não encontrado)</SelectItem> : null}{gates.map((gate) => <SelectItem key={gate.id} value={gate.id}>{gate.id}{gate.type ? ` · ${gate.type}` : ""}</SelectItem>)}</SelectContent></Select>{gates.length === 0 ? <p className="text-xs text-[var(--color-text-secondary)]">{gateCatalogError ? "Catálogo de gates indisponível." : "Nenhum gate configurado no harness."}</p> : null}</div>
							<div role="group" aria-label="Fases internas" className="grid gap-3 border-t border-[var(--color-border)] pt-3"><div className="flex items-center justify-between gap-2"><h4 className="font-medium">Fases internas</h4><Button type="button" size="sm" variant="secondary" onClick={() => addPhase(selectedStage)} disabled={saving}>Adicionar fase</Button></div>{Object.entries(selectedStage.phases?.states ?? {}).map(([id, phase]) => <div key={id} className="grid gap-2 rounded-lg border border-[var(--color-border)] p-3"><span className="text-xs text-[var(--color-text-secondary)]">ID imutável: {id}</span><Label className="grid gap-1">Nome da fase<Input value={phase.label ?? ""} onChange={(event) => renamePhase(selectedStage, id, event.target.value)} disabled={saving} /></Label><Button type="button" size="sm" variant="secondary" aria-label={`Definir ${phase.label || id} como fase inicial`} aria-pressed={selectedStage.phases?.initialState === id} onClick={() => changeStage(selectedStage.id, { phases: { ...selectedStage.phases, initialState: id, states: selectedStage.phases?.states ?? {} } })} disabled={saving}>Fase inicial</Button></div>)}</div>
							<div className="grid gap-2"><Button type="button" size="sm" variant="secondary" aria-pressed={content?.initialStageId === selectedStage.id} onClick={() => changeContent((current) => ({ ...current, initialStageId: selectedStage.id }))} disabled={saving}>Estágio inicial</Button><Button type="button" size="sm" variant="secondary" aria-pressed={Boolean(selectedStage.final)} onClick={() => changeStage(selectedStage.id, { final: !selectedStage.final })} disabled={saving}>Estágio final</Button></div>
							<div className="flex gap-2"><Button type="button" size="sm" variant="ghost" onClick={() => moveStage(selectedStage.id, -1)} disabled={saving || stages[0]?.id === selectedStage.id}>Subir</Button><Button type="button" size="sm" variant="ghost" onClick={() => moveStage(selectedStage.id, 1)} disabled={saving || stages[stages.length - 1]?.id === selectedStage.id}>Descer</Button></div>
							<div className="grid gap-2 border-t border-[var(--color-border)] pt-3"><h4 className="font-medium">Transições</h4>{(selectedStage.transitions ?? []).map((transition) => <div key={transition.target} className="grid gap-2 rounded border border-[var(--color-border)] p-2"><div className="flex items-center justify-between gap-2"><span>→ {stages.find((candidate) => candidate.id === transition.target)?.name || transition.target}</span><Button type="button" size="sm" variant="ghost" aria-label={`Remover transição para ${transition.target}`} onClick={() => changeStage(selectedStage.id, { transitions: (selectedStage.transitions ?? []).filter((entry) => entry.target !== transition.target) })} disabled={saving}>Remover</Button></div><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={transition.allowPendingAcceptanceCriteria === true} disabled={saving} onChange={(event) => changeStage(selectedStage.id, { transitions: (selectedStage.transitions ?? []).map((entry) => entry.target === transition.target ? { ...entry, allowPendingAcceptanceCriteria: event.target.checked } : entry) })} />Permitir passagem com critérios de aceite pendentes</label></div>)}{stages.length > 1 ? <div className="grid gap-2"><Label htmlFor="transition-target">Conectar a</Label><Select value={transitionTarget} onValueChange={setTransitionTarget}><SelectTrigger id="transition-target" disabled={saving}><SelectValue placeholder="Escolha um estágio" /></SelectTrigger><SelectContent>{stages.filter((stage) => stage.id !== selectedStage.id && !(selectedStage.transitions ?? []).some((entry) => entry.target === stage.id)).map((stage) => <SelectItem key={stage.id} value={stage.id}>{stage.name || stage.id}</SelectItem>)}</SelectContent></Select><Button type="button" size="sm" variant="secondary" onClick={() => { if (transitionTarget && transitionTarget !== selectedStage.id && stages.some((stage) => stage.id === transitionTarget) && !(selectedStage.transitions ?? []).some((entry) => entry.target === transitionTarget)) { changeStage(selectedStage.id, { transitions: [...(selectedStage.transitions ?? []), { target: transitionTarget }] }); setTransitionTarget(""); } }} disabled={saving || !transitionTarget}>Conectar</Button></div> : null}</div>
						</div> : selectedStage ? <dl className="grid gap-3 text-sm"><div><dt className="text-[var(--color-text-secondary)]">Estágio</dt><dd className="font-medium">{selectedStage.name || selectedStage.id}</dd></div><div><dt className="text-[var(--color-text-secondary)]">ID</dt><dd>{selectedStage.id}</dd></div><div><dt className="text-[var(--color-text-secondary)]">Zona</dt><dd>{selectedStage.zone || "Não definida"}</dd></div><div><dt className="text-[var(--color-text-secondary)]">Posição</dt><dd>{content?.initialStageId === selectedStage.id || referenceStages.length > 0 && selectedStage.zone === "todo" ? "Inicial" : selectedStage.final || referenceStages.length > 0 && selectedStage.zone === "done" ? "Final" : "Intermediário"}</dd></div>{selectedStage.roleIds?.length || selectedStage.allow?.length ? <div><dt className="text-[var(--color-text-secondary)]">Quem atua</dt><dd>{(selectedStage.roleIds ?? selectedStage.allow ?? []).join(", ")}</dd></div> : null}{selectedStage.preferredExecutor ? <div><dt className="text-[var(--color-text-secondary)]">Executor preferencial</dt><dd>{selectedStage.preferredExecutor}</dd></div> : null}{selectedStage.gate ? <div><dt className="text-[var(--color-text-secondary)]">Gate</dt><dd>{typeof selectedStage.gate === "string" ? selectedStage.gate : selectedStage.gate.id}{typeof selectedStage.gate === "object" && selectedStage.gate.type ? ` · ${selectedStage.gate.type}` : ""}</dd></div> : null}{selectedStage.phases?.initialState ? <div><dt className="text-[var(--color-text-secondary)]">Fase inicial</dt><dd>{selectedStage.phases.initialState}</dd></div> : null}</dl> : <p className="text-sm text-[var(--color-text-secondary)]">Selecione um estágio no mapa.</p>}
						</aside>
					</div>
					{editable ? <div className="mt-4 flex flex-wrap items-start justify-between gap-3 rounded-lg border border-[var(--color-border)] p-3 text-sm" aria-label="Estado do rascunho"><div role="status">{dirty ? "● Alterações não salvas; salve para validar" : validation ? validation.valid ? "✓ Estrutura válida para a revisão atual" : `⚠ ${validation.errors.length} problema(s) na estrutura` : "Validação ainda não executada nesta revisão"}{validation?.errors.length ? <ul className="mt-2 list-inside list-disc text-xs text-[var(--color-text-secondary)]">{validation.errors.map((issue, index) => <li key={`${issue.code}-${index}`}>{issue.message}</li>)}</ul> : null}</div><div className="flex flex-wrap items-center gap-2"><span className="text-xs text-[var(--color-text-secondary)]">{published ? `Base v${published.number} · execuções existentes podem permanecer fixadas.` : "Sem base publicada"}</span><Button type="button" size="sm" variant="secondary" onClick={() => openAnalysis("diff")}>Diferenças</Button><Button type="button" size="sm" variant="secondary" onClick={() => openAnalysis("impact")}>Impacto</Button><Button type="button" size="sm" variant="secondary" onClick={() => openAnalysis("simulation")}>Simular direção</Button></div></div> : null}
				</>
			)}
			<Dialog open={historyOpen} onClose={() => setHistoryOpen(false)} title="Histórico de versões"><div className="space-y-3 text-sm">{historyError ? <p role="alert">{historyError}</p> : history === null ? <p>Carregando histórico…</p> : history.length === 0 ? <p>Nenhuma versão publicada.</p> : <ol className="grid gap-2">{history.map((version) => <li key={version.number} className="rounded border border-[var(--color-border)] p-3"><strong>Versão {version.number}</strong>{published?.number === version.number ? " · ativa" : ""}<p className="text-xs text-[var(--color-text-secondary)]">{version.publishedAt ? new Date(version.publishedAt).toLocaleString("pt-BR") : "Data não informada"} · {version.publishedBy || version.createdBy || "Autor não informado"}</p>{version.changeSummary ? <p>{version.changeSummary}</p> : null}<p className="break-all text-xs text-[var(--color-text-secondary)]">Base: {version.basedOnVersionId || "inicial"} · hash: {version.contentHash || "não informado"}{version.restoredFromVersionId ? ` · restaurada de ${version.restoredFromVersionId}` : ""}</p>{version.number !== published?.number ? <Button type="button" size="sm" variant="secondary" className="mt-2" onClick={() => { setRollbackVersion(version); setRollbackReason(""); }}>Reverter para v{version.number}</Button> : null}</li>)}</ol>}</div></Dialog>
			<Dialog open={analysisOpen !== null} onClose={() => setAnalysisOpen(null)} title={analysisOpen === "simulation" ? "Simulação de direção" : analysisOpen === "impact" ? "Impacto da publicação" : "Diferenças para a versão ativa"}><div className="max-h-[60vh] overflow-auto text-sm">{analysisOpen === "simulation" ? <><p className="mb-3 text-[var(--color-text-secondary)]">Prévia somente leitura do alcance e dos gates. Não avalia decisões externas nem move itens.</p><ol className="grid gap-1">{simulateWorkflow(stages, content?.initialStageId).map((line, index) => <li key={index} className="whitespace-pre-wrap">{line}</li>)}</ol></> : analysisOpen === "diff" ? differences.length ? <ol className="grid gap-2">{differences.map((change, index) => <li key={index} className="rounded border border-[var(--color-border)] p-2"><strong>{change.path}</strong><p className="break-all">Antes: {change.before}</p><p className="break-all">Depois: {change.after}</p></li>)}</ol> : <p>Sem diferenças em relação à versão ativa.</p> : impactLoading ? <p role="status">Calculando impacto…</p> : impactError || !impact ? <p role="alert">Não foi possível consultar os itens operacionais. O impacto não está disponível; não publique sem verificá-lo.</p> : <div className="grid gap-3"><p>Itens compatíveis: {impact.compatible.length}</p><p>Execuções fixadas na versão de origem: {impact.pinned.length}</p><p>Itens incompatíveis por estágio ausente: {impact.incompatible.length}</p>{impact.incompatible.length ? <p className="break-all" role="alert">Revise: {impact.incompatible.join(", ")}</p> : null}<p className="text-xs text-[var(--color-text-secondary)]">Estimativa somente leitura baseada nos estágios dos itens atuais; a validação do servidor continua obrigatória.</p></div>}</div></Dialog>
			<Dialog open={rollbackVersion !== null} onClose={() => { if (!rollingBack) setRollbackVersion(null); }} title={`Reverter para v${rollbackVersion?.number ?? ""}`} actions={<><Button type="button" variant="secondary" onClick={() => setRollbackVersion(null)} disabled={rollingBack}>Cancelar</Button><Button type="button" onClick={rollbackPublished} disabled={!rollbackReason.trim() || rollingBack}>{rollingBack ? "Revertendo…" : "Confirmar rollback"}</Button></>}><div className="grid gap-3 text-sm"><p>Uma nova versão publicada será criada a partir da v{rollbackVersion?.number}. A versão atual permanecerá no histórico; execuções fixadas não serão migradas.</p><Label className="grid gap-1">Motivo do rollback<Input value={rollbackReason} onChange={(event) => setRollbackReason(event.target.value)} disabled={rollingBack} /></Label>{saveError ? <p role="alert">{saveError}</p> : null}</div></Dialog>
			<Dialog open={publishOpen} onClose={() => { if (!publishing) setPublishOpen(false); }} title="Publicar nova versão" actions={<><Button type="button" variant="secondary" onClick={() => setPublishOpen(false)} disabled={publishing}>Cancelar</Button><Button type="button" onClick={publishDraft} disabled={!publishReason.trim() || publishing}>{publishing ? "Publicando…" : "Confirmar publicação"}</Button></>}><div className="grid gap-3 text-sm"><p>A publicação passa a orientar novas decisões do fluxo. Execuções já iniciadas podem continuar na versão de origem.</p><Label className="grid gap-1">Motivo da publicação<Input value={publishReason} onChange={(event) => setPublishReason(event.target.value)} disabled={publishing} /></Label>{saveError ? <p role="alert">{saveError}</p> : null}</div></Dialog>
		</div>
	);
}
