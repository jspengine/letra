# Spec: harness-loader-implementation

> Updated: 2026-06-22

## Outcome

Implementar o carregamento do harness versionado no CLI do Letra, incluindo parser YAML e validação de schema.

## Constraints

- Parser customizado sem dependências externas.
- Harness imutável por tag semver.
- Suporta flows, gates, roles, policies.

## Exclusions

- DSL avançada para gates (adiado).
- Validação runtime com JSON Schema.

## Acceptance Criteria

- [x] `loadHarness()` carrega `flows`, `gates`, `roles`, `policies`.
- [x] `/api/harness/templates` retorna template completo com gates e roles.
- [x] Parser suporta listas, objetos e block scalars.

## Context

 Parte do Épico 1 — Fundação. Dogfood do Letra.
