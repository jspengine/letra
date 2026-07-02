# Spec: phase-engine-tests

> Updated: 2026-06-22

## Outcome

O módulo `phases/engine.ts` tem cobertura de testes unitários para todos os cenários principais: enterStage, transitionPhase, validação de transições, auto transitions, `__EXIT__`, e casos de erro (stage sem phases, fase inexistente).

## Constraints

- Usar `vitest` (framework já existente no projeto).
- Testes devem ser determinísticos — sem depender de filesystem real (usar objetos mock).
- Travar cobertura mínima de 90% das branches do engine.ts.

## Exclusions

- Não testar `buildHarnessSnapshot` ou adapter generation — já têm testes próprios.
- Não testar CLI commands (`flow phases`, `flow phase-transition`) — testes de integração separados.

## Acceptance Criteria

- [x] **AC1**: `enterStage()` com stage que tem phases → `currentPhase` = `initialState`.
- [x] **AC2**: `enterStage()` sem phases → `currentPhase` = `undefined`, `ok: true`.
- [x] **AC3**: `enterStage()` com `initialState` que não existe nas states → `ok: false` com erro descritivo.
- [x] **AC4**: `transitionPhase()` válida → `currentPhase` atualizado, `ok: true`, `phase` = target.
- [x] **AC5**: `transitionPhase()` inválida (transição não definida) → `ok: false` com "Transition from X to Y not allowed".
- [x] **AC6**: `transitionPhase()` para `__EXIT__` → `currentPhase = undefined`.
- [x] **AC7**: `transitionPhase()` com `auto: true` na transição → avança automaticamente para a próxima fase.
- [x] **AC8**: `transitionPhase()` em stage sem phases → `ok: false` com "Stage X has no phases defined".
- [x] **AC9**: `transitionPhase()` para fase inexistente → `ok: false` com "Phase X not found in stage Y".
- [x] **AC10**: `getStagePhases()` retorna `null` para stage inexistente ou sem phases.
- [x] **AC11**: `getPhaseDef()` retorna `null` para phaseId inexistente.
- [x] **AC12**: `getPhaseHarness()` retorna harness da fase atual, ou `null` se não houver.
- [x] **AC13**: Auto-transition em cadeia (A→B auto, B→C auto) funciona — testar 2 níveis.
- [x] **AC14**: Testes rodam com `vitest run packages/cli/src/phases/` sem falhas.

## Context

Zero testes hoje para o engine de phases. Como é o coração da máquina de estados aninhada, precisa de cobertura sólida antes de adicionar mais funcionalidades (action runner, autopilot).
