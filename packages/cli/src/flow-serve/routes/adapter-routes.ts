import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { ADAPTER_REGISTRY } from "../../adapters/registry.js";
import { syncNow } from "../../commands/sync.js";
import { sendJson, sendError } from "../http.js";
import type { RouteHandler } from "../router.js";
import { getLetraDir } from "./../../workspace/resolver.js";

interface AdapterRouteDependencies {
	logEntry: (
		workspaceRoot: string,
		action: string,
		message: string,
		meta?: Record<string, unknown>,
	) => void;
	broadcast: () => void;
}

interface AdapterStatus {
	id: string;
	label: string;
	detected: boolean;
	artifacts: { path: string; exists: boolean; modifiedAt: string | null }[];
	synced: boolean;
	syncedAt: string | null;
}

function getAdapterStatus(workspaceRoot: string): AdapterStatus[] {
	return Object.values(ADAPTER_REGISTRY).map((adapter) => {
		const paths = adapter.detectionPaths.map((p) => join(workspaceRoot, p));
		const artifacts = paths.map((fullPath) => {
			let exists = false;
			let modifiedAt: string | null = null;
			try {
				exists = existsSync(fullPath);
				if (exists) {
					modifiedAt = statSync(fullPath).mtime.toISOString();
				}
			} catch {
				// file not accessible
			}
			return {
				path: adapter.detectionPaths[paths.indexOf(fullPath)],
				exists,
				modifiedAt,
			};
		});

		const detected = artifacts.some((a) => a.exists);
		const wf = join(getLetraDir(workspaceRoot), "workflow.json");
		const wfMtime = existsSync(wf) ? statSync(wf).mtime.getTime() : 0;
		const newestArtifact = artifacts
			.filter((a) => a.exists && a.modifiedAt)
			.sort(
				(a, b) => new Date(b.modifiedAt!).getTime() - new Date(a.modifiedAt!).getTime(),
			)[0];
		const synced = newestArtifact
			? new Date(newestArtifact.modifiedAt!).getTime() >= wfMtime
			: false;
		const syncedAt = newestArtifact?.modifiedAt ?? null;

		return {
			id: adapter.id,
			label: adapter.displayName,
			detected,
			artifacts,
			synced,
			syncedAt,
		};
	});
}

export function createAdapterRoutes(dependencies: AdapterRouteDependencies): RouteHandler {
	return async ({ method, path, req, res, workspaceRoot }) => {
		if (path === "/api/adapters") {
			if (method === "GET") {
				const statuses = getAdapterStatus(workspaceRoot);
				sendJson(res, 200, { adapters: statuses });
				return true;
			}
			if (method === "POST") {
				try {
					const result = await syncNow(workspaceRoot);
					if (result.ok) {
						dependencies.logEntry(workspaceRoot, "sync", "Adapters synced via UI");
						dependencies.broadcast();
						sendJson(res, 200, {
							ok: true,
							filesUpdated: result.filesUpdated,
							adapters: getAdapterStatus(workspaceRoot),
						});
					} else {
						sendError(res, 500, result.error ?? "Sync failed");
					}
				} catch (error) {
					sendError(res, 500, (error as Error).message);
				}
				return true;
			}
		}
		return false;
	};
}
