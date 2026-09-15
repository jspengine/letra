import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Item } from "../commands/flow-init.js";
import type { Policy } from "../harness/types.js";
import { getLetraDir, resolveWorkspaceRoot } from "../workspace/resolver.js";

export type SecuritySeverity = "critical" | "high" | "moderate" | "low" | "info";

export interface SecurityBaseline {
	version: "1";
	capturedAt: string;
	gitRevision: string | null;
	packageLockSha256: string | null;
	files: Record<string, string>;
	dependencies: Record<string, string>;
	fileSnapshotComplete?: boolean;
	dependencySnapshotComplete?: boolean;
	/** Hashes of every supported lockfile captured before Code. */
	lockfileHashes?: Record<string, string>;
	dependencyManager?: "npm" | "yarn" | "pnpm" | "unknown";
	fingerprint?: string;
}

export interface SecurityReviewContext {
	itemId: string;
	specId: string | null;
	/** Source tree inspected by Security (distinct from the Letra data directory). */
	executionRoot?: string;
	acceptanceCriteria: string[];
	changedFiles: string[];
	changedDependencies: string[];
	baseline: SecurityBaseline;
	workspaceFingerprint?: string;
	scopeFingerprint?: string;
	dependencyPaths?: Record<string, string[]>;
}

export interface SecurityFindingInput {
	id?: string;
	severity: SecuritySeverity;
	package?: string;
	file?: string;
	advisory?: string;
	evidence: string[];
	introduced?: boolean;
	relatedToSpec?: boolean;
	reachable?: boolean | "unknown";
	source?: "dependency" | "secret" | "configuration" | "code" | "global";
}

export interface SecurityFinding extends SecurityFindingInput {
	id: string;
	introduced: boolean;
	relatedToSpec: boolean;
	reachable: boolean | "unknown";
	source: NonNullable<SecurityFindingInput["source"]>;
}

export interface SecurityReviewReport {
	schemaVersion: "1";
	generatedAt: string;
	context: SecurityReviewContext;
	findings: SecurityFinding[];
	globalFindings: SecurityFinding[];
	blockingFindings: SecurityFinding[];
	decision: "clear" | "blocked" | "needs-review";
	scanErrors?: string[];
	expiresAt: string;
	workspaceFingerprint: string;
	scopeFingerprint: string;
	scannerEvidence: SecurityScannerEvidence[];
	/** Integrity seal over all report fields except this seal. */
	reportFingerprint: string;
	reasonCode:
		| "SECURITY_SCOPED_CLEAR"
		| "SECURITY_SCOPED_BLOCKED"
		| "SECURITY_REVIEW_REQUIRED"
		| "SECURITY_BASELINE_INVALID"
		| "SECURITY_SCAN_FAILED";
}

export interface SecurityScannerEvidence {
	name: string;
	command: string;
	version: string | null;
	scope: string[];
	outcome: "completed" | "failed";
	details?: string;
}

export interface SecurityPolicy {
	blockOnCritical: boolean;
	blockOnHigh: boolean;
}

export interface SecurityBaselineInput {
	gitRevision?: string | null;
	packageLockSha256?: string | null;
	files?: Record<string, string>;
	dependencies?: Record<string, string>;
}

const BLOCKING_SEVERITIES = new Set<SecuritySeverity>(["critical", "high"]);

function sha256(value: string | Uint8Array): string {
	return createHash("sha256").update(value).digest("hex");
}

function stableMap(value: Record<string, string>): string {
	return JSON.stringify(Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))));
}

function baselineFingerprint(input: Pick<SecurityBaseline, "version" | "gitRevision" | "packageLockSha256" | "files" | "dependencies" | "fileSnapshotComplete" | "dependencySnapshotComplete">): string {
	return sha256(JSON.stringify({
		version: input.version,
		gitRevision: input.gitRevision,
		packageLockSha256: input.packageLockSha256,
		files: stableMap(input.files),
		dependencies: stableMap(input.dependencies),
		fileSnapshotComplete: input.fileSnapshotComplete,
		dependencySnapshotComplete: input.dependencySnapshotComplete,
		lockfileHashes: (input as SecurityBaseline).lockfileHashes ? stableMap((input as SecurityBaseline).lockfileHashes!) : undefined,
		dependencyManager: (input as SecurityBaseline).dependencyManager,
	}));
}

function workspaceFingerprint(root: string): string {
	return sha256(resolve(root).replaceAll("\\", "/").toLowerCase());
}

const LOCKFILES = ["package-lock.json", "npm-shrinkwrap.json", "yarn.lock", "pnpm-lock.yaml"] as const;
type DependencyManager = "npm" | "yarn" | "pnpm" | "unknown";
interface DependencySnapshot {
	map: Record<string, string>;
	graph: Record<string, string[]>;
	manager: DependencyManager;
	lockfileHashes: Record<string, string>;
	complete: boolean;
	error?: string;
}

function lockfileManager(filename: string): DependencyManager {
	if (filename === "yarn.lock") return "yarn";
	if (filename === "pnpm-lock.yaml") return "pnpm";
	if (filename === "package-lock.json" || filename === "npm-shrinkwrap.json") return "npm";
	return "unknown";
}

function packageNameFromLockKey(value: string): string {
	let key = value.trim().replace(/^['"]|['"]$/g, "").replace(/^\//, "");
	if (key.startsWith("node_modules/")) key = key.slice("node_modules/".length);
	if (key.startsWith("@")) {
		const slash = key.indexOf("/");
		const at = slash < 0 ? -1 : key.indexOf("@", slash + 1);
		return at > 0 ? key.slice(0, at) : key;
	}
	const at = key.indexOf("@");
	return at > 0 ? key.slice(0, at) : key;
}

function addGraphEdge(graph: Record<string, string[]>, name: string, dependencies: string[]): void {
	if (!name) return;
	graph[name] = [...new Set([...(graph[name] ?? []), ...dependencies.filter(Boolean).map(packageNameFromLockKey)])];
}

function parseNpmLock(raw: string): { map: Record<string, string>; graph: Record<string, string[]> } {
	const parsed = JSON.parse(raw) as {
		packages?: Record<string, { name?: string; version?: string; dependencies?: Record<string, string>; optionalDependencies?: Record<string, string>; peerDependencies?: Record<string, string> }>;
		dependencies?: Record<string, { version?: string; dependencies?: Record<string, unknown>; optionalDependencies?: Record<string, unknown> }>;
	};
	const map: Record<string, string> = {};
	const graph: Record<string, string[]> = {};
	for (const [pathName, pkg] of Object.entries(parsed.packages ?? {})) {
		if (!pathName.startsWith("node_modules/")) continue;
		const name = pkg.name ?? packageNameFromLockKey(pathName.slice(pathName.lastIndexOf("node_modules/") + "node_modules/".length));
		if (pkg.version) map[name] = pkg.version;
		addGraphEdge(graph, name, Object.keys({ ...pkg.dependencies, ...pkg.optionalDependencies, ...pkg.peerDependencies }));
	}
	function walk(dependencies: Record<string, { version?: string; dependencies?: Record<string, unknown>; optionalDependencies?: Record<string, unknown> }>): void {
		for (const [name, pkg] of Object.entries(dependencies)) {
			if (pkg.version) map[name] ??= pkg.version;
			addGraphEdge(graph, name, Object.keys({ ...pkg.dependencies, ...pkg.optionalDependencies }));
			walk((pkg.dependencies ?? {}) as Record<string, { version?: string; dependencies?: Record<string, unknown>; optionalDependencies?: Record<string, unknown> }>);
		}
	}
	walk(parsed.dependencies ?? {});
	return { map, graph };
}

function yarnSelectorNames(value: string): string[] {
	return value.split(/,\s*/).map((selector) => selector.trim().replace(/^['"]|['"]$/g, "")).map(packageNameFromLockKey).filter(Boolean);
}

function parseYarnLock(raw: string): { map: Record<string, string>; graph: Record<string, string[]> } {
	const map: Record<string, string> = {};
	const graph: Record<string, string[]> = {};
	let names: string[] = [];
	let dependencySection = false;
	for (const line of raw.split(/\r?\n/)) {
		if (!line.trim() || line.trimStart().startsWith("#")) continue;
		if (!/^\s/.test(line) && line.trimEnd().endsWith(":")) {
			names = yarnSelectorNames(line.trimEnd().slice(0, -1));
			dependencySection = false;
			continue;
		}
		if (!names.length) continue;
		const version = /^\s+version\s+["']?([^"'\s]+)["']?/.exec(line)?.[1];
		if (version) for (const name of names) map[name] ??= version;
		if (/^\s+dependencies:\s*$/.test(line)) { dependencySection = true; continue; }
		if (dependencySection) {
			const dependency = /^\s{4,}["']?([^"'\s:]+(?:\/[^"'\s:]+)?)["']?(?:\s+|:)/.exec(line);
			if (dependency) for (const name of names) addGraphEdge(graph, name, [dependency[1]]);
			else if (/^\s{2}\S/.test(line)) dependencySection = false;
		}
	}
	return { map, graph };
}

function parsePnpmLock(raw: string): { map: Record<string, string>; graph: Record<string, string[]> } {
	const map: Record<string, string> = {};
	const graph: Record<string, string[]> = {};
	let section = "";
	let current = "";
	let dependencySection = false;
	for (const line of raw.split(/\r?\n/)) {
		const sectionMatch = /^(packages|snapshots):\s*$/.exec(line.trim());
		if (sectionMatch && !/^\s/.test(line)) { section = sectionMatch[1]; current = ""; dependencySection = false; continue; }
		if (!section) continue;
		const entry = /^\s{2}(['"]?[^\s:#][^:]*?)['"]?:\s*$/.exec(line);
		if (entry) { current = packageNameFromLockKey(entry[1]); dependencySection = false; continue; }
		if (!current) continue;
		const version = /^\s{4}version:\s*["']?([^"'\s]+)["']?/.exec(line)?.[1];
		if (version && section === "packages") map[current] ??= version;
		if (/^\s{4}(?:dependencies|optionalDependencies|peerDependencies):\s*$/.test(line)) { dependencySection = true; continue; }
		if (dependencySection) {
			const dependency = /^\s{6}(['"]?[^\s:#]+)['"]?:/.exec(line)?.[1];
			if (dependency) addGraphEdge(graph, current, [dependency]);
			else if (/^\s{4}\S/.test(line)) dependencySection = false;
		}
	}
	return { map, graph };
}

export function readDependencySnapshot(root: string): DependencySnapshot {
	const present = LOCKFILES.filter((file) => existsSync(join(root, file)));
	if (!present.length) return { map: {}, graph: {}, manager: "unknown", lockfileHashes: {}, complete: false, error: "Nenhum lockfile suportado foi encontrado." };
	const map: Record<string, string> = {};
	const graph: Record<string, string[]> = {};
	const lockfileHashes: Record<string, string> = {};
	let manager: DependencyManager = "unknown";
	try {
		for (const filename of present) {
			const raw = readFileSync(join(root, filename), "utf8");
			if (!raw.trim()) throw new Error(`${filename} vazio`);
			lockfileHashes[filename] = sha256(raw);
			const parsed = filename.endsWith(".json") ? parseNpmLock(raw) : filename === "yarn.lock" ? parseYarnLock(raw) : parsePnpmLock(raw);
			Object.assign(map, parsed.map);
			for (const [name, deps] of Object.entries(parsed.graph)) addGraphEdge(graph, name, deps);
			manager = manager === "unknown" ? lockfileManager(filename) : manager;
		}
		if (!Object.keys(map).length) throw new Error("lockfile não produziu mapa de dependências");
		return { map, graph, manager, lockfileHashes, complete: true };
	} catch (error) {
		return { map, graph, manager, lockfileHashes, complete: false, error: error instanceof Error ? error.message : String(error) };
	}
}

function readDependencyMap(root: string): Record<string, string> { return readDependencySnapshot(root).map; }

function git(root: string, args: string[]): string | null {
	try {
		return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() || null;
	} catch {
		return null;
	}
}

function gitList(root: string, args: string[]): { ok: boolean; files: string[] } {
	try {
		const output = execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
		return { ok: true, files: output.split(/\r?\n/).map((entry) => entry.trim()).filter(Boolean) };
	} catch {
		return { ok: false, files: [] };
	}
}

function trackedFiles(root: string): string[] {
	const result = gitList(root, ["ls-files"]);
	if (!result.ok) throw new Error("Git não está disponível ou o diretório não é um repositório.");
	return result.files;
}

function workspaceFiles(root: string): string[] {
	const tracked = trackedFiles(root);
	const untrackedResult = gitList(root, ["ls-files", "--others", "--exclude-standard"]);
	if (!untrackedResult.ok) throw new Error("Git não conseguiu enumerar arquivos não rastreados.");
	const untracked = untrackedResult.files;
	const required = ["package.json", "package-lock.json", "npm-shrinkwrap.json", "pnpm-lock.yaml", "yarn.lock"]
		.filter((file) => existsSync(join(root, file)));
	return [...new Set([...tracked, ...untracked, ...required])];
}

function fileSnapshot(root: string): { files: Record<string, string>; complete: boolean; error?: string } {
	const result: Record<string, string> = {};
	let files: string[];
	try { files = workspaceFiles(root); } catch (error) {
		return { files: {}, complete: false, error: error instanceof Error ? error.message : String(error) };
	}
	for (const file of files) {
		try {
			result[file] = sha256(readFileSync(join(root, file)));
		} catch {
			return { files: result, complete: false, error: `Não foi possível ler o arquivo do snapshot: ${file}` };
		}
	}
	return { files: result, complete: true };
}

/** Captures the immutable pre-Code state used by every later Security review. */
export function captureSecurityBaseline(root: string, input: SecurityBaselineInput = {}): SecurityBaseline {
	const lockPath = ["package-lock.json", "npm-shrinkwrap.json"].map((name) => join(root, name)).find(existsSync);
	const fileCapture = input.files ? { files: input.files, complete: true } : fileSnapshot(root);
	const files = fileCapture.files;
	const snapshot = readDependencySnapshot(root);
	const dependencies = input.dependencies ?? snapshot.map;
	const fileSnapshotComplete = fileCapture.complete && Object.keys(files).length > 0;
	// An explicitly supplied dependency snapshot is a valid upstream capture
	// (used by adapters that already parsed their package manager). An empty
	// workspace, however, must remain incomplete so Security cannot clear on an
	// unsupported or absent lockfile.
	const dependencySnapshotComplete = input.dependencies !== undefined ? Object.keys(input.dependencies).length > 0 : snapshot.complete;
	const baseline: SecurityBaseline = {
		version: "1",
		capturedAt: new Date().toISOString(),
		gitRevision: input.gitRevision === undefined ? git(root, ["rev-parse", "HEAD"]) : input.gitRevision,
		packageLockSha256:
			input.packageLockSha256 === undefined
				? lockPath
					? sha256(readFileSync(lockPath))
					: null
				: input.packageLockSha256,
		files,
		dependencies,
		fileSnapshotComplete,
		dependencySnapshotComplete,
		lockfileHashes: input.dependencies !== undefined ? undefined : snapshot.lockfileHashes,
		dependencyManager: input.dependencies !== undefined ? undefined : snapshot.manager,
	};
	return { ...baseline, fingerprint: baselineFingerprint(baseline) };
}

export function changedWorkspaceFiles(root: string, baseline: SecurityBaseline): string[] {
	// Compare content with the immutable snapshot. A diff against HEAD would
	// incorrectly include edits that existed before Code was entered.
	const current = new Map<string, string>();
	let files: string[];
	try { files = workspaceFiles(root); } catch {
		// Keep the public diff helper compatible for callers that only need the
		// last known file set. The review itself probes Git separately and fails
		// closed when this enumeration is unavailable.
		return Object.keys(baseline.files).sort();
	}
	for (const file of files) {
		try { current.set(file, sha256(readFileSync(join(root, file)))); }
		catch { current.set(file, "unreadable"); }
	}
	const changed = new Set<string>();
	for (const file of Object.keys(baseline.files)) {
		if (!current.has(file) || current.get(file) !== baseline.files[file]) changed.add(file);
	}
	for (const [file, digest] of current) {
		if (baseline.files[file] !== digest) changed.add(file);
	}
	return [...changed].sort();
}

export function changedWorkspaceDependencies(root: string, baseline: SecurityBaseline, files = changedWorkspaceFiles(root, baseline)): string[] {
	const current = readDependencyMap(root);
	const changed = [...Object.keys(current).filter((name) => current[name] !== baseline.dependencies[name]), ...Object.keys(baseline.dependencies).filter((name) => !(name in current))];
	if (files.some((file) => /(^|\/)(package-lock\.json|npm-shrinkwrap\.json|pnpm-lock\.yaml|yarn\.lock)$/.test(file))) {
		return [...new Set(changed)];
	}
	return changed;
}

export function createSecurityContext(input: SecurityReviewContext): SecurityReviewContext {
	return {
		...input,
		acceptanceCriteria: [...input.acceptanceCriteria],
		changedFiles: [...new Set(input.changedFiles)].sort(),
		changedDependencies: [...new Set(input.changedDependencies)].sort(),
		baseline: {
			...input.baseline,
			files: { ...input.baseline.files },
			dependencies: { ...input.baseline.dependencies },
		},
		workspaceFingerprint: input.workspaceFingerprint,
		scopeFingerprint: input.scopeFingerprint,
		dependencyPaths: input.dependencyPaths ? Object.fromEntries(Object.entries(input.dependencyPaths).map(([name, path]) => [name, [...path]])) : undefined,
	};
}

function packageName(value: string): string {
	if (value.startsWith("@")) return value.split("/").slice(0, 2).join("/");
	return value.split("/")[0] ?? value;
}

function dependencyGraph(root: string): Record<string, string[]> { return readDependencySnapshot(root).graph; }

function reachableDependencyPaths(root: string, files: string[], changedDependencies: string[]): Record<string, string[]> {
	const graph = dependencyGraph(root);
	const imported = new Set<string>();
	for (const file of files) {
		if (/((^|\/)(package(-lock)?\.json|npm-shrinkwrap\.json|pnpm-lock\.yaml|yarn\.lock)$)/.test(file)) continue;
		try {
			const content = readFileSync(join(root, file), "utf8");
			for (const match of content.matchAll(/(?:from|require\s*\(|import\s*\()\s*["']([^"']+)["']/g)) imported.add(packageName(match[1]));
		} catch { /* unreadable files are reported by the file scanner */ }
	}
	const paths: Record<string, string[]> = {};
	const queue = [...imported].map((name) => ({ name, path: [name] }));
	const seen = new Set<string>();
	while (queue.length) {
		const current = queue.shift()!;
		const key = `${current.name}:${current.path.join("/")}`;
		if (seen.has(key)) continue;
		seen.add(key);
		if (changedDependencies.includes(current.name)) paths[current.name] ??= current.path;
		for (const child of graph[current.name] ?? []) {
			if (current.path.includes(child)) continue;
			queue.push({ name: child, path: [...current.path, child] });
		}
	}
	return paths;
}

function currentScopeFingerprint(root: string, baseline: SecurityBaseline, files: string[], dependencies: string[]): string {
	const hashes: Record<string, string> = {};
	for (const file of files) {
		try { hashes[file] = sha256(readFileSync(join(root, file))); }
		catch { hashes[file] = "unreadable"; }
	}
	const currentDependencies = readDependencyMap(root);
	return sha256(JSON.stringify({
		baseline: baseline.fingerprint,
		files: stableMap(hashes),
		dependencies: Object.fromEntries(dependencies.sort().map((name) => [name, currentDependencies[name] ?? null])),
	}));
}

function canonicalReportPayload(report: Omit<SecurityReviewReport, "reportFingerprint">): string {
	return JSON.stringify({
		schemaVersion: report.schemaVersion,
		generatedAt: report.generatedAt,
		context: report.context,
		findings: report.findings,
		globalFindings: report.globalFindings,
		blockingFindings: report.blockingFindings,
		decision: report.decision,
		scanErrors: report.scanErrors,
		expiresAt: report.expiresAt,
		workspaceFingerprint: report.workspaceFingerprint,
		scopeFingerprint: report.scopeFingerprint,
		scannerEvidence: report.scannerEvidence,
		reasonCode: report.reasonCode,
	});
}

export function securityReportFingerprint(report: Omit<SecurityReviewReport, "reportFingerprint"> | SecurityReviewReport): string {
	const { reportFingerprint: _ignored, ...payload } = report as SecurityReviewReport;
	return sha256(canonicalReportPayload(payload));
}

export function securityScopeFingerprint(root: string, baseline: SecurityBaseline, files = changedWorkspaceFiles(root, baseline), dependencies = changedWorkspaceDependencies(root, baseline, files)): string {
	return currentScopeFingerprint(root, baseline, [...files].sort(), [...dependencies]);
}

export function securityWorkspaceFingerprint(root: string): string {
	return workspaceFingerprint(root);
}

/** Resolve the source tree for Security, never the externalized harness data directory. */
export function resolveSecurityExecutionRoot(root: string): string {
	const resolution = resolveWorkspaceRoot(root);
	if (resolution.type === "linked" && resolution.locationPath !== resolution.workspaceDir) return resolve(resolution.locationPath);
	try {
		const workflowPath = join(getLetraDir(root), "workflow.json");
		const workflow = JSON.parse(readFileSync(workflowPath, "utf8")) as { locations?: Array<{ path?: string }> };
		if (workflow.locations?.length === 1 && workflow.locations[0]?.path) return resolve(workflow.locations[0].path);
	} catch { /* a workspace without locations falls back to its resolved location */ }
	return resolve(resolution.locationPath || root);
}

/** Validates that a persisted report still describes the current item scope. */
export function validateSecurityReviewReport(root: string, item: Item, report: SecurityReviewReport): { ok: true } | { ok: false; reasonCode: "SECURITY_BASELINE_INVALID" | "SECURITY_REVIEW_REQUIRED" | "SECURITY_SCAN_FAILED"; reason: string } {
	const baseline = item.securityBaseline;
	if (!baseline || baseline.version !== "1" || baseline.fileSnapshotComplete !== true || baseline.dependencySnapshotComplete !== true || !baseline.fingerprint || baseline.fingerprint !== baselineFingerprint(baseline)) {
		return { ok: false, reasonCode: "SECURITY_BASELINE_INVALID", reason: "O baseline pré-Code está ausente, parcial ou foi alterado." };
	}
	if (report.schemaVersion !== "1" || !report.generatedAt || !report.expiresAt || Date.parse(report.expiresAt) <= Date.now()) {
		return { ok: false, reasonCode: "SECURITY_REVIEW_REQUIRED", reason: "O relatório de Security está ausente ou expirado; execute uma nova revisão." };
	}
	if (report.context?.itemId !== item.id || report.context?.specId !== (item.spec ?? null)) {
		return { ok: false, reasonCode: "SECURITY_REVIEW_REQUIRED", reason: "O relatório de Security não pertence ao item ou à spec atuais." };
	}
	const executionRoot = report.context.executionRoot ? resolve(report.context.executionRoot) : resolveSecurityExecutionRoot(root);
	if (report.context.baseline?.fingerprint !== baseline.fingerprint || report.workspaceFingerprint !== workspaceFingerprint(executionRoot)) {
		return { ok: false, reasonCode: "SECURITY_REVIEW_REQUIRED", reason: "O relatório de Security não pertence ao workspace ou baseline atuais." };
	}
	// A report created by the real scanner records its execution root. If Git
	// disappears after that capture, fail closed instead of reusing the old
	// baseline and accepting a stale clear result.
	if (report.context.executionRoot) {
		try { workspaceFiles(executionRoot); } catch {
			return { ok: false, reasonCode: "SECURITY_SCAN_FAILED", reason: "Git não conseguiu enumerar o workspace após a revisão; execute uma nova revisão de Security." };
		}
	}
	const files = changedWorkspaceFiles(executionRoot, baseline);
	const dependencies = changedWorkspaceDependencies(executionRoot, baseline, files);
	if (report.scopeFingerprint !== currentScopeFingerprint(executionRoot, baseline, files, dependencies) || JSON.stringify(report.context.changedFiles) !== JSON.stringify(files) || JSON.stringify(report.context.changedDependencies) !== JSON.stringify(dependencies)) {
		return { ok: false, reasonCode: "SECURITY_REVIEW_REQUIRED", reason: "O escopo mudou depois da revisão; qualquer alteração exige nova revisão de Security." };
	}
	if (!report.reportFingerprint || report.reportFingerprint !== securityReportFingerprint(report)) {
		return { ok: false, reasonCode: "SECURITY_REVIEW_REQUIRED", reason: "A integridade do relatório de Security não pôde ser verificada; execute uma nova revisão." };
	}
	return { ok: true };
}

function relatedByScope(finding: SecurityFindingInput, context: SecurityReviewContext): boolean {
	if (finding.relatedToSpec !== undefined) return finding.relatedToSpec;
	if (finding.file) return context.changedFiles.includes(finding.file) || context.changedFiles.some((file) => file.endsWith(`/${finding.file}`));
	if (finding.package) return context.changedDependencies.includes(finding.package);
	return false;
}

function introducedByChange(finding: SecurityFindingInput, context: SecurityReviewContext): boolean {
	if (finding.introduced !== undefined) return finding.introduced;
	return finding.package ? context.changedDependencies.includes(finding.package) : Boolean(finding.file && relatedByScope(finding, context));
}

function reachableByChange(finding: SecurityFindingInput, context: SecurityReviewContext): boolean | "unknown" {
	if (finding.reachable !== undefined) return finding.reachable;
	return finding.source === "dependency" ? (finding.package && context.dependencyPaths?.[finding.package] ? true : "unknown") : true;
}

export function classifySecurityFinding(finding: SecurityFindingInput, context: SecurityReviewContext): SecurityFinding {
	return {
		...finding,
		id: finding.id ?? `${finding.source ?? "finding"}:${finding.package ?? finding.file ?? sha256(finding.evidence.join("|"))}`,
		introduced: introducedByChange(finding, context),
		relatedToSpec: relatedByScope(finding, context),
		reachable: reachableByChange(finding, context),
		source: finding.source ?? (finding.package ? "dependency" : finding.file ? "code" : "global"),
	};
}

export function evaluateSecurityReview(
	context: SecurityReviewContext,
	inputs: SecurityFindingInput[],
	policy: SecurityPolicy | Pick<Policy["security"], "blockOnCritical" | "blockOnHigh"> = { blockOnCritical: true, blockOnHigh: true },
	now = new Date().toISOString(),
	scanErrors: string[] = [],
	scannerEvidence: SecurityScannerEvidence[] = [],
): SecurityReviewReport {
	const findings = inputs.map((finding) => classifySecurityFinding(finding, context));
	const blockingFindings = findings.filter((finding) =>
		finding.introduced && finding.relatedToSpec && finding.reachable === true &&
		((finding.severity === "critical" && policy.blockOnCritical) || (finding.severity === "high" && policy.blockOnHigh)),
	);
	const unknownReachability = findings.some((finding) => finding.source === "dependency" && finding.introduced && finding.relatedToSpec && finding.reachable === "unknown");
	const globalFindings = findings.filter((finding) => !blockingFindings.includes(finding));
	const report = {
		schemaVersion: "1",
		generatedAt: now,
		context: createSecurityContext(context),
		findings,
		globalFindings,
		blockingFindings,
		decision: blockingFindings.length > 0 ? "blocked" : scanErrors.length > 0 || unknownReachability ? "needs-review" : "clear",
		scanErrors: scanErrors.length > 0 ? [...scanErrors] : undefined,
		expiresAt: new Date(Date.parse(now) + 30 * 60_000).toISOString(),
		workspaceFingerprint: context.workspaceFingerprint ?? "",
		scopeFingerprint: context.scopeFingerprint ?? "",
		scannerEvidence: scannerEvidence.map((evidence) => ({ ...evidence, scope: [...evidence.scope] })),
		reasonCode: blockingFindings.length > 0 ? "SECURITY_SCOPED_BLOCKED" : scanErrors.length > 0 ? "SECURITY_SCAN_FAILED" : unknownReachability ? "SECURITY_REVIEW_REQUIRED" : "SECURITY_SCOPED_CLEAR",
	} satisfies Omit<SecurityReviewReport, "reportFingerprint">;
	return { ...report, reportFingerprint: securityReportFingerprint(report) };
}

export function parseSecurityAuditOutput(output: string, context: SecurityReviewContext): SecurityFindingInput[] {
	const audit = JSON.parse(output) as { vulnerabilities?: Record<string, { severity?: string; via?: Array<string | { url?: string; title?: string }>; nodes?: string[] }> };
	return Object.entries(audit.vulnerabilities ?? {}).map(([name, value]) => ({
		id: `npm:${name}`,
		package: name,
		severity: value.severity === "moderate" || value.severity === "low" || value.severity === "critical" || value.severity === "high" ? value.severity : "info",
		advisory: value.via?.map((entry) => typeof entry === "string" ? entry : entry.url ?? entry.title).filter(Boolean).join(", "),
		evidence: [`npm audit: ${name}`, ...(value.nodes ?? [])],
		source: "dependency",
		introduced: context.changedDependencies.includes(name),
		relatedToSpec: context.changedDependencies.includes(name),
		reachable: context.dependencyPaths?.[name] ? true : "unknown",
	}));
}

function parseAuditFindings(root: string, context: SecurityReviewContext, manager: DependencyManager): { findings: SecurityFindingInput[]; errors: string[]; command: string; version: string | null } {
	const commandArgs: Record<DependencyManager, string[]> = {
		npm: ["audit", "--omit=dev", "--json"],
		yarn: ["npm", "audit", "--json"],
		pnpm: ["audit", "--json"],
		unknown: [],
	};
	const executable = manager === "yarn" ? "yarn" : manager === "pnpm" ? "pnpm" : "npm";
	const command = manager === "unknown" ? "dependency audit (unsupported lockfile)" : `${executable} ${commandArgs[manager].join(" ")}`;
	if (manager === "unknown") return { findings: [], errors: ["Nenhum gerenciador de dependências suportado para auditoria."], command, version: null };
	let output = "";
	try {
		output = execFileSync(executable, commandArgs[manager], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
	} catch (error) {
		// npm exits with code 1 when vulnerabilities are found. Its stdout is
		// still the authoritative JSON report and must not be discarded.
		output = typeof error === "object" && error !== null && "stdout" in error
			? String((error as { stdout?: unknown }).stdout ?? "")
			: "";
	}
	try {
		let version: string | null = null;
		try { version = execFileSync(executable, ["--version"], { cwd: root, encoding: "utf8" }).trim() || null; } catch { /* evidence records missing version */ }
		return { findings: parseSecurityAuditOutput(output, context), errors: [], command, version };
	} catch (error) {
		let version: string | null = null;
		try { version = execFileSync(executable, ["--version"], { cwd: root, encoding: "utf8" }).trim() || null; } catch { /* evidence records missing version */ }
		return { findings: [], errors: [`${executable} audit não retornou JSON válido: ${error instanceof Error ? error.message : String(error)}`], command, version };
	}
}

function scanChangedFiles(root: string, context: SecurityReviewContext): { findings: SecurityFindingInput[]; errors: string[] } {
	const findings: SecurityFindingInput[] = [];
	const errors: string[] = [];
	for (const file of context.changedFiles) {
		const path = resolve(root, file);
		try {
			if (!existsSync(path) || !statSync(path).isFile()) continue;
			const content = readFileSync(path, "utf8");
			const secret = /\b(?:api[_-]?key|secret|password|token|private[_-]?key)\b\s*[:=]\s*["'`]([^"'`\r\n]+)["'`]/i.exec(content);
			if (secret && !/^\$\{|^process\.env\./.test(secret[1] ?? "")) {
				findings.push({ id: `secret:${file}`, severity: "high", file, source: "secret", advisory: "Hard-coded credential pattern", evidence: [`${file}: secret assignment`] });
			}
			if (/\beval\s*\(/.test(content)) {
				findings.push({ id: `code:${file}:eval`, severity: "moderate", file, source: "code", advisory: "Dynamic code execution", evidence: [`${file}: eval()`] });
			}
			if (/\b(?:allowInsecure|insecureSkipVerify|rejectUnauthorized)\b\s*[:=]\s*(?:true|false)/i.test(content)) {
				findings.push({ id: `configuration:${file}`, severity: "moderate", file, source: "configuration", advisory: "Security-sensitive configuration", evidence: [`${file}: security configuration`] });
			}
		} catch {
			findings.push({ id: `file:${file}:unreadable`, severity: "moderate", file, source: "code", advisory: "Changed file could not be read", evidence: [`${file}: unreadable`] });
			errors.push(`Não foi possível ler o arquivo alterado: ${file}`);
		}
	}
	return { findings, errors };
}

function readSpecAcceptanceCriteria(root: string, item: Item): string[] {
	if (!item.spec) return [];
	const specPath = join(getLetraDir(root), "specs", item.spec, "spec.md");
	if (!existsSync(specPath)) return [];
	try {
		return [...readFileSync(specPath, "utf8").matchAll(/^\s*-\s*\[x\]\s*\*\*(AC[0-9]+(?:\.[0-9]+)*)\b/gim)].map((match) => match[1]).filter(Boolean);
	} catch { return []; }
}

export function runScopedSecurityReview(root: string, item: Item, policy: SecurityPolicy): SecurityReviewReport {
	const executionRoot = resolveSecurityExecutionRoot(root);
	const baseline = item.securityBaseline;
	const invalidBaseline = !baseline?.capturedAt || baseline.version !== "1" || baseline.fileSnapshotComplete !== true || baseline.dependencySnapshotComplete !== true || !baseline.fingerprint || baseline.fingerprint !== baselineFingerprint(baseline);
	if (invalidBaseline) {
		const fallbackBaseline: SecurityBaseline = baseline ?? { version: "1", capturedAt: "", gitRevision: null, packageLockSha256: null, files: {}, dependencies: {}, fileSnapshotComplete: false, dependencySnapshotComplete: false, fingerprint: "" };
		const context = createSecurityContext({ itemId: item.id, specId: item.spec ?? null, acceptanceCriteria: readSpecAcceptanceCriteria(executionRoot, item), changedFiles: [], changedDependencies: [], baseline: fallbackBaseline, workspaceFingerprint: workspaceFingerprint(executionRoot), scopeFingerprint: "" });
		const invalidReport = { schemaVersion: "1" as const, generatedAt: new Date().toISOString(), context, findings: [], globalFindings: [], blockingFindings: [], decision: "needs-review" as const, reasonCode: "SECURITY_BASELINE_INVALID" as const, scanErrors: ["Baseline pré-Code ausente, parcial ou inválido."], expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(), workspaceFingerprint: workspaceFingerprint(executionRoot), scopeFingerprint: "", scannerEvidence: [] } satisfies Omit<SecurityReviewReport, "reportFingerprint">;
		return { ...invalidReport, reportFingerprint: securityReportFingerprint(invalidReport) };
	}
	const files = changedWorkspaceFiles(executionRoot, baseline);
	const changedDependencies = changedWorkspaceDependencies(executionRoot, baseline, files);
	const dependencyPaths = reachableDependencyPaths(executionRoot, files, changedDependencies);
	const context = createSecurityContext({
		itemId: item.id,
		specId: item.spec ?? null,
		executionRoot,
		acceptanceCriteria: readSpecAcceptanceCriteria(executionRoot, item),
		changedFiles: files,
		changedDependencies,
		baseline,
		workspaceFingerprint: workspaceFingerprint(executionRoot),
		dependencyPaths,
	});
	const audit = parseAuditFindings(executionRoot, context, baseline.dependencyManager ?? readDependencySnapshot(executionRoot).manager);
	const fileScan = scanChangedFiles(executionRoot, context);
	const generatedAt = new Date().toISOString();
	const scopeFingerprint = currentScopeFingerprint(executionRoot, baseline, files, changedDependencies);
	context.scopeFingerprint = scopeFingerprint;
	const gitUnavailable = (() => {
		try { workspaceFiles(executionRoot); return false; } catch { return true; }
	})();
	const scanErrors = [
		...audit.errors,
		...fileScan.errors,
		...(gitUnavailable ? ["Git não conseguiu enumerar o workspace durante a revisão de Security."] : []),
	];
	const scannerEvidence: SecurityScannerEvidence[] = [
		{ name: `${baseline.dependencyManager ?? "dependency"}-audit`, command: audit.command, version: audit.version, scope: changedDependencies, outcome: audit.errors.length ? "failed" : "completed", details: audit.errors.join("; ") || undefined },
		{ name: "changed-files", command: "letra security scoped file scan", version: "1", scope: files, outcome: fileScan.errors.length || gitUnavailable ? "failed" : "completed", details: [...fileScan.errors, ...(gitUnavailable ? ["Git não conseguiu enumerar o workspace durante a revisão de Security."] : [])].join("; ") || undefined },
	];
	if (gitUnavailable) {
		scannerEvidence.push({
			name: "git-workspace-enumeration",
			command: "git ls-files --others --exclude-standard",
			version: "unknown",
			scope: [executionRoot],
			outcome: "failed",
			details: "Git não conseguiu enumerar o workspace durante a revisão de Security.",
		});
	}
	return evaluateSecurityReview(context, [...audit.findings, ...fileScan.findings], policy, generatedAt, scanErrors, scannerEvidence);
}

export function securityReportPath(root: string, itemId: string): string {
	return join(getLetraDir(root), "reports", "security", `${itemId}.json`);
}
