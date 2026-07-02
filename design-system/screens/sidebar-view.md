# Sidebar & SidePanel

**Arquivos**: `packages/client/src/components/Sidebar/Sidebar.tsx`, `SidePanel.tsx`
**Propósito**: Sidebar de navegação principal + painel lateral de detalhes rápidos.

## Layout (Sidebar)
- Logotipo + workspace info no topo
- Grupos de navegação (Workspace, Flow, Admin)
- Itens com ícone, label, badge de contagem
- Collapsível
- Gate count badge

## Layout (SidePanel)
- Painel direito com detalhes do item selecionado
- ID, descrição, estágio, spec link
- Stage mover (select + confirm)
- Atividades recentes

## Elementos principais
- `LogoDiamond` no topo da sidebar
- Nav groups com `NavItem`
- Gate count indicator
- Stage mover com confirm

## Tokens usados
(Sidebar) `--border`, `--card`, `--foreground`, `--gate-available`, `--muted`, `--muted-foreground`, `--primary`, `--primary-alpha` (órfão!)
(SidePanel) `--background`, `--border`, `--card`, `--foreground`, `--muted`, `--muted-foreground`

## Conformidade LDL
- [x] Sidebar segue estrutura de Mission Control (navegação hierárquica)
- [x] Badge de gate count
- [ ] **`--primary-alpha` não está definido em nenhum CSS** — token órfão
- [ ] Sidebar raw `<button>` nos nav items — migrar
- [ ] SidePanel raw `<select>` no stage mover — migrar para Select
- [ ] Sidebar 404 linhas — componente muito grande, considerar decomposição
