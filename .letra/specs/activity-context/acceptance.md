# Acceptance Criteria — activity-context

- [ ] **AC1**: Builder retorna estrutura normalizada de activity context por atividade
- [ ] **AC2**: Modos suportados incluem `design`, `implement`, `review`, `diagnose` e `gate`
- [ ] **AC3**: `implement` prioriza spec, ACs, restrições e próxima ação
- [ ] **AC4**: `review` prioriza diff, riscos, testes, gates e conformidade com spec
- [ ] **AC5**: `gate` explicita decisão humana esperada e evidências necessárias
- [ ] **AC6**: Divergências entre focus, item ativo e health aparecem como sinais prioritários
- [ ] **AC7**: `mustRead[]` sempre referencia arquivos reais do workspace
- [ ] **AC8**: CLI e `flow-serve` conseguem consumir a mesma composição sem duplicar lógica
- [ ] **AC9**: Adapters podem exibir resumo curto do activity context com backward compatibility
- [ ] **AC10**: Sem item ativo, o contexto cai para descoberta/triagem de forma segura
- [ ] **AC11**: Output resume e referencia em vez de copiar arquivos grandes
- [ ] **AC12**: Testes validam a priorização específica por modo
