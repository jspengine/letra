# Phase 2 Design - UI as Active Flow Renderer

**Spec**: `architecture-convergence`
**Item**: `ITEM-54`
**Date**: 2026-07-01
**Status**: Implemented - awaiting review

---

## Objective

Make the Web UI a projection of the active flow resolved by the Flow Definition
Service. Stage order, labels, roles, gates, phases and operational states must no
longer depend on known stage IDs or fabricated client-side data.

This phase preserves the current Letra visual identity. It changes semantic
authority, not the product's visual language.

## Current Baseline

Phase 1 provides one serialized `ResolvedFlowDefinition` with:

- ordered stages and zones
- normalized roles and human-readable role labels
- normalized stage and phase gates
- phases and activity hints
- provenance and compatibility warnings

The client already fetches `/api/workflow/active-flow`, but still owns process
semantics in several places:

1. `active-flow.ts` chooses icons by matching IDs such as `review`, `security`,
   `design`, `spec`, `pr` and `discovery`
2. `FlowView` and `KanbanBoard` rebuild parts of the pipeline from
   `workflow.stages` instead of the resolved stage union
3. `KanbanBoard`, `ActivityTimeline`, `KanbanView` and `PhaseBadge` assign states
   or colors from known stage and phase IDs
4. `AgentDetail` exposes static agents, models, prompts, tools and metrics that
   do not come from workspace or harness state
5. execution output contains fabricated duration and completion text
6. flow degradation warnings returned by Phase 1 are not visible

## Authority Rules

1. `workflow.json` remains authoritative for item location, claims and current
   phase.
2. `ResolvedFlowDefinition` is authoritative for stage order, stage labels,
   zones, roles, gates, phases and compatibility warnings.
3. The UI may derive presentation state from canonical facts, but it may not
   infer domain meaning from an ID string.
4. Missing semantic metadata produces a neutral presentation. The UI must not
   invent agents, gates, security states, durations or execution metrics.
5. Compatibility fallback remains operational and visibly degraded.

## Central Client Projection

`packages/client/src/lib/active-flow.ts` remains the client projection boundary.
Components must consume projections from this module rather than reproduce
stage semantics locally.

The module will expose pure helpers equivalent to:

```ts
orderedStages(workflow, activeFlow)
stagePresentation(stage)
itemOperationalState(item, workflow, activeFlow)
pipelineProjection(workflow, activeFlow)
roleCatalog(activeFlow)
flowWarnings(activeFlow)
```

`stagePresentation` derives only from semantic fields:

- `zone === "done"`: completed presentation
- blocking human gate: waiting for human decision
- blocking automated or external gate: blocked/waiting presentation
- normalized role: role label and generic agent presentation
- otherwise: neutral stage presentation

Icons and colors represent these generic states. They do not represent stage
names. A stage without semantic hints receives a neutral icon and token.

## Surface Changes

### App and Execution

- build execution stages from `orderedStages`
- use normalized role labels and gates
- use the first resolved stage for rollback/rejection targets
- remove fabricated durations
- remove completion claims not supported by transactional evidence
- replace the fixed “pipeline SDLC” copy with the active flow name

### Home and Flow

- derive pipeline, gate cards, counts and labels from the shared projection
- include instance-only and template-only stages returned by Phase 1
- remove security/review checks based on stage IDs
- display `FlowDefinitionWarning[]` through the existing `Alert` component
- keep warnings non-blocking and identify their artifact reference

### Kanban and Timeline

- order columns from the resolved flow
- derive item state from zone, gate and claim data
- remove synthetic agent names
- remove fixed `security`, `ready-to-pr`, `review` and `done` branches
- render phases with a neutral semantic badge unless the contract later gains
  explicit visual metadata

### Agents

- replace the static agent catalog with normalized harness roles
- show label, description, allowed stages and capabilities
- show claimed runtime actors separately when they exist in workflow items
- do not display model, online status, prompts, run history or metrics unless a
  future canonical runtime source provides them

## shadcn-first

No new UI primitive is required. Existing components from `@letra/ui` are used:

- `Alert` for flow degradation
- `Badge` for roles, capabilities, phases and gate type
- `Card` for role and pipeline composition
- `EmptyState` when no roles or runtime actors exist
- `Skeleton` variants for loading

Structural layout continues to use Tailwind CSS Grid. No raw interactive HTML
element is introduced.

## Compatibility

When `activeFlow` is unavailable:

- workflow stages remain visible in persisted order
- role and gate metadata remain empty
- the UI uses neutral labels and icons
- no stage meaning is inferred from IDs

When the flow contains drift:

- the full stage union remains visible
- provenance is retained in the projection
- warnings are displayed without mutating canonical state

## Implementation Sequence

1. Add pure semantic projections and unit tests in `active-flow.ts`.
2. Migrate App, Home, Flow and Execution pipeline construction.
3. Migrate Kanban, Timeline and phase presentation.
4. Replace static agent data with roles and claimed runtime actors.
5. Add visible compatibility warnings.
6. Add component-level regressions and run accessibility checks.

## Verification Matrix

- a flow with arbitrary IDs renders harness order and labels
- changing a harness stage label changes all visible pipeline labels
- normalized role labels replace raw role IDs where available
- human, automated and external gates produce semantic states without ID checks
- template-only and instance-only stages remain visible
- compatibility warnings are rendered through `Alert`
- no synthetic agent, metric, duration or run-history data remains
- fallback without `activeFlow` remains usable and neutral
- no client process branch checks stage or phase IDs
- client tests, accessibility tests, typecheck, build and `letra validate` pass

## Exclusions

- visual rebrand or new navigation architecture
- new runtime telemetry for agents
- changes to gate approval APIs
- changes to transactional item or phase state
- new icon or color metadata in the harness schema
- server modularization beyond what is required to consume the existing endpoint

## Human Gate

Implementation starts only after explicit approval of this design. Approval
confirms:

- semantic state replaces stage-ID heuristics
- fabricated agent and execution data is removed
- the active-flow projection is the only client semantic boundary
- flow degradation warnings become visible
