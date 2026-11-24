/**
 * Test helper: gives an item a claim that the canonical passage accepts.
 *
 * Canonical passage (requestPassageOperation) requires, on the item:
 * - claimedBy        — the role holding the claim (e.g. "implementer")
 * - claimExecutorId  — must equal the executorId sent with the passage
 * - claimExpiresAt   — ISO date in the future
 * - claimCapability  — one of the role's capabilities in the harness flow
 *   (implementer: read_code | write_code | run_tests)
 *
 * Legacy fixtures wrote only `claimedBy`/`claimedAt` into workflow.json, which
 * the canonical model now rejects with CLAIM_REQUIRED / CLAIM_EXPIRED.
 */
import {
	claimOperation,
	directionForOperation,
	type OperationResult,
} from "../domain-operations/service.js";

export interface CanonicalClaimOptions {
	itemId: string;
	/** Role that holds the claim; must be allowed in the item's stage. */
	actor: string;
	executorId: string;
	capability: string;
	ttlMinutes?: number;
}

export async function claimCanonically(
	root: string,
	options: CanonicalClaimOptions,
): Promise<OperationResult> {
	// Through the operation, never by writing claim fields into workflow.json:
	// the fixture then obeys the same role/stage/capability rules as the
	// product, and a rule change breaks here with a clear reason.
	const { itemId, actor, executorId, capability, ttlMinutes = 60 } = options;
	const result = await claimOperation(root, {
		itemId,
		actor,
		executorId,
		capability,
		ttlMinutes,
		expectedRevision: directionForOperation(root, { itemId }).revision,
		reason: "Claim de fixture de teste pela operação canônica.",
	});
	// Fail in setup, where the cause is, not later as CLAIM_REQUIRED.
	if (result.outcome !== "accepted") {
		throw new Error(`claimCanonically(${itemId}): ${result.reasonCode} — ${result.reason}`);
	}
	return result;
}
