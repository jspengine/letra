## Acceptance Criteria

- [ ] **Rotas /api/items**: POST (criar item), PATCH /api/items/:id (mover/toggle tasks), DELETE /api/items/:id implementadas no flow-serve
- [ ] **Stage schema**: Stage ganha campos opcionais `allow: string[]` (stage IDs permitidos como destino) e `validate: string[]` (checklist de validação ao mover)
- [ ] **Manage Stages UI**: botão no FlowView header abre inline stage editor com lista de stages — cada stage tem nome editável, zona select, allow (multi-select de stages), validate (checklist editável), botão excluir (com confirmação)
- [ ] **Drag & drop respeita allow**: ao arrastar item para coluna, se stage destino não estiver em `allow` do stage origem, o drop é rejeitado com feedback visual (ring red) e toast de erro
- [ ] **Validate checklist**: ao mover item via drag ou botão, se stage origem tem `validate`, exibe mini-dialog checklist antes de confirmar o movimento
- [ ] **Integração workflow.json**: alterações no stage editor persistem via PATCH /api/workflow, SSE broadcast notifica outros clients
- [ ] **Botão Add Stage**: no inline stage editor, permite criar novo stage com nome, zona, allow vazio
- [ ] **Reordenação**: stages podem ser reordenados por drag & drop no inline editor
