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
