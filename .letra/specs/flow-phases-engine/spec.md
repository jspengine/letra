# Spec: flow-phases-engine

> Updated: 2026-06-22

## Outcome

Estágios podem conter fases internas (sub-máquina de estados) com transições, ações e gates próprios.

## Constraints

- Máximo 1 nível de aninhamento (fases não contêm fases).
- Fases são opcionais — estágio sem fases funciona como hoje.
- Harness regenerado a cada transição de fase.

## Exclusions

- Fases aninhadas (N>1).
- Gatilhos externos (webhook-triggered phase transitions).
- DSL avançada para definição de fases (YAML/JSON por enquanto).

## Acceptance Criteria

- [x] **AC1**: StageDef ganha campo `phases: { initialState, states: Record<PhaseId, PhaseDef> }`.
- [x] **AC2**: `PhaseDef` define: id, label, description, actions, transitions, harness?
- [x] **AC3**: Phase engine: `enterStage()` seta fase inicial, `transitionPhase()` valida + avança.
- [x] **AC4**: CLI: `letra flow phases <item-id>` mostra fase atual do item.
- [x] **AC5**: CLI: `letra flow phase-transition <item-id> <phase>` transiciona fase.
- [x] **AC6**: flow-move chama `enterStage()` ao mover item para novo estágio.
- [x] **AC7**: Adapter regenerado com harness contextual da fase atual.

## Context

Pilar 1b da arquitetura — máquina de estados aninhada para estágios como Code Review que têm sub-fluxos (auto-review → fix → re-review → human-review).
