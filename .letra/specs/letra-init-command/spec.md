# Spec: letra-init-command

> Updated: 2026-06-22

## Outcome

Usuário consegue inicializar um projeto Letra com `letra init` ou `letra flow init`, selecionando template, stages e ferramentas agenticas.

## Constraints

- Jornada segue regra: pulse → context → focus → spec.
- Detecta ferramentas existentes automaticamente.
- Sem etapa de escolha monorepo/multi-repo.

## Exclusions

- Wizard interativo complexo (simplificado para flag-based default).
- Suporte a templates customizados externos na v1.

## Acceptance Criteria

- [x] `letra flow init --quick` cria `.letra/workflow.json`.
- [x] Detecta `.hermes/instructions.md`, `AGENTS.md`, etc.
- [x] Salva `tools` no workflow e regenera adapters.

## Context

 Parte da Fase 0 — descoberta e setup do workspace. Base para dogfooding.
