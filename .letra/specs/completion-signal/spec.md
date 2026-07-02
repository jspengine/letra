# Spec: completion-signal

> Updated: 2026-06-22

## Outcome

O agente sabe exatamente quando parar de trabalhar e como sinalizar conclusão para o humano. Não fica em loop infinito processando um backlog vazio. Não move itens que não deveria. No fim de cada sessão, produz um relato do que fez e entrega a vez.

## Constraints

- A seção "Checklist de Encerramento" aparece no adaptador quando há workflow
- Três estados de conclusão: ALL_DONE, BLOCKED, CONTINUE
- O agente detecta o estado via `letra pulse --json` — não adivinha
- O relato de sessão é texto livre (agente escreve) — não estruturado
- A seção é gerada automaticamente junto com os adaptadores
- Não substitui o handoff — o handoff cobre "o que fazer depois de cada ação", o encerramento cobre "quando parar"

## Exclusions

- Timer automático de sessão — agente decide quanto tempo trabalha
- Relato estruturado em JSON — texto livre do agente é suficiente
- Notificação push para o humano — agente escreve no output da sessão
- Integração com Slack/Discord — apenas output no terminal

## Acceptance Criteria

- [x] **Seção "Checklist de Encerramento"**: Aparece no adaptador quando workflow existe
- [x] **3 estados**: CONTINUE, BLOCKED, ALL_DONE com descrições claras
- [x] **Detecção por pulse**: O protocolo usa `letra pulse --json` para determinar estado
- [x] **BLOCKED**: Instrui agente a relatar e encerrar, não continuar
- [x] **ALL_DONE**: Instrui agente a gerar relato completo e encerrar
- [x] **CONTINUE**: Instrui agente a relatar progresso e decidir se continua ou para
- [x] **Limite de sessão**: Se >30 min de trabalho, instrui a pausar e relatar
- [x] **Relato de sessão**: Template de relato com itens, ACs, alertas, decisões
- [x] **Regeneração**: Seção atualizada quando adapters são gerados
- [x] **Testes**: Seção com cada estado (continue, blocked, all_done)

## Context

Este spec fecha o gap "quando parar". Sem ele, um agente diligente pode ficar em loop infinito processando um backlog vazio, ou encerrar sem avisar que está bloqueado esperando review humano.

O relato de sessão é a ponte entre o que o agente fez e o que o humano precisa saber. Não precisa ser estruturado — o agente sabe escrever em linguagem natural.
