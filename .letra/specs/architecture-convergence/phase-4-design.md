# Phase 4 Design - Declarative Activity Context

**Spec**: `architecture-convergence`
**Item**: `ITEM-55`
**Date**: 2026-07-02
**Status**: Implemented - awaiting human review

---

## Objective

Turn `activity-context` into a projection of the active flow and workspace
evidence. Operational intent must come from normalized flow metadata whenever
available, while current workspaces retain a safe compatibility fallback.

This phase changes internal resolution and harness metadata only. Existing
activity kinds and the public `ActivityContext` response remain compatible.

## Current Baseline

Previous convergence work already provides:

- normalized active-flow stages, phases, gates and roles
- stage-level `activity.review` and `activity.gate` metadata
- phase-level `harness.review` and `harness.gate` metadata
- loader normalization for review and gate expectations
- builder consumption of declarative review and gate expectations
- tests proving that neutral stage IDs can drive review and gate context

The remaining builder still owns substantial process intent:

- `OBJECTIVES` is hardcoded by activity kind
- `MUST_NOT_DO` is hardcoded by activity kind
- `buildMustRead` selects evidence through fixed activity branches
- `buildNextActions` defines complete design, implementation and diagnosis
  playbooks in TypeScript
- fallback review and gate wording remains mixed with declarative resolution
- consumers cannot identify whether a hint came from harness metadata or a
  compatibility default

## Design Principles

1. **Harness intent first.** Process-specific guidance belongs to the active
   flow or phase metadata.
2. **Evidence remains derived.** Alert counts, pending ACs and focus divergence
   continue to come from workspace artifacts, not harness declarations.
3. **Builder is a projector.** It combines resolved intent and evidence; it does
   not define a process.
4. **Fallback is explicit.** Legacy workspaces remain functional, and fallback
   provenance is visible.
5. **No stage-name semantics.** Stage and phase IDs are identifiers, never
   behavioral conditions.
6. **One normalized contract.** CLI, Web and adapters consume the same
   `ActivityContext`.

## Declarative Contract

The harness activity metadata is extended with a generic hint contract:

```ts
interface ActivityHintConfig {
  objective?: string;
  mustRead?: Array<{ path: string; reason: string }>;
  mustNotDo?: string[];
  nextActions?: Array<{ label: string; description: string }>;
}

interface StageActivityContextConfig {
  design?: ActivityHintConfig;
  implement?: ActivityHintConfig;
  diagnose?: ActivityHintConfig;
  review?: ActivityHintConfig & ReviewExpectationConfig;
  gate?: ActivityHintConfig & GateExpectationConfig;
}
```

Phase harness metadata may override the stage hints for the active phase. Review
and gate fields remain backward compatible with the metadata already supported.

## Resolution Precedence

For the requested activity, intent is resolved in this order:

1. active phase activity/harness metadata
2. active stage activity metadata
3. flow-level activity defaults, when introduced by the harness
4. explicit compatibility defaults

Arrays are replaced by the most specific declaration rather than merged
implicitly. This prevents a phase from inheriting actions that are invalid for
its narrower responsibility.

The resolver returns provenance for every section:

```ts
type ActivityHintSource =
  | "phase"
  | "stage"
  | "flow"
  | "compatibility";
```

Provenance is internal initially and may be exposed later without changing the
current response contract.

## Evidence Projection

The following signals remain derived from canonical or evidence artifacts:

- current item and stage from `workflow.json`
- active phase from the item state
- pending ACs from the linked spec
- focus divergence from `focus.md`
- active alerts from `health-record.json`
- recent actions from `session-log.json`

Declarative metadata controls how these facts are presented and which actions
are recommended. It cannot suppress high-severity alerts, pending blocking
gates or focus divergence.

## Compatibility

Current `OBJECTIVES`, `MUST_NOT_DO`, evidence references and next actions move
to a named compatibility profile outside `builder.ts`. The profile is used only
when no declarative hints exist for the requested activity.

Compatibility behavior must:

- preserve existing response shapes and safe defaults
- emit a stable internal warning when fallback is used
- avoid stage or phase name lookup
- remain removable after harness coverage is complete

## Implementation Sequence

1. Add generic activity hint types and loader normalization.
2. Extend normalized flow-definition types and cloning.
3. Add an activity-intent resolver with precedence and provenance tests.
4. Move current hardcoded guidance into an explicit compatibility profile.
5. Refactor `builder.ts` to combine resolved intent with derived evidence.
6. Add declarative hints to the canonical harness flow.
7. Verify CLI, Web endpoint and adapter consumers without response changes.

## Implementation Progress

- [x] Generic activity hint types and loader normalization.
- [x] Normalized stage and phase activity metadata.
- [x] Activity-intent resolver with section-level provenance.
- [x] Explicit compatibility profile with stable fallback warning.
- [x] Builder reduced to intent plus derived evidence projection.
- [x] Canonical immutable harness `v0.1.2` declares all activity kinds.
- [x] Focused item takes precedence when multiple items are active.
- [x] CLI and Web consume the same unchanged `ActivityContext` contract.

## Verification Matrix

- neutral stage and phase IDs produce the declared objective and actions
- phase hints override stage hints
- stage hints override compatibility defaults
- omitted arrays do not accidentally merge incompatible actions
- review and gate metadata remain backward compatible
- pending ACs, high alerts and focus divergence remain unsuppressible
- legacy workflows without harness metadata retain current safe behavior
- builder contains no stage/phase name conditionals or process playbooks
- CLI and `/api/activity-context` return equivalent projections
- typecheck, focused tests, build and `letra validate` pass

## Completion Signals

- `builder.ts` contains no hardcoded activity playbook maps or activity switch
- all five activity kinds can receive objective and action hints from harness
- hint resolution has explicit provenance and precedence
- canonical harness content demonstrates every supported activity kind
- existing `ActivityContext` consumers require no branching migration

## Exclusions

- changing the five public activity kinds
- redesigning the Web UI
- making harness metadata able to hide safety signals
- replacing specs, health records or session logs as evidence sources
- introducing an LLM execution engine
- removing legacy fallback in this phase

## Human Gate

Implementation starts only after explicit approval of:

- generic declarative hints for all five activity kinds
- phase-over-stage precedence
- explicit compatibility fallback outside the builder
- unchanged public `ActivityContext` response
