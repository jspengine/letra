# Acceptance Criteria — architecture-convergence

- [ ] **AC1**: Existe uma definição única do flow ativo do workspace
- [ ] **AC2**: `flow-move`, `flow-serve`, `activity-context` e UI consomem a mesma resolução
- [ ] **AC3**: Templates hardcoded deixam de ser fonte primária no servidor
- [ ] **AC4**: UI deriva stages, labels, agentes e gates do flow ativo
- [ ] **AC5**: `activity-context` lê expectativas declarativas de review/gate
- [ ] **AC6**: `flow-serve` é modularizado em serviços menores
- [ ] **AC7**: Automações recorrentes ficam visíveis e supervisionáveis
- [ ] **AC8**: Vocabulário workspace-first substitui novos usos de “project” como agregado raiz
- [ ] **AC9**: Existe política explícita de escrita por tipo de artefato
- [ ] **AC10**: O rollout é incremental e quebrado em fases rastreáveis no flow
- [ ] **AC11**: A documentação da refatoração referencia diagnóstico atual e constitution
- [ ] **AC12**: A fase inicial já permite mudar o flow sem editar UI ou semântica central no servidor
