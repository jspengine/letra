# Spec: pitagoras-ux

> Updated: 2026-06-29

## Outcome

O **Letra Design Language (LDL)** estará completamente auditado, mapeado e especificado como fonte única de verdade — eliminando inconsistências de tokens, removendo referências ao codinome "Pitágoras", documentando todas as telas existentes e formalizando os padrões visuais, de estado e de jornada UX do produto Letra.

## Constraints

- Amber `#FFB800` como acento operacional (não decorativo)
- WCAG 2.2 AA para contraste e navegação por teclado
- Dark mode como modo primário; light mode suportado
- Tokens CSS custom properties como única fonte de verdade — sem cores hardcoded no cliente
- Nome do sistema: **Letra Design Language (LDL)** — não Pitágoras
- Tipografia: Sora (branding/headlines) + Inter (UI) + JetBrains Mono (código/mono)

## Exclusions

- Implementação de novos componentes em código (apenas spec e tokens)
- Substituição do framework de UI (Radix/shadcn permanece)
- Refatoração do código do cliente (este item cobre apenas especificação e tokens)

## Acceptance Criteria

- [x] **AC1**: Auditoria de inconsistência de tokens — mapear todas as `var(--*)` usadas no cliente vs. tokens oficiais em `design-tokens.css`, gerando relatório de gaps em `design-system/audit.md`.
- [x] **AC2**: Unificação do namespace de tokens — proposta e documentação da ponte entre `--brand-*` (primitivos) e `--*` semântico (`--surface`, `--foreground`, `--border` etc.) em `design-system/tokens/semantic-map.md`.
- [x] **AC3**: Token scale completa — spacing (base 4px), z-index, focus rings, motion detalhado e breakpoints documentados em `design-system/tokens/scale.md`.
- [x] **AC4**: Mapeamento de telas — cada uma das 14 views do cliente documentada com layout, propósito, elementos principais e status de conformidade com LDL em `design-system/screens/` (1 arquivo por tela).
- [x] **AC5**: Spec de estados de componentes — Loading, Empty, Success, Error, Disabled com critérios visuais e de acessibilidade em `design-system/states.md`.
- [x] **AC6**: Spec de jornadas UX — Onboarding, Item em andamento, Gate pendente, Erro crítico — fluxo de telas e transições documentados em `design-system/journeys.md`.
- [x] **AC7**: Adoção de shadcn/ui como base canônica de componentes — auditoria completa do gap entre componentes raw/style atuais e os padrões shadcn, com plano de migração priorizado. Inclui: eliminação de ~70+ `<button>` raw para `<Button>`, ~45+ `<input>` raw padrão, 7 `<select>` raw para `<Select>`, unificação das duas árvores de UI (local `components/ui/` duplicada vs `@letra/ui`), padronização de imports para `@letra/ui` como única fonte.

## Context

O produto se chama **Letra** — Mission Control para engenharia assistida por IA. A identidade visual já está definida no `brand/brand-book.md` (Amber + Slate, Sora + Inter, arquétipo Governante). Este item formaliza a camada de design system que conecta essa identidade ao produto real.

O maior problema atual é a inconsistência de tokens entre o cliente React (que usa `var(--border)`, `var(--surface-1)`, `var(--foreground)`) e os tokens oficiais (que usam `--brand-*`). Há dois sistemas paralelos sem ponte declarada.

### Telas mapeadas para AC4

| Tela | Componente |
|---|---|
| Home | `HomeView.tsx` |
| Kanban / Flow | `KanbanView.tsx` · `FlowView.tsx` |
| Item Detail | `ItemDetailModal.tsx` |
| Specs | `SpecsView.tsx` |
| Context | `ContextView.tsx` |
| Logs / Audit | `AuditLogView.tsx` · `LogSearchView.tsx` |
| Execution | `ExecutionView.tsx` · `AgentDetail.tsx` |
| Workspaces | `WorkspacesView.tsx` · `WorkspaceSetupFlow.tsx` |
| Setup Wizard | `SetupWizard.tsx` · `PersonalizationWizard.tsx` |
| Header | `Header.tsx` · `LogoDiamond.tsx` |
| NavTabs | `NavTabs.tsx` |
| Sidebar / SidePanel | `Sidebar.tsx` · `SidePanel.tsx` |
| Diagnostics | `DiagnosticsIndicator.tsx` |
| Dashboard | `DashboardView.tsx` · `GateCard.tsx` · `MetricCards.tsx` |
