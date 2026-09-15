import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import type { Item, Workflow } from "../commands/flow-init.js";
import { getLetraDir } from "../workspace/resolver.js";
import { loadSessionLog } from "../session-log.js";
import { DEFAULT_CATALOG_CONFIG, type SpecCatalogConfig } from "./config.js";

export const SPEC_CATALOG_SCHEMA_VERSION = "1" as const;
export const SPEC_CATALOG_FILE = "spec-catalog.json" as const;
export const SPEC_DISPOSITIONS_FILE = "spec-dispositions.json" as const;

export type SpecCatalogWorkflowStatus = "active" | "completed" | "unlinked" | "invalid";
export type SpecDisposition = "active" | "consolidated" | "archived";

export interface SpecDispositionRecord {
	specId: string;
	disposition: SpecDisposition;
	canonicalSpecId: string | null;
	rationale: string;
	decidedBy: string;
	decidedAt: string;
	rollbackRef: string;
	preservedPaths: string[];
}

export interface SpecCatalogSpecEntry {
	id: string;
	path: string;
	status: SpecCatalogWorkflowStatus;
	valid: boolean;
	itemIds: string[];
	primaryItemId: string | null;
	stages: string[];
	lastUsedAt: string | null;
	lastUseSource: "session-log" | "unknown";
	disposition: SpecDispositionRecord;
	dependencies: string[];
	direction: {
		relationship: "current-focus" | "workflow-linked" | "unlinked";
		focus: boolean;
		indicators: string[];
	};
	priority: { rank: number; tier: "workspace" | "execution" | "governance" | "adapters" | "supervision" | "history" };
}

export interface SpecCatalogItemEntry {
	id: string;
	description: string;
	stage: string;
	status: "active" | "completed";
	spec: string | null;
	resolvedSpec: string | null;
	consolidatedFrom: string | null;
	specDisposition: SpecDisposition | "missing" | null;
	claimedBy: string | null;
	dependencies: string[];
	priorityRank: number;
}

export interface SpecCatalog {
	schemaVersion: typeof SPEC_CATALOG_SCHEMA_VERSION;
	generatedAt: string;
	source: {
		workflowPath: string;
		specsPath: string;
		focusPath: string;
	};
	currentFocus: { spec: string | null; itemId: string | null };
	dispositionsPath: string;
	specs: SpecCatalogSpecEntry[];
	items: SpecCatalogItemEntry[];
}

export interface SpecCatalogValidationIssue {
	code:
		| "CATALOG_MISSING"
		| "DISPOSITIONS_MISSING"
		| "DISPOSITIONS_INVALID"
		| "DISPOSITION_DUPLICATE"
		| "DISPOSITION_INVALID"
		| "DISPOSITION_NULL_RECORD"
		| "CANONICAL_REFERENCE_BROKEN"
		| "DUPLICATE_CANONICAL"
		| "REVERSIBILITY_MISSING"
		| "ACTIVE_ARCHIVED_REFERENCE"
		| "ITEM_SPEC_MISSING"
		| "SCHEMA_VERSION_UNKNOWN"
		| "CONSOLIDATION_CYCLE"
		| "SPEC_FILE_MISSING"
		| "WORKFLOW_REFERENCE_UNVERIFIED"
		| "CATALOG_STALE";
	message: string;
	specId?: string;
	itemId?: string;
}

export interface SpecCatalogValidationResult {
	valid: boolean;
	issues: SpecCatalogValidationIssue[];
}

export function loadCatalogConfig(root: string): SpecCatalogConfig {
	const configPath = join(getLetraDir(root), "spec-catalog.config.json");
	if (!existsSync(configPath)) return DEFAULT_CATALOG_CONFIG;
	try {
		const raw = JSON.parse(readFileSync(configPath, "utf8")) as Partial<SpecCatalogConfig>;
		return {
			consolidationTargets: raw.consolidationTargets ?? DEFAULT_CATALOG_CONFIG.consolidationTargets,
			canonicalIds: raw.canonicalIds ?? DEFAULT_CATALOG_CONFIG.canonicalIds,
			priorityTiers: raw.priorityTiers ?? DEFAULT_CATALOG_CONFIG.priorityTiers,
		};
	} catch {
		return DEFAULT_CATALOG_CONFIG;
	}
}

function readFocusSpec(root: string): string | null {
	const focusPath = join(getLetraDir(root), "focus.md");
	if (!existsSync(focusPath)) return null;
	const content = readFileSync(focusPath, "utf8");
	return content.match(/^# Focus:\s*([^\r\n]+)/m)?.[1]?.trim() || null;
}

function dependenciesIn(content: string, knownSpecIds: Set<string>, currentId: string): string[] {
	const references = new Set<string>();
	const section = content.match(/^## Dependencies\s*\r?\n([\s\S]*)(?=^## |$)/mi)?.[1] ?? "";
	for (const line of section.split(/\r?\n/)) {
		for (const candidate of knownSpecIds) {
			const escaped = candidate.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
			if (candidate !== currentId && new RegExp(`(?:^|[^a-z0-9-])${escaped}(?![a-z0-9-])`, "i").test(line)) {
				references.add(candidate);
			}
		}
	}
	return [...references].sort();
}

function detectDependencyCycles(specs: SpecCatalogSpecEntry[]): string[][] {
	const graph = new Map<string, string[]>();
	for (const spec of specs) graph.set(spec.id, spec.dependencies);
	const cycles: string[][] = [];
	for (const [id, deps] of graph) {
		for (const dep of deps) {
			const visited = new Set<string>();
			let current: string | undefined = dep;
			while (current) {
				if (current === id) {
					cycles.push([...visited, id]);
					break;
				}
				if (visited.has(current)) break;
				visited.add(current);
				current = graph.get(current)?.find((d) => d !== current) ?? undefined;
			}
		}
	}
	return cycles;
}

function orderByDependencies(specs: SpecCatalogSpecEntry[]): SpecCatalogSpecEntry[] {
	const graph = new Map<string, { spec: SpecCatalogSpecEntry; inDegree: number }>();
	for (const spec of specs) graph.set(spec.id, { spec, inDegree: 0 });
	for (const spec of specs) {
		for (const dep of spec.dependencies) {
			const node = graph.get(dep);
			if (node) node.inDegree++;
		}
	}
	const sorted: SpecCatalogSpecEntry[] = [];
	const queue = [...graph.entries()].filter(([, n]) => n.inDegree === 0).sort((a, b) => a[1].spec.priority.rank - b[1].spec.priority.rank || a[0].localeCompare(b[0]));
	while (queue.length > 0) {
		const [id, node] = queue.shift()!;
		sorted.push(node.spec);
		for (const spec of specs) {
			if (spec.dependencies.includes(id)) {
				const neighbor = graph.get(spec.id)!;
				neighbor.inDegree--;
				if (neighbor.inDegree === 0) queue.push([spec.id, neighbor]);
			}
		}
		queue.sort((a, b) => a[1].spec.priority.rank - b[1].spec.priority.rank || a[0].localeCompare(b[0]));
	}
	return sorted.length === specs.length ? sorted : [...specs];
}

function directionMarkers(content: string): string[] {
	const markers = [
		"governance",
		"human gate",
		"human",
		"agent",
		"handoff",
		"evidence",
		"executor",
		"workspace",
		"workflow",
	];
	const lower = content.toLocaleLowerCase();
	return markers.filter((marker) => lower.includes(marker));
}

function itemStatus(workflow: Workflow | null, item: Item): "active" | "completed" {
	const stage = workflow?.stages.find((candidate) => candidate.id === item.stage);
	return stage?.zone === "done" || item.stage === "done" ? "completed" : "active";
}

function pathFor(root: string): string {
	return join(getLetraDir(root), SPEC_CATALOG_FILE);
}

function dispositionsPathFor(root: string): string {
	return join(getLetraDir(root), SPEC_DISPOSITIONS_FILE);
}

function readDispositions(root: string): Record<string, SpecDispositionRecord> {
	const path = dispositionsPathFor(root);
	if (!existsSync(path)) return {};
	try {
		const parsed = JSON.parse(readFileSync(path, "utf8")) as { records?: SpecDispositionRecord[] };
		return Object.fromEntries((parsed.records ?? []).filter((record) =>
			record && typeof record.specId === "string" &&
			["active", "consolidated", "archived"].includes(record.disposition),
		).map((record) => [record.specId, record]));
	} catch {
		return {};
	}
}

function defaultDisposition(id: string, linked: Item[], canonicalIds: Set<string>, config: SpecCatalogConfig): SpecDispositionRecord {
	const target = config.consolidationTargets[id];
	if (target) {
		return {
			specId: id,
			disposition: "consolidated",
			canonicalSpecId: target,
			rationale: `Consolidada na capability canônica ${target}, preservando esta spec como histórico rastreável.`,
			decidedBy: "spec-governance-hygiene",
			decidedAt: new Date().toISOString(),
			rollbackRef: `specs/${id}`,
			preservedPaths: [`specs/${id}/spec.md`, `specs/${id}/acceptance.md`],
		};
	}
	const hasActiveItem = linked.some((item) => itemStatus(null, item) === "active" && item.stage !== "done");
	const canonical = canonicalIds.has(id);
	const disposition: SpecDisposition = hasActiveItem || canonical ? "active" : "archived";
	const rationale = hasActiveItem
		? "Mantida porque possui trabalho ativo no workflow vigente."
		: canonical
			? "Mantida como spec canônica da capability na direção vigente."
			: "Preservada como histórico; não há trabalho ativo vinculado na direção vigente.";
	return {
		specId: id,
		disposition,
		canonicalSpecId: canonical ? id : null,
		rationale,
		decidedBy: "spec-governance-hygiene",
		decidedAt: new Date().toISOString(),
		rollbackRef: `specs/${id}`,
		preservedPaths: [`specs/${id}/spec.md`, `specs/${id}/acceptance.md`],
	};
}

function priorityFor(id: string, disposition: SpecDisposition, config: SpecCatalogConfig): { rank: number; tier: SpecCatalogSpecEntry["priority"]["tier"] } {
	if (disposition === "archived") return { rank: 6, tier: "history" };
	for (const tier of config.priorityTiers) {
		if (tier.specIds.includes(id)) return { rank: tier.rank, tier: tier.tier };
	}
	return { rank: 5, tier: "supervision" };
}

function ensureDispositions(root: string, ids: string[], linkedItems: Map<string, Item[]>, config: SpecCatalogConfig): Record<string, SpecDispositionRecord> {
	const existing = readDispositions(root);
	const canonicalIds = new Set(config.canonicalIds);
	const records = { ...existing };
	for (const id of ids) {
		if (!records[id] || records[id].decidedBy === "spec-governance-hygiene") {
			records[id] = defaultDisposition(id, linkedItems.get(id) ?? [], canonicalIds, config);
		}
	}
	return records;
}

function writeDispositions(root: string, records: Record<string, SpecDispositionRecord>): void {
	const path = dispositionsPathFor(root);
	mkdirSync(join(path, ".."), { recursive: true });
	const content = `${JSON.stringify({ schemaVersion: SPEC_CATALOG_SCHEMA_VERSION, records: Object.values(records).sort((a, b) => a.specId.localeCompare(b.specId)) }, null, 2)}\n`;
	const tmpPath = `${path}.tmp.${Date.now()}`;
	try {
		writeFileSync(tmpPath, content, "utf8");
		renameSync(tmpPath, path);
	} catch (err) {
		try { unlinkSync(tmpPath); } catch { /* ignore cleanup error */ }
		throw err;
	}
}

export function buildSpecCatalog(root: string, workflow: Workflow | null, options?: { config?: SpecCatalogConfig }): SpecCatalog {
	const config = options?.config ?? loadCatalogConfig(root);
	const letraDir = getLetraDir(root);
	const specsDir = join(letraDir, "specs");
	const focusSpec = readFocusSpec(root);
	const focusItem = workflow?.items.find((item) => item.spec === focusSpec)?.id ?? null;
	const items = workflow?.items ?? [];
	const directories = existsSync(specsDir)
		? readdirSync(specsDir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()
		: [];
	const knownSpecIds = new Set([
		...directories,
		...items.map((item) => item.spec).filter((id): id is string => Boolean(id)),
	]);
	const allSpecIds = [...knownSpecIds].sort();
	const lastUseByItem = new Map<string, string>();
	for (const entry of loadSessionLog(root).entries) {
		if (!entry.itemId || !Number.isFinite(Date.parse(entry.timestamp))) continue;
		const previous = lastUseByItem.get(entry.itemId);
		if (!previous || Date.parse(entry.timestamp) > Date.parse(previous)) {
			lastUseByItem.set(entry.itemId, new Date(entry.timestamp).toISOString());
		}
	}
	const linkedItems = new Map<string, Item[]>();
	for (const item of items) {
		if (!item.spec) continue;
		const current = linkedItems.get(item.spec) ?? [];
		current.push(item);
		linkedItems.set(item.spec, current);
	}
	const dispositions = ensureDispositions(root, allSpecIds, linkedItems, config);

	const specs = orderByDependencies(allSpecIds.map((id): SpecCatalogSpecEntry => {
		const specPath = join(specsDir, id, "spec.md");
		const valid = existsSync(specPath);
		const content = valid ? readFileSync(specPath, "utf8") : "";
		const linked = linkedItems.get(id) ?? [];
		const stages = [...new Set(linked.map((item) => item.stage))].sort();
		const active = linked.some((item) => itemStatus(workflow, item) === "active");
		const lastUsedCandidates = linked.map((item) => lastUseByItem.get(item.id)).filter((value): value is string => Boolean(value));
		const lastUsedAt = lastUsedCandidates.sort((left, right) => Date.parse(right) - Date.parse(left))[0] ?? null;
		const focus = id === focusSpec;
		const relationship = focus ? "current-focus" : linked.length > 0 ? "workflow-linked" : "unlinked";
		const primaryItemId = linked.length > 0
			? linked.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))[0].id
			: null;
		return {
			id,
			path: `.letra/specs/${id}/spec.md`,
			status: !valid ? "invalid" : active ? "active" : linked.length > 0 ? "completed" : "unlinked",
			valid,
			itemIds: linked.map((item) => item.id).sort(),
			primaryItemId,
			stages,
			lastUsedAt,
			lastUseSource: lastUsedAt ? "session-log" : "unknown",
			disposition: dispositions[id],
			dependencies: dependenciesIn(content, knownSpecIds, id),
			direction: { relationship, focus, indicators: directionMarkers(content) },
			priority: priorityFor(id, dispositions[id].disposition, config),
		};
	}));

	return {
		schemaVersion: SPEC_CATALOG_SCHEMA_VERSION,
		generatedAt: new Date().toISOString(),
		source: {
			workflowPath: `.letra/workflow.json`,
			specsPath: `.letra/specs/`,
			focusPath: `.letra/focus.md`,
		},
		currentFocus: { spec: focusSpec, itemId: focusItem },
		dispositionsPath: `.letra/${SPEC_DISPOSITIONS_FILE}`,
		specs,
		items: items.map((item): SpecCatalogItemEntry => {
			const itemSpec = item.spec;
			const disposition = itemSpec ? dispositions[itemSpec] : undefined;
			const resolved = disposition?.canonicalSpecId ?? itemSpec ?? null;
			const isConsolidated = disposition?.disposition === "consolidated" && disposition?.canonicalSpecId;
			const deps: string[] = [];
			if (itemSpec && knownSpecIds.has(itemSpec)) deps.push(itemSpec);
			if (isConsolidated && resolved && resolved !== itemSpec && knownSpecIds.has(resolved)) deps.push(resolved);
			return {
				id: item.id,
				description: item.description,
				stage: item.stage,
				status: itemStatus(workflow, item),
				spec: itemSpec ?? null,
				resolvedSpec: resolved,
				consolidatedFrom: isConsolidated ? itemSpec ?? null : null,
				specDisposition: itemSpec ? (directories.includes(itemSpec) ? (disposition?.disposition ?? "missing") : "missing") : null,
				claimedBy: item.claimedBy ?? null,
				dependencies: deps,
				priorityRank: priorityFor(itemSpec ?? "", itemSpec ? (disposition?.disposition ?? "archived") : "archived", config).rank,
			};
		}),
	};
}

export function writeSpecCatalog(root: string, workflow: Workflow | null): SpecCatalog {
	const config = loadCatalogConfig(root);
	const destination = pathFor(root);
	mkdirSync(join(destination, ".."), { recursive: true });
	const catalog = buildSpecCatalog(root, workflow, { config });
	// Write dispositions first so catalog mtime >= dispositions mtime (avoids CATALOG_STALE)
	const letraDir = getLetraDir(root);
	const specsDir = join(letraDir, "specs");
	const directories = existsSync(specsDir)
		? readdirSync(specsDir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()
		: [];
	const knownSpecIds = new Set([
		...directories,
		...(workflow?.items ?? []).map((item) => item.spec).filter((id): id is string => Boolean(id)),
	]);
	const linkedItems = new Map<string, Item[]>();
	for (const item of workflow?.items ?? []) {
		if (!item.spec) continue;
		const current = linkedItems.get(item.spec) ?? [];
		current.push(item);
		linkedItems.set(item.spec, current);
	}
	const dispositions = ensureDispositions(root, [...knownSpecIds].sort(), linkedItems, config);
	writeDispositions(root, dispositions);
	// Update generatedAt to be after dispositions write so CATALOG_STALE check passes
	catalog.generatedAt = new Date().toISOString();
	// Write catalog AFTER dispositions so its mtime is always >=
	writeFileSync(destination, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
	return catalog;
}

export function readSpecCatalog(root: string): SpecCatalog | null {
	const path = pathFor(root);
	if (!existsSync(path)) return null;
	try {
		return JSON.parse(readFileSync(path, "utf8")) as SpecCatalog;
	} catch {
		return null;
	}
}

/** Validate the catalog and disposition registry without mutating either file. */
export function validateSpecCatalog(root: string, workflow: Workflow | null = null): SpecCatalogValidationResult {
	const issues: SpecCatalogValidationIssue[] = [];
	const letraDir = getLetraDir(root);
	const specsDir = join(letraDir, "specs");
	const workflowItems = workflow?.items ?? [];
	const directories = existsSync(specsDir)
		? readdirSync(specsDir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name)
		: [];
	const knownIds = new Set([...directories, ...workflowItems.map((item) => item.spec).filter((id): id is string => Boolean(id))]);

	const catalogPath = pathFor(root);
	const catalogExists = existsSync(catalogPath);
	const dispositionPath = dispositionsPathFor(root);
	const dispositionsExist = existsSync(dispositionPath);
	// Existing workspaces may not have opted into catalog generation yet. Keep
	// validation backward-compatible until the first catalog is materialized.
	if (!catalogExists && !dispositionsExist) return { valid: true, issues };
	if (!catalogExists) issues.push({ code: "CATALOG_MISSING", message: "spec-catalog.json não existe; gere com 'letra spec catalog'." });
	if (!dispositionsExist) issues.push({ code: "DISPOSITIONS_MISSING", message: "spec-dispositions.json não existe." });

	let records: unknown[] = [];
	if (existsSync(dispositionPath)) {
		try {
			const parsed = JSON.parse(readFileSync(dispositionPath, "utf8")) as { records?: unknown; schemaVersion?: unknown };
			if (typeof parsed.schemaVersion === "string" && parsed.schemaVersion !== SPEC_CATALOG_SCHEMA_VERSION) {
				issues.push({ code: "SCHEMA_VERSION_UNKNOWN", message: `Versão de schema desconhecida: ${parsed.schemaVersion}. Esperado ${SPEC_CATALOG_SCHEMA_VERSION}.` });
			}
			if (!Array.isArray(parsed.records)) {
				issues.push({ code: "DISPOSITIONS_INVALID", message: "Registro de disposições não contém um array records." });
			} else {
				for (let i = 0; i < parsed.records.length; i++) {
					if (parsed.records[i] === null || parsed.records[i] === undefined) {
						issues.push({ code: "DISPOSITION_NULL_RECORD", message: `Registro nulo ou indefinido no índice ${i}.` });
					}
				}
				records = parsed.records.filter((r: unknown) => r != null);
			}
		} catch {
			issues.push({ code: "DISPOSITIONS_INVALID", message: "Registro de disposições contém JSON inválido." });
		}
	}

	const seen = new Set<string>();
	const canonicalClaims = new Map<string, string>();
	const recordById = new Map<string, SpecDispositionRecord>();
	for (const raw of records) {
		const record = raw as Partial<SpecDispositionRecord>;
		const id = typeof record.specId === "string" ? record.specId : "";
		if (!id) {
			issues.push({ code: "DISPOSITION_INVALID", message: "Disposição sem specId." });
			continue;
		}
		if (seen.has(id)) issues.push({ code: "DISPOSITION_DUPLICATE", message: `specId duplicado no registro: ${id}.`, specId: id });
		seen.add(id);
		if (!["active", "consolidated", "archived"].includes(record.disposition ?? "")) {
			issues.push({ code: "DISPOSITION_INVALID", message: `Disposição inválida para ${id}.`, specId: id });
			continue;
		}
		const disposition = record.disposition as SpecDisposition;
		const canonical = typeof record.canonicalSpecId === "string" ? record.canonicalSpecId : null;
		if (canonical && !knownIds.has(canonical)) {
			issues.push({ code: "CANONICAL_REFERENCE_BROKEN", message: `${id} aponta para spec canônica inexistente: ${canonical}.`, specId: id });
		}
		if (disposition === "consolidated" && canonical) {
			const previous = canonicalClaims.get(canonical);
			if (previous && previous !== id) {
				// Consolidated aliases intentionally share a target; only active records
				// are canonical claims and therefore subject to duplicate detection.
			}
		}
		if (disposition === "active" && canonical) {
			const previous = canonicalClaims.get(canonical);
			if (previous && previous !== id) issues.push({ code: "DUPLICATE_CANONICAL", message: `Specs ativas ${previous} e ${id} declaram a mesma canonical ${canonical}.`, specId: id });
			else canonicalClaims.set(canonical, id);
		}
		if (!record.rollbackRef || !Array.isArray(record.preservedPaths) || record.preservedPaths.length === 0) {
			issues.push({ code: "REVERSIBILITY_MISSING", message: `${id} não possui rollbackRef e preservedPaths completos.`, specId: id });
		}
		if (typeof record.specId === "string") recordById.set(id, record as SpecDispositionRecord);
	}

	for (const id of knownIds) {
		if (!recordById.has(id)) issues.push({ code: "DISPOSITION_INVALID", message: `Spec ${id} não possui disposição registrada.`, specId: id });
	}
	for (const record of recordById.values()) {
		if (record.disposition === "consolidated" && record.canonicalSpecId) {
			const target = recordById.get(record.canonicalSpecId);
			if (!target || target.disposition !== "active") issues.push({ code: "CANONICAL_REFERENCE_BROKEN", message: `${record.specId} consolidada sem destino ativo: ${record.canonicalSpecId}.`, specId: record.specId });
		}
	}

	const catalog = readSpecCatalog(root);
	if (catalog && typeof catalog.schemaVersion === "string" && catalog.schemaVersion !== SPEC_CATALOG_SCHEMA_VERSION) {
		issues.push({ code: "SCHEMA_VERSION_UNKNOWN", message: `Catálogo contém versão de schema desconhecida: ${catalog.schemaVersion}. Esperado ${SPEC_CATALOG_SCHEMA_VERSION}.` });
	}

	for (const dir of directories) {
		const specFile = join(specsDir, dir, "spec.md");
		if (!existsSync(specFile)) {
			issues.push({ code: "SPEC_FILE_MISSING", message: `Diretório de spec ${dir} existe mas não contém spec.md.`, specId: dir });
		}
	}

	const consolidationGraph = new Map<string, string>();
	for (const [id, target] of Object.entries(loadCatalogConfig(root).consolidationTargets)) {
		if (id !== target) consolidationGraph.set(id, target);
	}
	for (const [id, target] of consolidationGraph) {
		const visited = new Set<string>();
		let current: string | undefined = id;
		while (current) {
			if (visited.has(current)) {
				issues.push({ code: "CONSOLIDATION_CYCLE", message: `Ciclo de consolidação detectado começando em ${id}.`, specId: id });
				break;
			}
			visited.add(current);
			current = consolidationGraph.get(current);
			if (current === id) {
				issues.push({ code: "CONSOLIDATION_CYCLE", message: `Ciclo de consolidação detectado: ${id} → ... → ${current}.`, specId: id });
				break;
			}
		}
	}

	if (catalog) {
		const depGraph = new Map<string, string[]>();
		for (const spec of catalog.specs) depGraph.set(spec.id, spec.dependencies);
		for (const [id, deps] of depGraph) {
			for (const dep of deps) {
				const visited = new Set<string>();
				let current: string | undefined = dep;
				while (current) {
					if (current === id) {
						issues.push({ code: "CONSOLIDATION_CYCLE", message: `Ciclo de dependências detectado: ${id} → ... → ${dep}.`, specId: id });
						break;
					}
					if (visited.has(current)) break;
					visited.add(current);
					current = depGraph.get(current)?.find((d) => d !== current) ?? undefined;
				}
			}
		}
	}

	for (const item of workflowItems) {
		if (!item.spec) continue;
		const record = recordById.get(item.spec);
		if (!record || !knownIds.has(item.spec)) {
			issues.push({ code: "ITEM_SPEC_MISSING", message: `${item.id} aponta para spec ausente ou não catalogada: ${item.spec}.`, itemId: item.id, specId: item.spec });
			continue;
		}
		const specDir = join(specsDir, item.spec);
		if (!existsSync(specDir) || !existsSync(join(specDir, "spec.md"))) {
			issues.push({ code: "WORKFLOW_REFERENCE_UNVERIFIED", message: `${item.id} referencia ${item.spec} mas o spec.md não existe no disco.`, itemId: item.id, specId: item.spec });
		}
		if (itemStatus(workflow, item) === "active" && record.disposition === "archived") {
			issues.push({ code: "ACTIVE_ARCHIVED_REFERENCE", message: `${item.id} ativo aponta para spec arquivada: ${item.spec}.`, itemId: item.id, specId: item.spec });
		}
	}
	if (catalog) {
		for (const item of catalog.items) {
			if (item.spec && item.specDisposition === "missing") issues.push({ code: "ITEM_SPEC_MISSING", message: `${item.id} está sem resolução no catálogo: ${item.spec}.`, itemId: item.id, specId: item.spec });
		}
	}

	if (catalog && existsSync(dispositionPath)) {
		try {
			const catalogMtime = Date.parse(catalog.generatedAt);
			const dispStat = statSync(dispositionPath);
			const dispMtime = dispStat.mtimeMs;
			// Allow 2s tolerance for filesystem timestamp resolution and concurrent automation writes
			const STALE_TOLERANCE_MS = 2000;
			if (dispMtime > catalogMtime + STALE_TOLERANCE_MS) {
				issues.push({ code: "CATALOG_STALE", message: "spec-dispositions.json foi modificado após a geração do catálogo. Regenere com 'letra spec catalog'." });
			}
			const workflowPath = join(getLetraDir(root), "workflow.json");
			if (existsSync(workflowPath)) {
				const wfStat = statSync(workflowPath);
				if (wfStat.mtimeMs > catalogMtime + STALE_TOLERANCE_MS) {
					issues.push({ code: "CATALOG_STALE", message: "workflow.json foi modificado após a geração do catálogo. Regenere com 'letra spec catalog'." });
				}
			}
		} catch {
			// stat failures are non-fatal
		}
	}

	return { valid: issues.length === 0, issues };
}

export function specCatalogPath(root: string): string {
	return relative(root, pathFor(root));
}

export function restoreDisposition(root: string, specId: string): SpecDispositionRecord | null {
	const records = readDispositions(root);
	const record = records[specId];
	if (!record) return null;
	const restored: SpecDispositionRecord = {
		...record,
		disposition: "active",
		canonicalSpecId: specId,
		rationale: `Restaurada de ${record.disposition} para active em ${new Date().toISOString()}.`,
		decidedBy: "spec-governance-hygiene",
		decidedAt: new Date().toISOString(),
		rollbackRef: record.rollbackRef || `specs/${specId}`,
		preservedPaths: record.preservedPaths.length > 0 ? record.preservedPaths : [`specs/${specId}/spec.md`, `specs/${specId}/acceptance.md`],
	};
	const updated = { ...records, [specId]: restored };
	writeDispositions(root, updated);
	return restored;
}
