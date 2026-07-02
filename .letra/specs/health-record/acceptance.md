## Acceptance Criteria

- [ ] **health-record.json**: Criado em `.letra/` após primeiro `letra health scan` com schema versionado
- [ ] **Merge idempotente**: Rodar scan 2x seguidas não duplica entradas — alertas existentes permanecem com mesmo status
- [ ] **Resolução automática**: Alerta que não aparece no scan atual → marcado como "resolvido" automaticamente
- [ ] **Ressurreição**: Alerta "resolvido" que reaparece → volta como "novo"
- [ ] **Dismiss**: `POST /api/health/dismiss/:id` persiste razão e data, alerta some do output padrão
- [ ] **Ack**: `POST /api/health/ack/:id` persiste data, alerta fica visível mas sem badge "novo"
- [ ] **Cleanup**: Entradas "resolvido" ou "descartado" com >90 dias são removidas no próximo scan
- [ ] **CLI health**: `letra health` imprime resumo com contagem por status
- [ ] **CLI health scan**: Executa engine.runAll() e mescla resultados
- [ ] **CLI health ack/dismiss**: Atalhos sem API para marcar entradas
- [ ] **--all**: Exibe entradas ocultas (descartadas, resolvidas)
- [ ] **--json**: Saída JSON para consumo por agente
- [ ] **API GET /api/health**: Retorna prontuário completo
- [ ] **API GET /api/health/alerts**: Retorna apenas entradas ativas
- [ ] **API POST /api/health/scan**: Re-executa diagnose e mescla
- [ ] **Integração diagnose**: `letra diagnose` também atualiza health-record.json automaticamente
- [ ] **Testes**: Merge 3 cenários (novo, repetido, mudou), persistência, ack, dismiss, cleanup
