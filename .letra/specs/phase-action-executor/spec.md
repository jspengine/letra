# Spec: phase-action-executor

> Updated: 2026-06-22

## Outcome

As actions definidas em cada `PhaseDef` são realmente executadas — `command` spawna um processo, `agent-prompt` escreve instruções para o agente, `notify-human` envia notificação, `wait-human` bloqueia até aprovação. O `PhaseActionRunner` dispatche cada tipo de action e reporta resultado.

## Constraints

- Execução de `command` usa `child_process.exec` com timeout configurável (padrão 30s).
- `wait-human` bloqueia até o gate YAML ser aprovado via `letra ac approve <gate-id>`.
- Actions falhas não quebram o item — erro é logado e o item permanece na fase atual.
- Toda execução de action gera entrada no session-log.

## Exclusions

- Não implementar webhook-triggered actions.
- Não implementar fila de execução concorrente (apenas síncrono, uma action por vez).

## Acceptance Criteria

- [x] **AC1**: `PhaseActionRunner` criado em `packages/cli/src/phases/runner.ts`.
- [x] **AC2**: `runner.execPhase(root, item, phaseDef)` executa todas as actions da fase em sequência.
- [x] **AC3**: Action type `command` executa via `execSync` com timeout e captura stdout/stderr.
- [x] **AC4**: Action type `agent-prompt` escreve `.letra/phase-prompt.md` com o prompt da action + contexto do item.
- [x] **AC5**: Action type `generate-report` gera relatório markdown em `.letra/reports/<item-id>-<phase>.md`.
- [x] **AC6**: Action type `notify-human` loga no session-log com nível "human" + escreve `.letra/human-notify.md`.
- [x] **AC7**: Action type `wait-human` lê o gate YAML referenciado e bloqueia até `human-approved` status ser `true`.
- [x] **AC8**: `transitionPhase()` retorna `triggeredActions` executados (não apenas descrições).
- [x] **AC9**: Actions falhas são logadas como erro no session-log, item permanece na fase.
- [x] **AC10**: `letra phase-run <item-id>` executa actions da fase atual manualmente.

## Context

O engine de phases já enumera e descreve as actions, mas não as executa. O `transitionPhase()` retorna `triggeredActions` como strings ("command: npm run fix") em vez de rodar de fato. O runner preenche esse gap.
