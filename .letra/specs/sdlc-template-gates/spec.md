# Spec: sdlc-template-gates

> Updated: 2026-06-22

## Outcome

Template SDLC com 8 estágios e 5 gates pré-configurados, incluindo política de permissões para agentes e humanos.

## Constraints

- Gates devem ser hooks opcionais em `writeWorkflow()`.
- Harness é imutável por tag semver.
- Fases aninhadas NÃO entram na v1.

## Exclusions

- Flow Phases Engine (adiado para Fase 3).
- Métricas avançadas (apenas 4 core).
- Templates além de SDLC.

## Acceptance Criteria

- [x] `harness/flows/sdlc.yaml` define 8 stages lineares.
- [x] `harness/gates/*.yaml` define 5 gates com policyRef.
- [x] `harness/roles/*.yaml` define 5 agent roles.
- [x] `letra flow start --template sdlc` instancia fluxo.
- [x] Gate `human-approved-spec` bloqueia avanço sem aprovação.

## Context

Primeiro template built-in. Serve como contrato para Fase 1.
