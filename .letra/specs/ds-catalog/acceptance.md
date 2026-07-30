# Acceptance Criteria — ds-catalog

- [x] **AC1 — Migração Ladle→Storybook 8**: 39 stories renderizam sem erro no `npm run storybook`
- [x] **AC2 — Addons essenciais (essentials/a11y/themes) ativos e verificados na toolbar**: theme-switch aplica .dark/.light e troca tokens; a11y roda axe (1 Violation/3 Passes no Button Primary)
- [x] **AC3 — Página de Tokens visual (CSF stories em src/foundations/)**: swatches resolvem CSS vars reais de index.css (primary=rgb(255,184,0))
- [x] **AC4 — CSF/autodocs de 10 primitivas críticas com Controls/ArgsTable**: Button, Badge, Card, Input, Dialog, Sheet, Select, Table, Toast, Tooltip documentados; MDX substituído por decisão `storybook-mdx-to-csf-autodocs.md`
- [x] **AC5 — 8 patterns com estados completos exportando x-ds**: Sidebar, KanbanBoard, GateCard, ValidatingBar, MarchingBorder, Search, ActivityTimeline, NavHeader
- [x] **AC6 — 6 superfícies do client catalogadas como stories**: HomeView, FlowView, ExecutionView, ContextView, SpecsView, WorkspacesView
- [x] **AC7 — CI de catálogo (storybook:build + a11y CI + visual snapshots equivalentes)**: workflow GitHub Actions existe e roda em PR
- [x] **AC8 — ds-catalog.json machine-readable gerado pós-build**: script gera JSON com componente→tokens/categorias/status/surfaces
