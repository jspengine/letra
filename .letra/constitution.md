# Letra Constitution

**Version:** 1.0.0  
**Date:** 2026-06-21  
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

## Anti-Drift Rules

To avoid losing focus:

1. **No feature without a spec** — every change to the codebase must trace to an AC in a spec under `.letra/specs/`. Features without a spec are forbidden. "Quick fixes" bypassing specs are forbidden.
2. **shadcn-first** — todo componente de UI deve vir de `@letra/ui` ou do registry `@shadcn`. HTML raw (`<button>`, `<select>`, `<input>`, `<textarea>`, `<table>`, `<dialog>`, `<details>`) é proibido para elementos de UI interativos. Elementos semânticos estruturais (`<header>`, `<nav>`, `<main>`, `<section>`) são permitidos. Layouts estruturais devem usar CSS Grid (`grid-cols-*`, `grid-rows-*`) do Tailwind. Todo novo arquivo .tsx com UI deve importar de `@letra/ui` ou do registry shadcn, nunca criar componentes do zero.

## UX Constitution

Letra is not a task manager. Letra is a **supervision interface for autonomous agent teams**.

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

---

## Architecture Shape

Hexagonal (Ports and Adapters):
- Core: pure domain (Workspace, FlowInstance, RepositoryRef, Stage, Gate, Metric)
- Ports: WorkspaceRepository, RepositoryDiscovery, HarnessSynchronizer, FlowEngine, GitOperator
- Adapters: Filesystem, Git, CLI (Commander + Ink), Web (Vite + React)

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

> Orchestrate software development with LLMs in a controlled, auditable, and human-centered way through workspaces that represent solutions, with standardized flows and explicit rules.
