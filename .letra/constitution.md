# Letra Constitution

**Version:** 1.2.0
**Date:** 2026-07-03
**Status:** Ratified

---

## Preamble

Letra exists to orchestrate software development with LLMs in a controlled, auditable, human-centered way. This constitution defines the non-negotiable principles that govern every architectural decision, every line of code, and every feature.

---

## Principle 1: Human in the Loop

No destructive or irreversible action (merge, deploy, create branch) is executed without explicit human approval via gate.

**Rules:**
- All gates require human sign-off before advancing.
- LLMs generate content; humans make directional decisions.
- Security and public API changes always require human review.

---

## Principle 2: Workspace is Context

The workspace represents the solution, not the repository. A workspace aggregates N repositories/folders under a single flow line.

**Rules:**
- Workspace is the only unit of value.
- No feature may introduce "project" as a root aggregate.
- One workspace = one solution in progress (e.g., "PIX no crédito").

---

## Principle 3: Harness is Authority

All Letra behavior (flows, gates, personas, metrics) is defined in the versioned harness, not hardcoded in the CLI.

**Rules:**
- Every new feature must first exist as harness content (template, persona, rule).
- CLI is a thin adapter that reads and executes harness directives.
- Harness is immutable by tag; workspaces reference a version.

---

## Principle 4: Nothing is Magic

Every Letra action generates a traceable artifact (manifest, flow.json, metrics.jsonl). No black boxes.

**Rules:**
- All state changes are append-only.
- Every generated artifact references its source (prompt, rules, workspace).
- Users can inspect, diff, and rollback any harness or workspace file.

---

## Principle 5: LLM is a Tool, Not the Owner

LLMs generate content (specs, code, reviews), but directional decisions are human via gates.

**Rules:**
- Max 3 personas in v1 (reviewer, security, analyst).
- Personas have explicit constraints (max files, require tests, forbidden actions).
- LLM output is always presented for human approval before side effects.

---

## Principle 6: Product Truth and User Intent

Letra is the local control plane for AI-assisted software delivery. It connects a workspace to agentic tools, preserves canonical context and rules, supervises work progression, requests human decisions at critical points, and records evidence. The product must never imply an autonomous capability, execution state, or agent behavior that is not supported by real, traceable state.

**Rules:**
- Product architecture and navigation are organized around user intent, not internal artifacts, files, components, or implementation boundaries.
- Every primary surface must answer at least one user question: what needs my decision, what is happening, what is being built, under which rules, or what evidence exists.
- Workspace and active scope are global context selectors, not peer destinations in the primary navigation.
- Pending human decisions are first-class information and must never be hidden as secondary status.
- Names, status labels, animations, and actions must reflect actual product capabilities. Simulated agency or unsupported operational claims are forbidden.
- Duplicate destinations, inert controls, and actions without observable outcome are constitutional defects because they erode operational trust.
- Technical vocabulary such as harness, spec, target, stage, and adapter may be exposed only when it is necessary for the user's decision and is explained in the interface.
- New product specs must explicitly state how they preserve product truth, user intent, harness authority, human supervision, and traceability.
- When a legacy screen, roadmap, or spec conflicts with this principle, this principle takes precedence until the conflicting artifact is revised.

This principle is non-negotiable for all product, UX, architecture, content, and implementation decisions.

---

## Principle 7: Regression Safety Before Expansion

Every change must preserve trusted behavior before expanding product capability. Regression prevention is part of feature design, not a final testing activity. A feature is incomplete until its affected contracts and existing user journeys have verifiable protection.

**Rules:**
- Every spec must identify the existing behaviors, contracts, invariants, data, routes, commands, and user journeys that may be affected.
- Before implementation, the team must establish a regression baseline for the affected surface through existing tests, characterization tests, or explicit behavior evidence.
- Every bug fix must include a test that fails before the correction and passes after it. When automation is technically impossible, the spec must record the reason and a reproducible manual verification.
- Test depth must be proportional to risk. Unit, integration, contract, component, end-to-end, build, typecheck, lint, migration, and rollback checks are selected according to the affected boundaries.
- Targeted tests are necessary but not sufficient. The affected suite and relevant cross-boundary tests must also run before completion.
- Existing tests may not be deleted, weakened, skipped, or rewritten solely to make a change pass. Any intentional behavior change requires an updated spec, explicit rationale, and review of the superseded expectation.
- Canonical schema, storage, harness, adapter, API, and workflow changes require backward-compatibility analysis and a safe migration or rollback strategy.
- Known pre-existing failures must be separated from failures introduced by the change. New failures may not be normalized as existing debt.
- Test counts alone are not evidence. Verification must demonstrate preserved behavior and domain invariants.
- No feature or AC may be declared complete without recorded regression evidence.

This principle applies immediately to every feature, refactor, bug fix, migration, dependency update, and configuration change.

---

## Anti-Drift Rules

To avoid losing focus:

1. **No feature without a spec** — every change to the codebase must trace to an AC in a spec under `.letra/specs/`. Features without a spec are forbidden. "Quick fixes" bypassing specs are forbidden.
2. **shadcn-first** — todo componente de UI deve vir de `@letra/ui` ou do registry `@shadcn`. HTML raw (`<button>`, `<select>`, `<input>`, `<textarea>`, `<table>`, `<dialog>`, `<details>`) é proibido para elementos de UI interativos. Elementos semânticos estruturais (`<header>`, `<nav>`, `<main>`, `<section>`) são permitidos. Layouts estruturais devem usar CSS Grid (`grid-cols-*`, `grid-rows-*`) do Tailwind. Todo novo arquivo .tsx com UI deve importar de `@letra/ui` ou do registry shadcn, nunca criar componentes do zero.
3. **No completion without regression evidence** — every completed AC must reference the protected behavior, the verification performed, and any known residual risk.

## UX Constitution

Letra is not a task manager. Letra is a **supervision and governance interface for AI-assisted software delivery**.

1. **Agent behavior first, cards second** — whenever there is a choice between highlighting a card (the work) and highlighting agent activity (the behavior), always choose agent activity. Cards represent *what*; agents and their decisions represent *how* and *why*.
2. **Visibility of agency** — every visible element must make the agent's presence, decision, or state obvious. A gate is not a status badge; it is an agent asking a question. A stage transition is not a drag-and-drop; it is an agent completing work and requesting the next.
3. **No silent automation** — if an agent acts, the UI must show it acting: who, what, when, and why. Background processing without UI trace is forbidden.
4. **The user supervises, not operates** — avoid multi-click workflows, form-heavy CRUD, and drag-drop reordering. The user's primary action is reviewing, approving, and directing — not shuffling cards.
2. **No complexity without demand** — nested phases, 15 metrics, multi-template only enter if explicitly requested by users.
3. **Harness first, CLI second** — every product feature is born in the harness, not in CLI code.
4. **Max 3 personas in v1** — reviewer, security, analyst. No invented roles.
5. **Every command has dry-run** — `letra review --dry-run`, `letra pr --dry-run`. No direct action.
6. **Metrics are derived, not instrumented** — cycle_time = `stage.done - stage.start`. No complex logging.
7. **Workspace is the only root aggregate** — never return to "project" as the top-level entity.
8. **User questions before product objects** — navigation begins with supervision, work, knowledge and evidence; it does not mirror internal files or components.
9. **Operational truth before visual theater** — an agent, run, status or action is shown only when backed by real and inspectable state.
10. **Trust defects block expansion** — duplicate routes, inert controls, discarded decisions and misleading labels are corrected before new capabilities are added.

---

## Architecture Shape

Hexagonal (Ports and Adapters):
- Core: pure domain (Workspace, FlowInstance, RepositoryRef, Stage, Gate, Metric)
- Ports: WorkspaceRepository, RepositoryDiscovery, HarnessSynchronizer, FlowEngine, GitOperator
- Adapters: Filesystem, Git, CLI (Commander + Ink), Web (Vite + React)

---

## API Design Rules

All HTTP endpoints in `flow-serve` follow these conventions.

### Prefix and Separation

- REST endpoints use `/api/*` prefix (e.g., `/api/items`, `/api/specs`)
- SSE (Server-Sent Events) uses `/events` — separated because it is a persistent stream, not request/response
- Static files served from `/` (SPA fallback)

### Route Naming

- Plural nouns: `/api/items`, `/api/specs`, `/api/workflows`
- Actions as sub-paths: `/api/items/:id/claim`, `/api/items/:id/release`
- Query params for filters: `/api/log?page=2&limit=10`

### HTTP Methods

- GET → read (no side effects)
- POST → create or trigger action (with side effects)
- PATCH → partial update
- DELETE → removal

### Where to Register Routes

- All REST routes live in `packages/cli/src/flow-serve/routes/`
- Each file is a factory function: `createXxxRoutes(deps) → RouteHandler`
- The `/events` endpoint is the exception — registered inline in `flow-serve.ts`

### Dependency Injection

- Route handlers receive dependencies via parameters (no static imports)
- Every mutation calls `logEntry()` for traceability (Principle 4)

### SSE on the Client

- Use `createEventSourceWithReconnect()` from `lib/withReconnect.ts`
- Never raw `new EventSource()` — it lacks automatic reconnection

---

## Stack

- Language: Node/TypeScript
- CLI: Commander + Ink (TUI)
- SPA: Vite + React (standalone, not embedded)
- Git: simple-git
- Config: cosmiconfig / hierarchical
- Metrics: PostHog/Plausible opt-in
- CI/CD: GitHub Actions + @vercel/ncc

---

## Mission Statement

> Provide a local control plane for AI-assisted software delivery, allowing people to understand what is happening, decide at critical points, inspect the governing rules, and verify the evidence.
