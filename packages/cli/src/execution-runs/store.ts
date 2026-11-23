import { closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import type { RunEntity } from "@letra/types";
import { createWorkspaceBoundary } from "../security/workspace-boundary.js";
import { getLetraDir } from "../workspace/resolver.js";
import { recoverWorkspaceTransaction, withWorkspaceTransactionLockSync } from "../domain-operations/workspace-transaction.js";

const STORE_SCHEMA_VERSION = 1;

export interface ExecutionRunStore {
	schemaVersion: typeof STORE_SCHEMA_VERSION;
	runs: RunEntity[];
}

function runStorePath(root: string): string {
	const letraRoot = getLetraDir(resolve(root));
	return createWorkspaceBoundary(letraRoot).assertPath(join(letraRoot, "runtime", "runs.json"));
}

function emptyStore(): ExecutionRunStore {
	return { schemaVersion: STORE_SCHEMA_VERSION, runs: [] };
}

/** A Run with an expired lease is durable history, not a selectable live direction. */
export function isRunActiveForDirection(run: RunEntity, now = Date.now()): boolean {
	if (!(run.status === "running" || run.status === "queued" || run.status === "waiting-human")) return false;
	if (!run.lease) return true;
	const expiresAt = Date.parse(run.lease.expiresAt);
	return Number.isFinite(expiresAt) && expiresAt > now;
}

export function readExecutionRuns(root: string): ExecutionRunStore {
	recoverWorkspaceTransaction(root);
	const path = runStorePath(root);
	if (!existsSync(path)) return emptyStore();
	let parsed: unknown;
	try {
		parsed = JSON.parse(readFileSync(path, "utf8"));
	} catch {
		throw new Error("INVALID_RUN_STORE: execution run store is not valid JSON");
	}
	if (!parsed || typeof parsed !== "object") throw new Error("INVALID_RUN_STORE: expected an object");
	const value = parsed as Partial<ExecutionRunStore>;
	if (value.schemaVersion !== STORE_SCHEMA_VERSION || !Array.isArray(value.runs)) {
		throw new Error("INVALID_RUN_STORE: unsupported schema or missing runs array");
	}
	return value as ExecutionRunStore;
}

function validateRun(run: RunEntity): void {
	const required = [
		run.id,
		run.workspaceId,
		run.itemId,
		run.binding?.actorId,
		run.binding?.identityId,
		run.binding?.roleId,
		run.binding?.executorId,
		run.authorization?.actorId,
		run.authorization?.referenceId,
		run.authorization?.revision,
		run.workflowVersionId,
		run.cycle?.startedAt,
		run.directionRevision,
		run.createdAt,
		run.updatedAt,
	];
	if (required.some((value) => typeof value !== "string" || value.trim().length === 0)) {
		throw new Error("INVALID_RUN: identity, target, authorization, workflow version and timestamps are required");
	}
	const timestamps = [run.authorization.grantedAt, run.cycle.startedAt, run.createdAt, run.updatedAt];
	if (timestamps.some((value) => !Number.isFinite(Date.parse(value)))) throw new Error("INVALID_RUN: timestamps must be valid ISO dates");
	if (run.cycle.endedAt !== null && !Number.isFinite(Date.parse(run.cycle.endedAt))) throw new Error("INVALID_RUN: cycle end time must be a valid ISO date");
	if (!Number.isInteger(run.revision) || run.revision < 1 || !Number.isInteger(run.cycle.number) || run.cycle.number < 1) {
		throw new Error("INVALID_RUN: revision and cycle number must be positive integers");
	}
	if (run.lease && (!Number.isFinite(Date.parse(run.lease.expiresAt)) || run.lease.ttlMinutes <= 0 || (run.lease.heartbeatAt !== null && !Number.isFinite(Date.parse(run.lease.heartbeatAt))))) {
		throw new Error("INVALID_RUN: lease expiry, heartbeat and TTL are invalid");
	}
	if (run.result && !Number.isFinite(Date.parse(run.result.finishedAt))) {
		throw new Error("INVALID_RUN: result completion time is invalid");
	}
}

function withLockedRunStore<T>(root: string, update: (store: ExecutionRunStore) => { store: ExecutionRunStore; result: T }): T {
	return withWorkspaceTransactionLockSync(root, () => withLockedRunStoreUnlocked(root, update));
}
function withLockedRunStoreUnlocked<T>(root: string, update: (store: ExecutionRunStore) => { store: ExecutionRunStore; result: T }): T {
	const path = runStorePath(root);
	mkdirSync(dirname(path), { recursive: true });
	const lockPath = `${path}.lock`;	
	let lockFd: number;
	try {
		lockFd = openSync(lockPath, "wx", 0o600);
		writeFileSync(lockFd, JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() }));
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "EEXIST") {
			let recovered = false;
			try {
				const lock = JSON.parse(readFileSync(lockPath, "utf8")) as { pid?: number };
				if (Number.isInteger(lock.pid) && lock.pid! > 0) {
					try { process.kill(lock.pid!, 0); } catch (probeError) {
						if ((probeError as NodeJS.ErrnoException).code === "ESRCH") {
							unlinkSync(lockPath);
							recovered = true;
						}
					}
				}
			} catch {
				// An unreadable lock may belong to a writer currently creating it; never remove it blindly.
			}
			if (!recovered) throw new Error("RUN_STORE_BUSY: another process is updating execution runs");
			try {
				lockFd = openSync(lockPath, "wx", 0o600);
				writeFileSync(lockFd, JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() }));
			} catch {
				throw new Error("RUN_STORE_BUSY: another process is updating execution runs");
			}
		} else {
			throw error;
		}
	}

	try {
		const store = readExecutionRuns(root);
		const updated = update(store);
		const next = updated.store;
		const temporaryPath = `${path}.${randomUUID()}.tmp`;
		writeFileSync(temporaryPath, `${JSON.stringify(next, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
	try {
		renameSync(temporaryPath, path);
	} catch (error) {
		try { unlinkSync(temporaryPath); } catch { /* Preserve the original write error. */ }
		throw error;
	}
		return updated.result;
	} finally {
		closeSync(lockFd);
		try { unlinkSync(lockPath); } catch { /* Preserve the store result or original write error. */ }
	}
}

/** Persist a validated Run as canonical workspace state using an atomic file replacement. */
export function createExecutionRun(root: string, run: RunEntity): ExecutionRunStore {
	validateRun(run);
	return withLockedRunStore(root, (store) => {
		if (store.runs.some((existing) => existing.id === run.id)) throw new Error(`RUN_ALREADY_EXISTS: ${run.id}`);
		const next = { ...store, runs: [...store.runs, structuredClone(run)] };
		return { store: next, result: next };
	});
}

/** Optimistically update one canonical Run while holding the cross-process writer lock. */
export function updateExecutionRun(
	root: string,
	runId: string,
	expectedRevision: number,
	update: (run: RunEntity) => RunEntity,
): RunEntity {
	return withLockedRunStore(root, (store) => {
		const index = store.runs.findIndex((run) => run.id === runId);
		if (index < 0) throw new Error(`RUN_NOT_FOUND: ${runId}`);
		const current = store.runs[index]!;
		if (current.revision !== expectedRevision) throw new Error(`RUN_REVISION_CONFLICT:${current.revision}`);
		const nextRun = update(structuredClone(current));
		if (nextRun.id !== current.id || nextRun.revision !== current.revision + 1) throw new Error("INVALID_RUN_UPDATE: id must remain stable and revision must increment once");
		validateRun(nextRun);
		const runs = [...store.runs];
		runs[index] = structuredClone(nextRun);
		const next = { ...store, runs };
		return { store: next, result: nextRun };
	});
}


