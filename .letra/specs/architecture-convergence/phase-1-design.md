# Phase 1 Design - Flow Definition Service

**Spec**: `architecture-convergence`
**Item**: `ITEM-53`
**Date**: 2026-06-29
**Status**: Implemented - awaiting review

---

## Objective

Evolve the active flow resolver created in Phase 0 into the single internal
Flow Definition Service consumed by CLI, server, activity context and Web UI.

The service must expose a normalized and immutable read model for:

- stages and their order
- gates, including phase transition gates
- phases and transitions
- roles and their human-readable labels
- operational activity hints
- provenance and compatibility warnings

This phase does not move transactional state out of `workflow.json` and does
not make the Web UI a complete generic renderer. That semantic cleanup belongs
to Phase 2.

## Current Baseline

Phase 0 established:

- `resolveActiveFlow(root)` as the single entry point
- `ResolvedFlowDefinition` with stages, stage gates, agents, phases and
  activity metadata
- consumption by `flow-move`, `flow-serve` and `activity-context`
- `GET /api/workflow/active-flow` for the Web UI
- harness version binding through `workflow.harnessVersion`

The remaining gaps are:

1. role IDs are exposed, but role labels and capabilities are not normalized
2. phase transition gates remain raw string references
3. server resolution can use the active server root instead of the root that
   supplied a workflow in multi-workspace requests
4. client and CLI maintain parallel definitions of the active-flow contract
5. fallback mode is identified by `source`, but degradation details are not
   explicit
6. template stages can hide instance-only stages instead of reporting drift

## Authority Model

The service follows this precedence:

1. `workflow.json` is authoritative for transactional workspace state,
   including items, current stage and current phase
2. the versioned harness is authoritative for flow semantics
3. persisted workflow stages provide compatibility data and instance-only
   extensions
4. built-in defaults are bootstrap material only and never runtime authority

The normalized definition is a derived artifact. It is never written back as
canonical state.

## Public Contract

The existing module remains the service boundary:

- `packages/cli/src/flow-definition/types.ts`
- `packages/cli/src/flow-definition/resolve.ts`

No second resolver or service class will be introduced.

```ts
interface ResolvedFlowDefinition {
  id: string | null;
  source: "workflow-template" | "workflow-instance" | "legacy-fallback";
  harnessVersion: string | null;
  templateVersion: string | null;
  name: string;
  stages: ResolvedFlowStage[];
  roles: ResolvedFlowRole[];
  warnings: FlowDefinitionWarning[];
}

interface ResolvedFlowRole {
  id: string;
  label: string;
  description: string;
  allowedStages: string[];
  capabilities: string[];
}

interface ResolvedFlowStage {
  id: string;
  name: string;
  order: number;
  zone?: "todo" | "doing" | "done";
  description?: string;
  roleIds: string[];
  roles: ResolvedFlowRole[];
  gate: ResolvedFlowGate | null;
  phases?: ResolvedStagePhases;
  activity?: StageActivityContextConfig;
  provenance: "harness" | "workflow-instance";
}
```

`ResolvedStagePhases` preserves declarative actions and harness hints, but
normalizes every transition gate to `ResolvedFlowGate | null`. Missing gate
references generate warnings rather than silent omission.

`FlowDefinitionWarning` contains a stable code, message and optional artifact
reference. Initial warning codes are:

- `HARNESS_UNAVAILABLE`
- `TEMPLATE_NOT_FOUND`
- `GATE_NOT_FOUND`
- `ROLE_NOT_FOUND`
- `INSTANCE_STAGE_NOT_IN_TEMPLATE`
- `TEMPLATE_STAGE_NOT_IN_INSTANCE`

## Resolution Rules

### Bound template

When `workflow.template` resolves in the selected harness:

- harness order, names, zones, descriptions, gates, phases and activity hints
  are authoritative
- workflow items and item phase state remain untouched
- stage role IDs resolve against `harness.roles`
- unmatched workflow stages remain visible as compatibility extensions and
  receive `INSTANCE_STAGE_NOT_IN_TEMPLATE`
- harness stages absent from the persisted instance remain visible and receive
  `TEMPLATE_STAGE_NOT_IN_INSTANCE`

This union prevents items from becoming invisible while keeping semantic drift
observable.

### Workflow instance

When no template is declared:

- workflow stages form the complete definition
- persisted phases remain available
- gates and roles are empty because no semantic authority declared them
- source is `workflow-instance`

### Legacy fallback

When a template is declared but cannot be resolved:

- workflow stages keep the workspace operational
- source is `legacy-fallback`
- warnings identify the unavailable harness or template
- no gate, role or policy is invented

## Workspace-Root Safety

Every resolution must receive the root associated with the workflow being
resolved. Server helpers must use `workspaceRootFor(url)` and must not combine
a workflow from one workspace with a harness from another.

The preferred server API is:

```ts
resolveActiveFlowFor(root: string, workflow?: Workflow | null)
```

`resolveActiveFlow(root)` remains the convenience entry point that loads the
workflow itself.

## Shared Consumer Contract

The HTTP payload for `GET /api/workflow/active-flow` is the serialized
`ResolvedFlowDefinition`.

The client-facing contract moves to `@letra/types`, avoiding a manually
duplicated interface in `packages/client/src/lib/active-flow.ts`. Client helper
functions remain client-side projections and do not become domain authority.

Initial consumer responsibilities:

| Consumer | Uses from the service |
|---|---|
| `flow-move` | ordered stages and normalized blocking gates |
| `flow-serve` | exact workspace resolution and serialized read model |
| `activity-context` | stage/phase activity hints and normalized gate metadata |
| Web UI | stage order, labels, roles and gate metadata |

Removing all stage-ID-based visual choices from the UI remains Phase 2.

## Immutability

The returned read model must not share mutable arrays or objects with the
loaded workflow or harness. Consumers may sort or project the result without
mutating canonical input.

The resolver performs no file writes, adapter regeneration, logging or
diagnostic mutation. Observability is returned as warnings and handled by the
calling surface.

## Implementation Sequence

1. Extend the shared types for roles, normalized phases and warnings.
2. Refactor resolution into small pure functions for gates, roles, phases and
   template/workflow stage reconciliation.
3. Add root-safe `resolveActiveFlowFor`.
4. Move the serialized contract to `@letra/types`.
5. Adapt `flow-move`, `flow-serve`, `activity-context` and client helpers.
6. Add unit and HTTP integration coverage.

## Verification Matrix

Required tests:

- bound template resolves stages, roles, labels, gates, phases and activity
  hints
- phase transition gate references resolve to complete gate objects
- missing role and gate references produce stable warnings
- instance-only stages remain visible with provenance and warning
- template-only stages remain visible with warning
- unavailable harness and missing template preserve legacy operation
- returned data cannot mutate workflow or harness inputs
- multi-workspace API requests use the matching harness version and root
- CLI, activity context and HTTP API observe the same normalized definition
- existing Phase 0 compatibility tests remain green

## Completion Criteria

Phase 1 is complete when:

- one shared contract represents the active flow across CLI and Web
- roles and phase gates are normalized instead of exposed as unresolved IDs
- compatibility degradation is explicit and testable
- multi-workspace resolution cannot cross workspace roots
- all four initial consumers use the same service boundary
- typecheck, build, targeted tests and `letra validate` complete without
  failures

## Risks and Mitigations

### Contract expansion breaks the client

Mitigation: fields are added incrementally, the endpoint remains backward
compatible during migration, and the client switches to shared types in the
same change.

### Harness and workflow stage sets diverge

Mitigation: return their union, identify provenance and emit warnings. Do not
silently delete or invent transactional state.

### Phase normalization changes execution behavior

Mitigation: preserve actions and transitions verbatim except for resolved gate
metadata; phase execution continues to use declarative IDs.

### Phase 1 absorbs Phase 2

Mitigation: this phase supplies normalized labels and hints, but does not
redesign visual heuristics or remove every stage-specific UI branch.

## Human Gate

Implementation starts only after explicit approval of this design. Approval
confirms:

- extension of the current resolver instead of creation of a parallel service
- union behavior for harness and instance stage drift
- warnings as the non-mutating degradation mechanism
- shared type contract through `@letra/types`
