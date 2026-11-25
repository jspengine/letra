import { AsyncLocalStorage } from "node:async_hooks";
import { createHash, randomUUID } from "node:crypto";
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync, writeSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { getLetraDir } from "../workspace/resolver.js";

export interface TransactionFileWrite { path: string; expectedHash: string | null; contents: string; }
export interface TransactionAppend { path: string; dedupeToken: string; line: string; }
export interface WorkspaceTransactionPlan {
  transactionId: string;
  writes: TransactionFileWrite[];
  appends?: TransactionAppend[];
  validate: () => void;
}
interface Journal extends Omit<WorkspaceTransactionPlan, "validate"> {
  schemaVersion: 1;
  phase: "prepared" | "committed";
}

const owner = new AsyncLocalStorage<string>();
let failureInjector: ((point: "after-prepare" | "after-commit-marker") => void) | undefined;
export function setWorkspaceTransactionFailureInjectorForTests(injector?: (point: "after-prepare" | "after-commit-marker") => void): void {
  failureInjector = injector;
}
function rootKey(root: string): string { return resolve(getLetraDir(resolve(root))); }
function paths(root: string) {
  const dataRoot = rootKey(root);
  const runtime = join(dataRoot, "runtime");
  return { dataRoot, runtime, lock: join(runtime, "workspace-transaction.lock"), journal: join(runtime, "workspace-transaction.json") };
}
function sha256(value: string): string { return createHash("sha256").update(value).digest("hex"); }
function safeTarget(dataRoot: string, target: string): string {
  const absolute = isAbsolute(target) ? resolve(target) : resolve(dataRoot, target);
  const rel = relative(dataRoot, absolute);
  if (!rel || rel === ".." || rel.startsWith(".." + sep)) throw new Error("TRANSACTION_PATH_OUTSIDE_DATA_ROOT");
  return absolute;
}
function atomicWrite(path: string, contents: string): void {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = path + "." + randomUUID() + ".tmp";
  writeFileSync(temporary, contents, { encoding: "utf8", flag: "wx" });
  try { renameSync(temporary, path); } catch (error) { try { unlinkSync(temporary); } catch { /* preserve original error */ } throw error; }
}
function lockOwnerPid(path: string): number | null {
  try {
    const value = JSON.parse(readFileSync(path, "utf8")) as { pid?: number };
    return Number.isInteger(value.pid) && value.pid! > 0 ? value.pid! : null;
  } catch { return null; }
}
/**
 * ITEM-58 AC2: waits between attempts to take the lock. Another process (the
 * board, an agent) usually holds it for milliseconds, so giving up on the
 * first collision turned a momentary overlap into a failed operation.
 */
export const LOCK_RETRY_DELAYS_MS: readonly number[] = [10, 25, 50, 100, 200, 400, 800, 800];
const sleepBuffer = new Int32Array(new SharedArrayBuffer(4));
function sleepSync(ms: number): void {
  Atomics.wait(sleepBuffer, 0, 0, ms);
}
function acquire(root: string): () => void {
  const location = paths(root);
  mkdirSync(location.runtime, { recursive: true });
  for (let attempt = 0; attempt <= LOCK_RETRY_DELAYS_MS.length; attempt++) {
    try {
      const fd = openSync(location.lock, "wx", 0o600);
      writeFileSync(fd, JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() }));
      return () => { closeSync(fd); try { unlinkSync(location.lock); } catch { /* preserve operation outcome */ } };
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      // EPERM: Windows denies opening a lock file another process is deleting.
      if (code !== "EEXIST" && code !== "EPERM") throw error;
      if (code === "EEXIST") {
        const pid = lockOwnerPid(location.lock);
        // A null PID means the owner created the file and has not written it
        // yet: a live, momentary hold, not a reason to give up.
        // Held by this very process (re-entry outside the owning async
        // context): waiting cannot help, keep the immediate answer.
        if (pid === process.pid) break;
        if (pid !== null) {
          try { process.kill(pid, 0); } catch (probeError) {
            if ((probeError as NodeJS.ErrnoException).code === "ESRCH") {
              try { unlinkSync(location.lock); } catch { /* another process won the cleanup */ }
              continue;
            }
          }
        }
      }
      const delay = LOCK_RETRY_DELAYS_MS[attempt];
      if (delay === undefined) break;
      sleepSync(delay);
    }
  }
  throw new Error("WORKSPACE_TRANSACTION_BUSY");
}
function isOwner(root: string): boolean { return owner.getStore() === rootKey(root); }
export function withWorkspaceTransactionLockSync<T>(root: string, action: () => T): T {
  const key = rootKey(root);
  if (owner.getStore() === key) return action();
  const release = acquire(root);
  try { return owner.run(key, action); } finally { release(); }
}
export async function withWorkspaceTransactionLock<T>(root: string, action: () => Promise<T>): Promise<T> {
  const key = rootKey(root);
  if (owner.getStore() === key) return action();
  const release = acquire(root);
  try { return await owner.run(key, action); } finally { release(); }
}
function readJournal(file: string): Journal | null {
  if (!existsSync(file)) return null;
  const value = JSON.parse(readFileSync(file, "utf8")) as Journal;
  if (value.schemaVersion !== 1 || (value.phase !== "prepared" && value.phase !== "committed")) throw new Error("INVALID_WORKSPACE_TRANSACTION_JOURNAL");
  return value;
}
function project(root: string, journal: Journal): void {
  const location = paths(root);
  for (const write of journal.writes) {
    const target = safeTarget(location.dataRoot, write.path);
    const current = existsSync(target) ? readFileSync(target, "utf8") : null;
    if (current === write.contents) continue;
    if (current === null ? write.expectedHash !== null : write.expectedHash === null || sha256(current) !== write.expectedHash) throw new Error("WORKSPACE_TRANSACTION_CAS_CONFLICT:" + relative(location.dataRoot, target));
    if (write.expectedHash === null && current !== null) throw new Error("WORKSPACE_TRANSACTION_CREATE_CONFLICT:" + relative(location.dataRoot, target));
    atomicWrite(target, write.contents);
  }
  for (const append of journal.appends ?? []) {
    const target = safeTarget(location.dataRoot, append.path);
    const existing = existsSync(target) ? readFileSync(target, "utf8") : "";
    if (existing.includes(append.dedupeToken)) continue;
    mkdirSync(dirname(target), { recursive: true });
    const fd = openSync(target, "a");
    try { writeSync(fd, append.line.endsWith("\n") ? append.line : append.line + "\n"); } finally { closeSync(fd); }
  }
}
function recoverUnderLock(root: string): void {
  const location = paths(root);
  const journal = readJournal(location.journal);
  if (!journal) return;
  if (journal.phase === "committed") project(root, journal);
  unlinkSync(location.journal);
}
/** Recover before reading a projection. A live transaction causes a typed busy result instead of mixed state. */
export function recoverWorkspaceTransaction(root: string): void {
  if (isOwner(root)) return;
  const location = paths(root);
  if (!existsSync(location.journal)) return;
  withWorkspaceTransactionLockSync(root, () => recoverUnderLock(root));
}
/** Whether a durable commit marker exists for a transaction whose projections need recovery. */
export function isWorkspaceTransactionCommitted(root: string, transactionId: string): boolean {
  const journal = readJournal(paths(root).journal);
  return journal?.phase === "committed" && journal.transactionId === transactionId;
}
/** CAS checks, prepared journal, and the commit marker are serialized with every canonical workspace writer. */
export function commitWorkspaceTransaction(root: string, plan: WorkspaceTransactionPlan): void {
  withWorkspaceTransactionLockSync(root, () => {
    const location = paths(root);
    recoverUnderLock(root);
    plan.validate();
    for (const write of plan.writes) {
      const target = safeTarget(location.dataRoot, write.path);
      const current = existsSync(target) ? readFileSync(target, "utf8") : null;
      if (current === null ? write.expectedHash !== null : write.expectedHash === null || sha256(current) !== write.expectedHash) {
        throw new Error("WORKSPACE_TRANSACTION_CAS_CONFLICT:" + relative(location.dataRoot, target));
      }
    }
    const journal: Journal = { schemaVersion: 1, phase: "prepared", transactionId: plan.transactionId, writes: plan.writes, appends: plan.appends };
    atomicWrite(location.journal, JSON.stringify(journal, null, 2) + "\n");
    try { failureInjector?.("after-prepare"); } catch (error) { unlinkSync(location.journal); throw error; }
    const committed: Journal = { ...journal, phase: "committed" };
    atomicWrite(location.journal, JSON.stringify(committed, null, 2) + "\n");
    failureInjector?.("after-commit-marker");
    project(root, committed);
    unlinkSync(location.journal);
  });
}

