# Spec: shadcn-first

> Updated: 2026-06-29

## Outcome

O Letra terá **todos os componentes de UI migrados para shadcn/ui** como única base canônica. Componentes custom raw (modais, selects, checkboxes, accordions, tables, drawers, sheets, popovers, etc.) serão substituídos por seus equivalentes shadcn disponíveis em `@letra/ui` ou adicionados ao registry. O layout principal passará a usar CSS Grid do Tailwind. A constituição é atualizada com a regra **shadcn-first**: todo novo componente de UI deve usar shadcn, nunca HTML raw.

## Constraints

- Todos os componentes devem vir de `@letra/ui` ou do registry `@shadcn`
- Nenhum elemento HTML raw (`<button>`, `<input>`, `<select>`, `<textarea>`, `<table>`, `<dialog>`, `<details>`) deve ser usado para UI — exceção: elementos semânticos estruturais (`<header>`, `<nav>`, `<main>`, `<aside>`, `<section>`)
- Layout deve usar CSS Grid do Tailwind (`grid-cols-*`, `grid-rows-*`, `gap-*`) em vez de `flex` para estrutura principal
- Manter identidade visual Amber existente (brand manual)
- Build deve passar sem erros
- Acessibilidade WCAG 2.2 AA mantida

## Exclusions

- Componentes app-specific como `DocumentEditor`, `DocumentView`, `MarkdownView`, `RulerHeader`, `ActivityTimeline` (visual custom) — são específicos do domínio e não têm equivalente shadcn
- Animações custom (MarchingBorder, agent-thinking)
- Lógica de drag-and-drop do Kanban (não há shadcn DnD)

## Acceptance Criteria

### Fase 1 — Infraestrutura

- [x] **AC1**: Adicionar componentes shadcn ausentes ao `@letra/ui`: `Table`, `Collapsible`, `Accordion`, `RadioGroup`, `Switch`, `Label`, `NavigationMenu`, `Drawer`, `Command`
- [x] **AC2**: Atualizar `constitution.md` com princípio "shadcn-first"
- [x] **AC3**: Atualizar `constraints.md` e `focus.md` para refletir nova regra

### Fase 2 — Modais e Dialogs

- [x] **AC4**: Migrar `ItemDetailModal.tsx` — modal full-screen → `Dialog`, raw checkbox → `Checkbox`, raw accordion → `Collapsible`
- [x] **AC5**: Migrar `HomeView.tsx` `ItemDetailSheet` → shadcn `Sheet`
- [x] **AC6**: Migrar `UndoHistory.tsx` → shadcn `Dialog`

### Fase 3 — Sidebar e Navegação

- [x] **AC7**: Migrar `Sidebar.tsx` workspace dropdown → shadcn `DropdownMenu`/`Select`
- [x] **AC8**: Migrar `Sidebar.tsx` separadores raw `<div>` → `Separator`
- [x] **AC9**: Migrar `NavTabs.tsx` → shadcn `Tabs`

### Fase 4 — Tabelas e Dados

- [x] **AC10**: Migrar `AuditLogView.tsx` → shadcn `Table`
- [x] **AC11**: Migrar `AgentDetail.tsx` raw `<details>/<summary>` → `Collapsible`

### Fase 5 — Formulários e Inputs

- [x] **AC12**: Substituir todos os 8 raw `<input type="checkbox">` por `Checkbox` em: `ItemDetailModal`, `InlineSetupWizard` (x3), `WorkspaceSetupFlow` (x2), `SidePanel`, `PersonalizationWizard`
- [x] **AC13**: Migrar `PersonalizationWizard.tsx` raw `<input type="text">` → `Input`
- [x] **AC14**: Migrar `LogSearchView.tsx` raw `<input type="text">` e `<input type="date">` → `Input`
- [x] **AC15**: Migrar `ui/DocumentEditor.tsx` raw `<textarea>` → `Textarea`
- [x] **AC16**: Migrar `SetupWizard.tsx` radio templates → `RadioGroup`
- [x] **AC17**: Migrar `SpecsView.tsx` `window.confirm()` → `ConfirmDialog`

### Fase 6 — Dropdowns e Popovers

- [x] **AC18**: Migrar `DiagnosticsIndicator.tsx` custom dropdown → shadcn `Popover`
- [x] **AC19**: Eliminar `Toast.tsx` duplicado — usar `@letra/ui` `ToastProvider` + `useToast`

### Fase 7 — Layout e Grid

- [x] **AC20**: Migrar layout `App.tsx` para CSS Grid (`grid-template-columns: auto 1fr`) eliminando `flex-1` + `md:ml-*`
- [x] **AC21**: Migrar `FlowView.tsx` exec summary cards raw `<div>` → `Card` + `CardContent`

### Fase 8 — Polimento

- [x] **AC22**: Verificar build (`npm run build` em `packages/client`)
- [x] **AC23**: Auditoria final de acessibilidade (teclado, focus ring, aria)
