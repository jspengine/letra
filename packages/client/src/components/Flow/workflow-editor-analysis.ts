export interface GraphStage {
	id: string;
	name?: string;
	zone?: string;
	order?: number;
	final?: boolean;
	transitions?: Array<{ target: string }>;
	gate?: string | { id: string; type?: string } | null;
}

export interface GraphNode { stage: GraphStage; x: number; y: number }
export interface GraphEdge { from: string; to: string; backward: boolean }

export function layoutWorkflow(stages: GraphStage[], initialStageId?: string): { nodes: GraphNode[]; edges: GraphEdge[]; width: number; height: number } {
	const ordered = [...stages].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
	const ids = new Set(ordered.map((stage) => stage.id));
	const depths = new Map<string, number>();
	const queue = [initialStageId && ids.has(initialStageId) ? initialStageId : ordered[0]?.id].filter((id): id is string => Boolean(id));
	if (queue[0]) depths.set(queue[0], 0);
	while (queue.length) {
		const id = queue.shift()!;
		const stage = ordered.find((candidate) => candidate.id === id);
		for (const transition of stage?.transitions ?? []) {
			if (!ids.has(transition.target) || depths.has(transition.target)) continue;
			depths.set(transition.target, (depths.get(id) ?? 0) + 1);
			queue.push(transition.target);
		}
	}
	let disconnectedDepth = Math.max(0, ...depths.values()) + 1;
	for (const stage of ordered) if (!depths.has(stage.id)) depths.set(stage.id, disconnectedDepth++);
	const rows = new Map<number, number>();
	const nodes = ordered.map((stage) => {
		const depth = depths.get(stage.id)!;
		const row = rows.get(depth) ?? 0;
		rows.set(depth, row + 1);
		return { stage, x: 24 + depth * 244, y: 30 + row * 142 };
	});
	const edges = ordered.flatMap((stage) => (stage.transitions ?? []).filter((transition) => ids.has(transition.target)).map((transition) => ({ from: stage.id, to: transition.target, backward: (depths.get(transition.target) ?? 0) <= (depths.get(stage.id) ?? 0) })));
	return { nodes, edges, width: Math.max(480, 48 + (Math.max(0, ...depths.values()) + 1) * 244), height: Math.max(220, 60 + Math.max(1, ...rows.values()) * 142) };
}

export interface FlowChange { path: string; before: string; after: string }

function display(value: unknown): string {
	if (value === undefined) return "—";
	if (value === null) return "nenhum";
	if (typeof value === "string") return value || "(vazio)";
	return JSON.stringify(value);
}

export function diffWorkflow(before: Record<string, unknown> | null, after: Record<string, unknown>): FlowChange[] {
	if (!before) return [{ path: "Fluxo", before: "Sem versão publicada", after: "Novo rascunho" }];
	const changes: FlowChange[] = [];
	function walk(a: unknown, b: unknown, path: string) {
		if (JSON.stringify(a) === JSON.stringify(b)) return;
		if (Array.isArray(a) || Array.isArray(b)) {
			if (path === "stages" && Array.isArray(a) && Array.isArray(b)) {
				const oldStages = new Map(a.map((stage: { id: string }) => [stage.id, stage]));
				const newStages = new Map(b.map((stage: { id: string }) => [stage.id, stage]));
				for (const id of new Set([...oldStages.keys(), ...newStages.keys()])) walk(oldStages.get(id), newStages.get(id), `estágio ${id}`);
				return;
			}
			changes.push({ path, before: display(a), after: display(b) });
			return;
		}
		if (a && b && typeof a === "object" && typeof b === "object") {
			for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) walk((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key], path ? `${path} › ${key}` : key);
			return;
		}
		changes.push({ path, before: display(a), after: display(b) });
	}
	walk(before, after, "");
	return changes;
}

export function simulateWorkflow(stages: GraphStage[], initialStageId?: string): string[] {
	if (!stages.length) return ["Não há estágios para simular."];
	const byId = new Map(stages.map((stage) => [stage.id, stage]));
	const start = initialStageId && byId.has(initialStageId) ? initialStageId : stages[0].id;
	const visited = new Set<string>();
	const queue = [start];
	const lines: string[] = [];
	while (queue.length) {
		const id = queue.shift()!;
		if (visited.has(id)) continue;
		visited.add(id);
		const stage = byId.get(id)!;
		const gate = typeof stage.gate === "string" ? stage.gate : stage.gate?.id;
		lines.push(`${stage.name || id}${gate ? ` · gate ${gate} (decisão não executada)` : ""}${stage.final ? " · final" : ""}`);
		for (const transition of stage.transitions ?? []) {
			lines.push(`  → ${byId.get(transition.target)?.name || transition.target}${byId.has(transition.target) ? "" : " (destino ausente)"}`);
			if (byId.has(transition.target) && !visited.has(transition.target)) queue.push(transition.target);
		}
	}
	const unreachable = stages.filter((stage) => !visited.has(stage.id));
	if (unreachable.length) lines.push(`Não alcançáveis: ${unreachable.map((stage) => stage.name || stage.id).join(", ")}`);
	return lines;
}

export function workflowImpact(workflow: unknown, nextStageIds: string[]): { compatible: string[]; pinned: string[]; incompatible: string[] } | null {
	if (!workflow || typeof workflow !== "object" || !Array.isArray((workflow as { items?: unknown }).items)) return null;
	const result = { compatible: [] as string[], pinned: [] as string[], incompatible: [] as string[] };
	const ids = new Set(nextStageIds);
	for (const item of (workflow as { items: Array<{ id?: string; stage?: string; workflowVersionId?: string }> }).items) {
		if (!item?.id) continue;
		if (item.workflowVersionId) result.pinned.push(item.id);
		else if (item.stage && !ids.has(item.stage)) result.incompatible.push(item.id);
		else result.compatible.push(item.id);
	}
	return result;
}
