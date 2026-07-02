# Spec: kanban-sticky

> Updated: 2026-06-23

## Outcome
Os cabeçalhos de coluna no Kanban (KanbanView) serão fixos ao scroll vertical, com uma linha separadora entre o header e os cards, mantendo visível o nome do estágio e a contagem de itens durante a navegação.

## Constraints
- Sticky headers posicionados abaixo do NavTabs (header: 56px + nav: 40px + gap)
- Separador: `border-bottom` de 1px com `var(--border)`
- Compatível com drag-and-drop existente (não quebrar DnD)
- Apenas CSS/styling — sem mudanças na lógica do Kanban

## Exclusions
- Sticky headers em outros componentes (apenas Kanban)
- Multi-row sticky (headers agrupados por zona)

## Acceptance Criteria

- [x] **AC1**: Cabeçalhos de coluna no Kanban usam `position: sticky; top: 96px; z-index: 10` (abaixo do NavTabs que está a 56px). Background: `var(--surface-1)` para esconder cards que passam atrás.
- [x] **AC2**: Cada header de coluna tem `border-bottom: 1px solid var(--border)` como separador visual entre o header e a lista de cards. Header mantém stage name, contagem de itens e indicador de bottleneck (se aplicável).
- [x] **AC3**: Ao scrollar verticalmente o kanban, os headers permanecem visíveis no topo e a linha separadora acompanha o header. Drop zones continuam funcionando normalmente apesar do sticky.

## Context
Em kanbans com muitos itens, o usuário perde a referência de qual coluna está vendo ao scrollar para baixo. Headers fixos resolvem esse problema de navegação com uma solução puramente CSS.
