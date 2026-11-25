import { existsSync, mkdirSync, openSync, closeSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import type { RunEntity } from "@letra/types";
import type { Workflow } from "../commands/flow-init.js";
import { saveWorkflow } from "../commands/flow-init.js";
import { readExecutionRuns, updateExecutionRun } from "../execution-runs/store.js";
import { loadSessionLog, logEntry, type LogAction } from "../session-log.js";
import { getLetraDir } from "../workspace/resolver.js";

export interface PassageAudit {
  action: LogAction;
  description: string;
  itemId: string;
  details: Record<string, unknown>;
}

export interface PassageTransaction {
  transactionId: string;
  expectedRunRevision: number;
  workflow: Workflow;
  run: RunEntity;
  audit: PassageAudit;
  idempotency?: { key: string; fingerprint: string; result: unknown };
}

interface Journal extends PassageTransaction { schemaVersion: 1; phase: "prepared" | "committed"; }
let failureInjector: ((point: "after-prepare") => void) | undefined;

/** Test seam for proving that pre-commit failures leave canonical projections untouched. */
export function setPassageFailureInjectorForTests(injector?: (point: "after-prepare") => void): void {
  failureInjector = injector;
}

function paths(root: string) {
  const runtime = join(getLetraDir(resolve(root)), "runtime");
  return { runtime, lock: join(runtime, "passage-transaction.lock"), journal: join(runtime, "passage-transaction.json") };
}

function atomicWrite(path: string, contents: string): void {
  const temporary = path + "." + randomUUID() + ".tmp";
  writeFileSync(temporary, contents, { encoding: "utf8", flag: "wx" });
  try { renameSync(temporary, path); } catch (error) { try { unlinkSync(temporary); } catch { /* keep original error */ } throw error; }
}

function readJournal(path: string): Journal | null {
  if (!existsSync(path)) return null;
  const parsed = JSON.parse(readFileSync(path, "utf8")) as Journal;
  if (parsed.schemaVersion !== 1 || (parsed.phase !== "prepared" && parsed.phase !== "committed")) throw new Error("INVALID_PASSAGE_JOURNAL");
  return parsed;
}

function persistIdempotency(root: string, value: Journal["idempotency"]): void {
  if (!value) return;
  const directory = join(getLetraDir(resolve(root)), "operations");
  mkdirSync(directory, { recursive: true });
  const file = join(directory, "idempotency.json");
  let records: Record<string, unknown> = {};
  try { records = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>; } catch { /* first record */ }
  records[value.key] = { fingerprint: value.fingerprint, result: value.result };
  atomicWrite(file, JSON.stringify(records, null, 2) + "\n");
}

function applyCommitted(root: string, journal: Journal): void {
  saveWorkflow(root, journal.workflow);
  const store = readExecutionRuns(root);
  const current = store.runs.find((candidate) => candidate.id === journal.run.id);
  if (!current) throw new Error("RUN_NOT_FOUND:" + journal.run.id);
  if (current.revision === journal.expectedRunRevision) {
    updateExecutionRun(root, current.id, journal.expectedRunRevision, () => journal.run);
  } else if (current.revision !== journal.run.revision || JSON.stringify(current) !== JSON.stringify(journal.run)) {
    throw new Error("RUN_REVISION_CONFLICT:" + current.revision);
  }
  const alreadyAudited = loadSessionLog(root).entries.some((entry) => entry.details?.transactionId === journal.transactionId);
  if (!alreadyAudited) logEntry(root, journal.audit.action, journal.audit.description, { itemId: journal.audit.itemId, details: { ...journal.audit.details, transactionId: journal.transactionId } });
  persistIdempotency(root, journal.idempotency);
}

/**
 * Records one passage as a durable transaction. The prepared journal is inert;
 * the committed marker is the point after which recovery must roll all projections forward.
 */
export function commitPassageTransaction(root: string, transaction: PassageTransaction): void {
  const location = paths(root);
  mkdirSync(location.runtime, { recursive: true });
  let lockFd: number;
  try {
    lockFd = openSync(location.lock, "wx", 0o600);
    writeFileSync(lockFd, JSON.stringify({ pid: process.pid, transactionId: transaction.transactionId }));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new Error("PASSAGE_TRANSACTION_BUSY");
    throw error;
  }
  try {
    const prior = readJournal(location.journal);
    if (prior?.phase === "committed") applyCommitted(root, prior);
    if (prior) unlinkSync(location.journal);
    const prepared: Journal = { ...transaction, schemaVersion: 1, phase: "prepared" };
    atomicWrite(location.journal, JSON.stringify(prepared, null, 2) + "\n");
    try { failureInjector?.("after-prepare"); } catch (error) { unlinkSync(location.journal); throw error; }
    const committed: Journal = { ...prepared, phase: "committed" };
    atomicWrite(location.journal, JSON.stringify(committed, null, 2) + "\n");
    applyCommitted(root, committed);
    unlinkSync(location.journal);
  } finally {
    closeSync(lockFd!);
    try { unlinkSync(location.lock); } catch { /* preserve transaction result */ }
  }
}

/** Finish a committed transaction before a retry can inspect or mutate state. */
export function recoverPassageTransaction(root: string): void {
  const location = paths(root);
  if (existsSync(location.lock)) throw new Error("PASSAGE_TRANSACTION_BUSY");
  const journal = readJournal(location.journal);
  if (!journal) return;
  if (journal.phase === "committed") applyCommitted(root, journal);
  unlinkSync(location.journal);
}
