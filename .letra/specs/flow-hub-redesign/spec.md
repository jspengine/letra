# Spec: Flow Hub Redesign

> Updated: 2026-06-13

## Outcome

Flow view transformada em um kanban único, com detail panel no padrão Context/Specs (header + conteúdo), cards enriquecidos com tasks, tempo no estágio e badge de validação da spec vinculada. Usuário gerencia o pipeline visualmente sem alternar entre Pipe/Kanban.

## Constraints

- Modelo de dados existente (Item, Task, Workflow) não pode ser alterado — apenas estendido via novos campos opcionais
- Zero dependências runtime externas
- Detail panel deve reutilizar `<Markdown>` para renderizar spec vinculada
- SSE broadcast já existe — usar para live updates

## Exclusions

- Não alterar o modelo de dados do backend (workflow.json schema)
- Não adicionar métricas de fluxo (lead time, throughput) — será ITEM-10
- Não implementar Add Item / Add Task no detail panel agora (apenas visualização + ações de mover)

## Acceptance Criteria

- [ ] **Kanban único**: toggle Pipe/Kanban removido, apenas modo colunas por estágio
- [ ] **Card enriquecido**: cada card mostra tasks (barra ▓▓▓░ 3/5), dias no estágio (2d, 7d⚠, 15d🔴), badge de validação da spec (✅/⚠/✗)
- [ ] **Header do Flow**: ícone `flow` + título "Flow" + subtítulo "Pipeline de desenvolvimento — estágios, itens e specs associadas" + botão [+ Add Item]
- [ ] **Detail panel**: header com ícone + ID + stage badge + descrição + ações (Mover para próximo, Abrir Spec, Excluir); conteúdo com tasks checkáveis + spec vinculada renderizada via `<Markdown>`
- [ ] **Ação Mover para próximo**: botão no detail que avança o item para o próximo estágio da lista
- [ ] **Ação Abrir Spec**: navega para a aba Specs com a spec do item selecionada
- [ ] **Ação Excluir**: confirma com window.confirm e remove o item
- [ ] **Live updates**: detail panel reage a mudanças via SSE (já existe)

## Context

A Flow View atual tem dois modos (Pipe/Kanban) que mostram a mesma informação com agrupamento diferente, causando confusão. O detail panel é pobre — mostra dados crus sem formatação, sem ações, sem integração com specs. Precisamos padronizar a experiência com o que já foi feito no Context e Specs (header + Markdown), enriquecer os cards e eliminar a duplicidade de modos.

Decisão: seguir Abordagem 3 da análise (Flow Hub híbrido) — kanban único, detail panel rico, cards com info de tempo e tasks, integração com spec real.
