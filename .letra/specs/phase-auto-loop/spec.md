# Spec: phase-auto-loop

> Updated: 2026-06-22

## Outcome

Um `PhaseAutoPilot` que, após `enterStage()` ou `transitionPhase()`, verifica se a fase de destino tem transições com `auto: true` e as executa em cadeia até chegar numa fase sem auto-transition ou em `wait-human`. O loop roda sem intervenção manual.

## Constraints

- Máximo de 10 auto-transições por ciclo (proteção contra loop infinito).
- Se uma auto-transição falha (action executada retorna erro), o loop para e loga o erro.
- Auto-transição para `__EXIT__` é permitida e limpa `currentPhase`.
- Auto-loop executa actions de cada fase intermediária via `PhaseActionRunner`.

## Exclusions

- Não implementar agendamento temporal (delayed auto-transitions).
- Não implementar rollback automático em caso de falha.

## Acceptance Criteria

- [x] **AC1**: `PhaseAutoPilot` criado em `packages/cli/src/phases/autopilot.ts`.
- [x] **AC2**: `autopilot.run(root, workflow, item)` inicia o loop a partir da fase atual.
- [x] **AC3**: Em cada iteração: executa actions da fase atual → verifica se há auto-transition → se sim, transiciona e continua.
- [x] **AC4**: Se a fase atual não tem auto-transition, o loop para (aguarda ação manual).
- [x] **AC5**: Se a ação de uma fase falha, loop para e loga erro com detalhes.
- [x] **AC6**: Se atingir 10 auto-transições sem parar, loop é interrompido com erro "Auto-loop limit exceeded".
- [x] **AC7**: Auto-transition para `__EXIT__` limpa `currentPhase` e encerra o loop com sucesso.
- [x] **AC8**: Cada transição e execução é logada no session-log.
- [x] **AC9**: `enterStage()` pergunta se deve iniciar autopilot (padrão: sim, se houver auto-transition na fase inicial).
- [x] **AC10**: `letra flow autopilot <item-id>` dispara o loop manualmente.

## Context

Engine suporta `"auto": true` nas transições, mas não há driver que execute a cadeia automaticamente. Exemplo: code-review começa em auto-review (que tem auto-transition para code-fix), mas hoje o usuário precisa chamar `phase-transition` manualmente. O autopilot preenche esse gap.
