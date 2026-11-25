import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { resolveWorkspaceRoot, type WorkspaceResolution } from "./resolver.js";

const VOLATILE_KEYS = new Set([
	"updatedAt",
	"createdAt",
	"claimedAt",
	"claimExpiresAt",
	"claimRevision",
	"claimTtlMinutes",
	"activityStartedAt",
	"lastHeartbeatAt",
	"lastFailure",
	"validation",
]);

export interface WorkspaceDrift {
	code: "WORKSPACE_LINK_DRIFT" | "WORKSPACE_PROJECTION_DRIFT" | "WORKSPACE_LINK_INVALID";
	class: "link" | "projection";
	paths: string[];
	leftHash: string | null;
	rightHash: string | null;
	recovery: string;
}

export interface WorkspaceIntegrityReport {
	ok: boolean;
	code: "WORKSPACE_OK" | "WORKSPACE_DRIFT" | "WORKSPACE_LINK_INVALID";
	resolution: {
		workspaceDir: string;
		workspaceRoot: string;
		locationPath: string;
		mode: WorkspaceResolution["type"];
		errorCode?: WorkspaceResolution["errorCode"];
		errorMessage?: string;
	};
	pathsTried: string[];
	drifts: WorkspaceDrift[];
}

/**
 * Stable, operation-facing diagnosis shared by CLI, MCP and web callers.
 * The report intentionally contains paths and one safe recovery command so a
 * caller can explain the failure without probing a competing local .letra.
 */
export interface WorkspaceIntegrityDiagnostic {
	code: "WORKSPACE_LINK_INVALID";
	paths: string[];
	recovery: string;
}

function normalize(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(normalize);
	if (value && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>)
				.filter(([key]) => !VOLATILE_KEYS.has(key))
				.sort(([a], [b]) => a.localeCompare(b))
				.map(([key, entry]) => [key, normalize(entry)]),
		);
	}
	return typeof value === "string" ? value.replace(/\r\n?/g, "\n") : value;
}

export function normalizedHash(path: string): string | null {
	if (!existsSync(path)) return null;
	let raw: string;
	try {
		raw = readFileSync(path, "utf8");
	} catch {
		return null;
	}
	let value: unknown = raw.replace(/\r\n?/g, "\n");
	try {
		value = normalize(JSON.parse(String(value)));
	} catch {
		// Markdown and link files retain their normalized text representation.
	}
	return createHash("sha256")
		.update(JSON.stringify(value) ?? "")
		.digest("hex");
}

function linkPath(resolution: WorkspaceResolution): string {
	return join(resolution.locationPath, ".letra-link");
}

export function inspectWorkspaceIntegrity(root: string): WorkspaceIntegrityReport {
	const resolution = resolveWorkspaceRoot(resolve(root));
	const link = linkPath(resolution);
	const canonicalWorkflow = join(resolution.workspaceDir, "workflow.json");
	const localWorkflow = join(resolution.locationPath, ".letra", "workflow.json");
	const pathsTried = [link, canonicalWorkflow, localWorkflow];
	const drifts: WorkspaceDrift[] = [];

	if (resolution.errorCode === "WORKSPACE_LINK_INVALID") {
		drifts.push({
			code: "WORKSPACE_LINK_INVALID",
			class: "link",
			paths: [link, resolution.workspaceDir],
			leftHash: normalizedHash(link),
			rightHash: normalizedHash(canonicalWorkflow),
			recovery: "letra sync --mirror link-to-workspace --dry-run --backup",
		});
	} else if (existsSync(link)) {
		const declared = readFileSync(link, "utf8").trim().split("\n")[0]?.trim();
		if (
			!declared ||
			resolve(resolution.locationPath, declared) !== resolve(resolution.workspaceDir)
		) {
			drifts.push({
				code: "WORKSPACE_LINK_DRIFT",
				class: "link",
				paths: [link, resolution.workspaceDir],
				leftHash: normalizedHash(link),
				rightHash: normalizedHash(canonicalWorkflow),
				recovery: "letra sync --mirror link-to-workspace --dry-run --backup",
			});
		}
	} else if (resolution.type === "linked") {
		drifts.push({
			code: "WORKSPACE_LINK_INVALID",
			class: "link",
			paths: [link, resolution.workspaceDir],
			leftHash: null,
			rightHash: normalizedHash(canonicalWorkflow),
			recovery: "letra sync --mirror link-to-workspace --dry-run --backup",
		});
	}

	if (existsSync(localWorkflow) && existsSync(canonicalWorkflow)) {
		const leftHash = normalizedHash(localWorkflow);
		const rightHash = normalizedHash(canonicalWorkflow);
		if (leftHash !== rightHash) {
			drifts.push({
				code: "WORKSPACE_PROJECTION_DRIFT",
				class: "projection",
				paths: [localWorkflow, canonicalWorkflow],
				leftHash,
				rightHash,
				recovery: "letra sync --mirror workspace-to-location --dry-run --backup",
			});
		}
	}

	return {
		ok: drifts.length === 0,
		code: drifts.some((drift) => drift.code === "WORKSPACE_LINK_INVALID")
			? "WORKSPACE_LINK_INVALID"
			: drifts.length === 0
				? "WORKSPACE_OK"
				: "WORKSPACE_DRIFT",
		resolution: {
			workspaceDir: resolution.workspaceDir,
			workspaceRoot: resolution.workspaceRoot,
			locationPath: resolution.locationPath,
			mode: resolution.type,
			errorCode: resolution.errorCode,
			errorMessage: resolution.errorMessage,
		},
		pathsTried,
		drifts,
	};
}

export function invalidWorkspaceDiagnostic(root: string): WorkspaceIntegrityDiagnostic | null {
	const report = inspectWorkspaceIntegrity(root);
	if (report.code !== "WORKSPACE_LINK_INVALID") return null;
	const drift = report.drifts.find((entry) => entry.code === "WORKSPACE_LINK_INVALID");
	return {
		code: "WORKSPACE_LINK_INVALID",
		paths: [...new Set([...report.pathsTried, ...(drift?.paths ?? [])])],
		recovery: drift?.recovery ?? "letra sync --mirror link-to-workspace --dry-run --backup",
	};
}
