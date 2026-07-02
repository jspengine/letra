## Acceptance Criteria

- [ ] **`letra pulse`**: Exibe overview sem flags obrigatórias
- [ ] **Item atual**: Mostra ID, descrição, estágio, dias no estágio
- [ ] **ACs pendentes**: Contagem pending/done/total do item atual
- [ ] **Tasks**: Contagem de tasks abertas/feitas se item tiver tasks
- [ ] **Alertas**: Contagem de alertas novos/cientes/resolvidos
- [ ] **Severidade alta**: Destaca se há alertas de severidade alta
- [ ] **--json**: Saída JSON completa para consumo por agente
- [ ] **--build**: Inclui resultado de `npm run build`
- [ ] **--test**: Inclui resultado de `vitest run`
- [ ] **Fallback**: Sem workflow, mostra "N/A" sem quebrar
- [ ] **Sem item ativo**: Mostra "Nenhum item em andamento" sem quebrar
- [ ] **Próximo item**: Mostra primeiro item do backlog se existir
- [ ] **Dias parado**: Mostra dias desde último sitrep
- [ ] **API GET /api/pulse**: Retorna JSON do pulso
- [ ] **API GET /api/pulse?build=true**: Inclui build na resposta
- [ ] **Rápido sem --build/--test**: < 1s sem verificar build/test
- [ ] **Testes**: Saída texto, saída JSON, fallback sem workflow, fallback sem health-record
