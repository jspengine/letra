import { loadWorkflow, writeWorkflow } from "../commands/flow-init.js";
import type { HandoffPayload } from "../harness/types.js";
import { logEntry } from "../session-log.js";

/**
 * The compatibility orchestrator is intentionally only a coordinator.  All
 * durable claim, handoff, retry and reclaim mutations go through this
 * gateway, which is the same workflow writer used by the domain operations.
 * Keeping this boundary explicit prevents the legacy coordinator from
 * becoming a second state machine.
 */
export interface OrchestratorGateway {
	emitHandoff(root: string, payload: HandoffPayload): { ok: boolean; reason?: string };
	claim(root: string, input: { itemId: string; executorId: string; agentId: string }): { ok: boolean; reason?: string };
	reclaim(root: string, itemIds: string[]): { ok: boolean; reason?: string };
	retry(root: string, input: {
		itemId: string;
		deadLetter?: boolean;
		handoff: HandoffPayload;
		retryCount: number;
		lastOperationKey?: string;
	}): { ok: boolean; reason?: string };
}

/** Canonical persistence adapter for the legacy coordinator's compatibility API. */
export class CanonicalOrchestratorGateway implements OrchestratorGateway {
	emitHandoff(root: string, payload: HandoffPayload): { ok: boolean; reason?: string } {
		const workflow = loadWorkflow(root);
		const item = workflow?.items.find((entry) => entry.id === payload.itemId);
		if (!workflow || !item) return { ok: false, reason: `Item ${payload.itemId} not found` };
		item.handoff = {
			from: payload.from,
			to: payload.to,
			summary: payload.summary,
			evidence: payload.evidence,
			timestamp: payload.timestamp,
			expiresAt: payload.expiresAt,
			executorId: payload.executorId,
		};
		workflow.updatedAt = new Date().toISOString();
		const result = writeWorkflow(root, {
			workflow,
			source: "orchestrator-gateway",
			primaryItemId: item.id,
			skipSitrep: true,
			skipLog: true,
			quiet: true,
			confineAdapterWrites: true,
		});
		void result.catch(() => undefined);
		logEntry(root, "handoff_emitted", `Handoff emitted to ${payload.to}`, {
			itemId: payload.itemId,
			from: payload.from,
			to: payload.to,
			summary: payload.summary,
			evidence: payload.evidence,
		});
		return { ok: true };
	}

	claim(root: string, input: { itemId: string; executorId: string; agentId: string }): { ok: boolean; reason?: string } {
		const workflow = loadWorkflow(root);
		const item = workflow?.items.find((entry) => entry.id === input.itemId);
		if (!workflow || !item) return { ok: false, reason: `Item ${input.itemId} not found` };
		const handoff = item.handoff && item.handoff.to === input.agentId ? { ...item.handoff } : null;
		const now = new Date().toISOString();
		item.claimedBy = input.executorId;
		item.claimedAt = now;
		if (handoff) item.handoff = undefined;
		workflow.updatedAt = now;
		const result = writeWorkflow(root, {
			workflow,
			source: "orchestrator-gateway",
			primaryItemId: input.itemId,
			skipSitrep: true,
			skipLog: true,
			quiet: true,
			confineAdapterWrites: true,
		});
		void result.catch(() => undefined);
		logEntry(root, "item_claim", `Claimed by ${input.executorId}`, {
			itemId: input.itemId,
			executorId: input.executorId,
			agentId: input.agentId,
		});
		return { ok: true };
	}

	reclaim(root: string, itemIds: string[]): { ok: boolean; reason?: string } {
		if (itemIds.length === 0) return { ok: true };
		const workflow = loadWorkflow(root);
		if (!workflow) return { ok: false, reason: "No workflow found" };
		const now = new Date().toISOString();
		for (const itemId of itemIds) {
			const item = workflow.items.find((entry) => entry.id === itemId);
			if (!item) continue;
			item.claimedBy = undefined;
			item.claimedAt = undefined;
			item.claimExpiresAt = undefined;
			item.claimExecutorId = undefined;
			item.claimCapability = undefined;
			item.claimRevision = undefined;
			item.claimTtlMinutes = undefined;
			logEntry(root, "item_reclaim", "Item reclaimed after persisted lease expiry", { itemId });
		}
		workflow.updatedAt = now;
		const result = writeWorkflow(root, {
			workflow,
			source: "orchestrator-gateway",
			skipSitrep: true,
			skipLog: true,
			quiet: true,
			confineAdapterWrites: true,
		});
		void result.catch(() => undefined);
		return { ok: true };
	}

	retry(root: string, input: { itemId: string; deadLetter?: boolean; handoff: HandoffPayload; retryCount: number; lastOperationKey?: string }): { ok: boolean; reason?: string } {
		const workflow = loadWorkflow(root);
		const item = workflow?.items.find((entry) => entry.id === input.itemId);
		if (!workflow || !item) return { ok: false, reason: `Item ${input.itemId} not found` };
		item.handoff = {
			from: input.handoff.from,
			to: input.handoff.to,
			summary: input.handoff.summary,
			evidence: input.handoff.evidence,
			timestamp: input.handoff.timestamp,
			expiresAt: input.handoff.expiresAt,
			executorId: input.handoff.executorId,
		};
		item.retryCount = input.retryCount;
		if (input.lastOperationKey) item.lastOperationKey = input.lastOperationKey;
		workflow.updatedAt = input.handoff.timestamp;
		const result = writeWorkflow(root, {
			workflow,
			source: "orchestrator-gateway",
			primaryItemId: input.itemId,
			skipSitrep: true,
			skipLog: true,
			quiet: true,
			confineAdapterWrites: true,
		});
		void result.catch(() => undefined);
		logEntry(root, "handoff_emitted", input.deadLetter ? "Retry dead-lettered to human" : "Handoff re-emitted after retry", {
			itemId: input.itemId,
			details: { retry: true, deadLetter: Boolean(input.deadLetter), executorId: input.handoff.executorId },
		});
		return { ok: true };
	}
}
