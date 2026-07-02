# Phase 3 Design - Modular flow-serve

**Spec**: `architecture-convergence`
**Item**: `ITEM-56`
**Date**: 2026-07-01
**Status**: Implemented - awaiting human review

---

## Objective

Turn `flow-serve.ts` into a small composition and lifecycle boundary. HTTP
transport, workspace resolution, domain services, recurring automation and
static client delivery must have explicit responsibilities and testable
contracts.

This phase changes internal organization only. Existing HTTP paths, payloads,
status codes, SSE events and workspace artifacts remain compatible.

## Current Baseline

Previous phases already extracted reusable services for:

- active-flow resolution
- activity context
- diagnostics and health synchronization
- SSE events
- spec and context reads
- workspace setup
- recurring system-action definitions

The remaining controller still has:

- 1,423 lines
- 39 route branches in one dispatcher
- 12 duplicated request-body parsing blocks
- 209 direct response operations
- workflow, workspace, specs, items, focus, diagnostics, health, logs and
  filesystem APIs in the same method
- watcher and timer orchestration coupled to HTTP server startup
- two handlers for `GET /api/items/alerts`
- mutable workspace state that route branches access indirectly

Workspace switching also replaces the diagnostic engine and active root without
explicitly rebinding file watchers and the recurring diagnostic schedule.

## Design Principles

1. **Modular by responsibility, not by line count.**
2. **No new HTTP framework.** The server remains based on `node:http`.
3. **Root safety is explicit.** Every request handler receives the resolved root
   associated with that request.
4. **Canonical writes remain behind existing write gateways.** Route modules do
   not write `workflow.json` directly.
5. **Side effects are injected and observable.** Broadcast, logging, focus sync
   and recurring actions are explicit dependencies.
6. **Route modules do not import `FlowServer`.** The composition root depends on
   modules, never the reverse.
7. **One route has one owner.** Duplicate path/method handlers are forbidden.

## Target Shape

```text
packages/cli/src/flow-serve/
  http.ts
  router.ts
  request-context.ts
  automation-runtime.ts
  client-assets.ts
  routes/
    workflow-routes.ts
    workspace-routes.ts
    spec-routes.ts
    item-routes.ts
    diagnostics-routes.ts
    context-routes.ts
    operations-routes.ts
  context.ts
  diagnostics.ts
  events.ts
  specs.ts
  system-actions.ts
  workspace.ts
```

Existing service modules remain in place. Route modules orchestrate them and do
not duplicate their domain logic.

## HTTP Boundary

`http.ts` provides transport-only helpers:

```ts
readJson<T>(req): Promise<T>
sendJson(res, status, payload): void
sendError(res, status, message): void
routeParam(path, pattern): string | null
```

The body reader:

- enforces a bounded payload size
- rejects malformed JSON with a stable `400` response
- never performs domain validation

`router.ts` defines:

```ts
type RouteHandler = (context: RequestContext) => boolean | Promise<boolean>;

class FlowServerRouter {
  register(handler: RouteHandler): void;
  dispatch(context: RequestContext): Promise<boolean>;
}
```

Handlers return `true` only when they own the request. Static client delivery
runs only when no API handler accepts it.

## Request Context

Each request receives an immutable context containing:

- `req`, `res`, `url`, `path`, `method`
- the exact `workspaceRoot` and `workspaceDir` for the URL
- workflow loaded from that same root
- active-flow resolution for that same root when requested
- explicit callbacks for broadcast and runtime transitions

The context must not combine a workflow from one workspace with a harness,
diagnostic engine or write target from another workspace.

Mutable server-wide state remains private to the composition root:

- active workspace
- active directory
- harness binding
- diagnostic engine
- HTTP server

## Route Ownership

### Workflow

- `GET/PATCH /api/workflow`
- `GET /api/workflow/active-flow`
- `POST /api/workflow/template`
- `POST /api/move`

### Workspace

- workspace listing and switching
- managed-directory switching
- setup
- harness template listing
- filesystem directory discovery

### Specs

- spec list/create/update/delete
- spec validation

### Items

- item create/read/update/delete
- claim/release/focus
- one canonical item-alert handler

### Diagnostics

- diagnostics list, scan, snapshots, undo and redo
- health list, scan, acknowledge and dismiss

### Context and Operations

- focus read/clear
- context read
- activity context
- session log
- system actions
- pulse and sitrep

The exact route payload and status compatibility is locked by integration tests.

## Automation Runtime

`automation-runtime.ts` owns:

- workflow watcher
- specs watcher
- diagnostic timer
- startup diagnostic scan
- system-action evidence
- lifecycle cleanup

It exposes:

```ts
start(binding): Promise<void>
rebind(binding): Promise<void>
stop(): void
```

`rebind` closes old watchers and timers before arming the new workspace. Every
armed, triggered, completed or failed action continues to produce system-action
evidence and SSE visibility.

The runtime receives callbacks for diagnostics and broadcasts. It does not know
HTTP routes.

## FlowServer Responsibility

After the migration, `FlowServer` is responsible only for:

- constructing runtime dependencies
- maintaining active workspace binding
- creating request contexts
- dispatching registered route modules
- serving/proxying client assets
- starting and stopping HTTP and automation runtimes

It contains no request-body parsing, domain mutation or route-specific response
composition.

## Incremental Sequence

1. Add HTTP helpers, request context and router with unit tests.
2. Extract item routes, including removal of the duplicate alert route.
3. Extract spec, diagnostics and context/operations routes.
4. Extract workflow and workspace routes.
5. Extract static client delivery.
6. Extract and rebind the automation runtime.
7. Reduce `FlowServer` to composition and lifecycle.

Each extraction keeps the integration suite green before the next route family
moves.

## Implementation Progress

- [x] HTTP helpers, immutable request context and first-owner router added with
  unit coverage.
- [x] SSE registered through the router as the first extracted route.
- [x] Item routes and canonical item-alert ownership.
- [x] Spec routes and canonical spec-write gateways.
- [x] Diagnostics and health routes with request-root isolation.
- [x] Context and operations routes.
- [x] Workflow routes.
- [x] Workspace routes.
- [x] Static client delivery.
- [x] Rebindable automation runtime.
- [x] Final composition-root reduction.

## Verification Matrix

- router stops after the first matching handler
- malformed and oversized JSON produce stable client errors
- every current API path preserves status and payload shape
- item-alert route has one owner
- each route uses the workspace root from its request context
- multi-workspace workflow, item, spec and diagnostics requests remain isolated
- workspace switch rebinds watchers and diagnostic scheduling
- start/stop closes HTTP, SSE, watchers and timers without leaks
- recurring actions remain visible with cause and effect
- static client and Vite proxy behavior remain unchanged
- `flow-serve.ts` contains no route body parsing or domain writes
- targeted tests, full CLI tests, typecheck, build and `letra validate` pass

## Completion Signals

- `flow-serve.ts` is at most 400 lines
- route families have independent unit coverage
- all 39 current route contracts have one explicit owner
- no duplicate path/method branch remains
- no handler reads mutable server root state implicitly

## Exclusions

- migration to Express, Fastify or another HTTP framework
- API versioning or endpoint redesign
- authentication and authorization redesign
- WebSocket migration
- changes to workflow, harness or diagnostic schemas
- new automation behavior
- visual UI changes

## Human Gate

Implementation starts only after explicit approval of this design. Approval
confirms:

- internal route modules without public API changes
- explicit per-request root context
- automation rebind on workspace change
- incremental extraction rather than a full server rewrite
