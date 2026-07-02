## Acceptance Criteria

- [ ] **Kanban único**: toggle Pipe/Kanban removido, apenas modo colunas por estágio
- [ ] **Card enriquecido**: cada card mostra tasks (barra ▓▓▓░ 3/5), dias no estágio (2d, 7d⚠, 15d🔴), badge de validação da spec (✅/⚠/✗)
- [ ] **Header do Flow**: ícone `flow` + título "Flow" + subtítulo "Pipeline de desenvolvimento — estágios, itens e specs associadas" + botão [+ Add Item]
- [ ] **Detail panel**: header com ícone + ID + stage badge + descrição + ações (Mover para próximo, Abrir Spec, Excluir); conteúdo com tasks checkáveis + spec vinculada renderizada via `<Markdown>`
- [ ] **Ação Mover para próximo**: botão no detail que avança o item para o próximo estágio da lista
- [ ] **Ação Abrir Spec**: navega para a aba Specs com a spec do item selecionada
- [ ] **Ação Excluir**: confirma com window.confirm e remove o item
- [ ] **Live updates**: detail panel reage a mudanças via SSE (já existe)
