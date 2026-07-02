# Spec: session-log

> Updated: 2026-06-22

## Outcome

Entre sessões do agente, nada se perde. Cada ação significativa (validate executado, AC concluído, item movido, decisão tomada, alerta reconhecido) é registrada em um diário de bordo estruturado. Quando o agente volta, ele lê o diário e sabe exatamente onde parou.

O humano também pode consultar o diário para entender o histórico de ações do agente.

## Constraints

- Diário é um JSON array em `.letra/session-log.json`
- Cada registro tem: id, timestamp, action, description, itemId?, acId?, details?
- Ações registradas automaticamente por comandos do Letra (validate, flow move, health ack/dismiss)
- Agente pode adicionar registros manuais via `letra log add "descrição" [--item ITEM-X] [--ac AC-003]`
- Consulta via `letra log` (últimos 10) ou `letra log --all` (completo)
- Não é um chat log — apenas ações estruturadas
- Máximo 500 registros; >500 → remove os mais antigos (FIFO)
- Versionado em git (parte do `.letra/`)

## Exclusions

- Chat log ou transcripts de conversa — apenas ações estruturadas
- Histórico de edições de arquivo (diff) — isso é responsabilidade do git
- Métricas ou analytics — apenas registro factual

## Acceptance Criteria

- [ ] **session-log.json**: Criado em `.letra/` após primeira ação registrável
- [ ] **Registro automático**: validate, flow move, health ack/dismiss, decision new, sitrep registram automaticamente
- [ ] **Registro manual**: `letra log add "mensagem"` adiciona entrada manual
- [ ] **AC completo**: `letra log ac AC-003 --item ITEM-41` registra AC concluído
- [ ] **Fim de sessão**: `letra log session-end` marca término
- [ ] **Consulta**: `letra log` mostra últimos 10 registros formatados
- [ ] **--all**: Mostra todos os registros
- [ ] **--json**: Saída JSON para consumo por agente
- [ ] **--item**: Filtra por item
- [ ] **--action**: Filtra por tipo de ação
- [ ] **--since**: Filtra por data
- [ ] **Limite FIFO**: Máximo 500 registros; mais antigos removidos
- [ ] **Schema**: Versão 1 com campos id, timestamp, action, description, itemId, acId, details
- [ ] **API GET /api/log**: Retorna registros em JSON (últimos 50, com query params)
- [ ] **Testes**: Registro automático, registro manual, filtros, limite FIFO, consulta

## Context

O diário de bordo é o que permite continuidade real entre sessões. Sem ele, o agente começa do zero toda vez — precisa re-descobrir o estado, re-avaliar o que falta, e não sabe o que já foi tentado.

A combinação session-log + health-record + workflow.json forma a memória completa do Letra:
- workflow.json: O que precisa ser feito
- health-record: O que está errado
- session-log: O que já foi feito

Desses três, o session-log é o único que não existia antes deste spec.
