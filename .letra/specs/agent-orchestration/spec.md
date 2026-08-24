# Agent Orchestration

## Outcome

Letra becomes the orchestrator for agents and humans. Agents work through stages, hand off via structured protocol, humans decide at critical gates. Any agentic tool can be an executor. Harness defines personas, roles, handoff rules. Orchestrator detects handoffs, provides context, claims items, notifies executors.

## Constraints

- Letra defines what/when/for whom; executors handle how
- No `type: human` gate skipped by agents
- One pending handoff per item (atomic)
- Pluggable executors via minimal interface
- Versioned harness; auditable changes
- Exclusive `claimedBy` with CAS lock
- Mandatory evidences on every handoff
- Constitution principles non-negotiable
- Every operation needs failure path and timeout

## Exclusions

- LLM provider selection; token/cost management
- Agent-specific adapter implementations
- Multi-user concurrent editing
- Agent-to-agent messaging (use handoff)

## Context

Letra manages workflow but not who executes. No protocol for who does what at each stage, when to hand off, how next agent knows what to do, when to stop for approval, or how to recover from failures.

Architecture: `Orchestrator` manages lifecycle. `AgenticExecutor` interface for adapters. `ExecutorRegistry` from harness YAML. CAS locks with file-based state. GateChecker reads manifest data-driven. Heartbeat reclaims stale items every 60s.

Key files: `packages/cli/src/orchestrator/orchestrator.ts`, `packages/cli/src/executor/executor.ts`, `packages/cli/src/harness/gate-checker.ts`.

## Acceptance Criteria

- [ ] **AC1**: Harness v0.2.0 YAML roles define analyst, implementer, reviewer, security with handoff config
- [ ] **AC2**: Gates: spec-approved, code-reviewed, security-clear, human-approved with `blocksHandoff`
- [ ] **AC3**: Flow template `flow-main.yaml` with 6 stages
- [ ] **AC4**: `HandoffPayload` interface with itemId, from, to, summary, evidence, context, timestamp
- [ ] **AC5**: Orchestrator: detectPendingHandoff, emitHandoff, autoClaim (CAS), buildContext, heartbeat
- [ ] **AC6**: `AgenticExecutor` interface: id, capabilities, status, execute(context)
- [ ] **AC7**: ExecutorRegistry loaded from harness YAML at bootstrap
- [ ] **AC8**: Notification: SSE + polling + file watch
- [ ] **AC9**: CAS locks prevent concurrent claims; loser gets "already claimed"
- [ ] **AC10**: Heartbeat timeout reclaims stale items; configurable handoff TTL
- [ ] **AC11**: Handoff rollback when new agent hasn't started work
- [ ] **AC12**: Session log records every handoff with from, to, evidence, timestamp
- [ ] **AC13**: Backward compatible — items without `handoff` work normally
- [ ] **AC14**: Tests: orchestrator, gate checker, concurrency, timeout, cross-adapter
- [ ] **AC15**: GateChecker data-driven from manifest (no hardcoded switches)
- [ ] **AC16**: `promptTemplate` from role YAML; `loadGateStatus()` at correct paths
- [ ] **AC17**: File locks replace in-memory Map; TTL from role YAML
