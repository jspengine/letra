# Spec: incremental-progress

> Updated: 2026-06-22

## Outcome

O agente não precisa escolher entre "mover item completo" ou "não mover nada". Quando faz progresso parcial (ex: 2 de 5 ACs de um item), ele registra quais ACs concluiu sem mover o item de estágio. O histórico fica no diário de bordo, e na próxima sessão ele retoma exatamente de onde parou.

## Constraints

- Mover item de estágio SÓ quando TODOS os ACs estão concluídos — não muda
- 3 cenários: FULL (todos ACs ✅ → move), PARTIAL (alguns ✅ → registra), NONE (nenhum ✅ → registra)
- O progresso parcial é registrado no session-log — não em arquivo separado
- O agente consulta `letra pulse` para ver quantos ACs faltam (antes e depois)
- O handoff-rules é atualizado para incluir os 3 cenários
- Tasks (dentro de um item) são atualizadas manualmente pelo agente no workflow.json? Não — tasks são opcionais e não bloqueiam move
- A regra é clara: ACs definem conclusão, não tasks

## Exclusions

- Percentual de progresso (gráfico, barra) — só contagem de ACs
- Mover item com ACs pendentes "por engano" — não permitido
- Aprovação humana para progresso parcial — agente decide

## Acceptance Criteria

- [ ] **3 cenários documentados**: FULL (move), PARTIAL (log + não move), NONE (log + não move)
- [ ] **Handoff-rules atualizado**: Passo 4 substituído pelos 3 cenários
- [ ] **Progresso parcial**: SÓ move quando todos ACs concluídos — nunca antes
- [ ] **Registro**: `letra log add` usado para marcar progresso parcial
- [ ] **Detecção**: Agente usa `letra pulse --json` para comparar AC counts antes/depois
- [ ] **Continuidade**: session-log + pulse permitem retomar exatamente de onde parou
- [ ] **Tasks não bloqueiam**: Tasks podem ficar abertas mesmo com item movido (só ACs importam)
- [ ] **Testes**: Cenário FULL move, PARTIAL não move e registra, NONE não move e registra

## Context

Este spec resolve o falso dilema "ou move o item completo ou não move nada". Na prática, um item de 6 ACs raramente é concluído em uma única sessão. O agente precisa de um caminho intermediário: registrar o progresso sem fingir que terminou.

O handoff-rules existente já diz "Se um AC foi concluído, mover o item" — isso está errado para progresso parcial. A correção é: mover APENAS se TODOS os ACs estão concluídos; caso contrário, registre no diário e continue.
