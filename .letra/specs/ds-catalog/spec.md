# Spec: DS Visual Catalog (Storybook)

> Updated: 2026-07-11

## Outcome

O Design System v2 (`@letra/ui`) torna-se a fonte única da verdade visual e estrutural do produto, com um catálogo vivo e transparente para humanos e agentes. O catálogo deve (1) expor todos os tokens canônicos de forma visual, (2) documentar cada componente base e pattern com estados, variantes e diretrizes de uso, (3) mostrar as superfícies reais do client consumindo o DS, e (4) exportar metadados machine-readable para agentes consultarem e validarem conformidade.

## Constraints

- O catálogo deve substituir o Ladle atual por Storybook 8 (ecossistema de addons, autodocs, a11y, viewport, themes) mantendo compatibilidade com as stories existentes (`*.stories.tsx`).
- Os tokens canônicos em `packages/ui/src/index.css` continuam sendo a única fonte de verdade de cor/espaçamento/raio/motion; o catálogo os visualiza, não os redefine.
- Cada story/components deve exportar metadados `parameters['x-ds']` (category, status, tokens, consumes, surfaces, a11y, breakpoints) para consumo por agentes e validação CI.
- O catálogo deve cobrir os 7 componentes base críticos do webapp e os 8 patterns (Sidebar, KanbanBoard, GateCard, ValidatingBar, MarchingBorder, Search, ActivityTimeline, NavHeader), além das superfícies reais (HomeView, FlowView, ExecutionView, ContextView, SpecsView, WorkspacesView).
- A migração não pode quebrar o build do `@letra/ui` (`tsup`) nem os validadores DS (`ds:check`, `ds:validate`).
- Documentação rica é obrigatória para primitivas e patterns. Na stack atual, MDX está substituído por CSF/autodocs equivalente por limitação documentada do renderer Storybook 8.6 + React 19; surfaces podem usar stories de composição com decorators.

## Exclusions

- Reimplementação de componentes do DS (isso é escopo de ITEM-66/67/68).
- Criação de novos componentes não existentes (apenas documentar os existentes).
- Refactor visual das superfícies do client (escopo de `ux-release-readiness` / ITEM-71-75).
- Pipeline de release do Storybook (deploy) — apenas build local + CI de validação.

## Acceptance Criteria

- [x] **AC1 — Migração Ladle→Storybook 8**: Config base em `.storybook/` (main.ts + preview.ts) com stories glob compatível; `npm run storybook` sobe e renderiza as 39 stories existentes sem erro.
- [x] **AC2 — Addons essenciais instalados**: `@storybook/addon-essentials` (Controls, Docs, Viewport, Backgrounds), `@storybook/addon-a11y` (axe real — "1 Violations / 3 Passes" no Button Primary) e `@storybook/addon-themes` (theme-switcher dark/light funcional na toolbar, aplica `.dark`/`.light` em `html` e troca tokens) ativos e verificados no browser. `storybook-design-token` **não** incluído: nenhuma versão é compatível com a stack (v3 exige React ≤18; v4 exige Storybook ≥9; o repo roda SB 8.6 + React 19). Sua função (tokens visuais) está coberta por AC3 (Foundations stories).
- [x] **AC3 — Página de Tokens visual**: entregue como **CSF stories** em `packages/ui/src/foundations/` (Tokes/Colors+Radius+Spacing, Typography/Scale+Fonts, Motion/Tokens) por limitação do renderer de MDX do Storybook 8.6 + React 19 (MDX não renderiza `<div>`/`<span>` com filhos — só `<button>` inline; falha com "component failed to render properly"). Os stories lêm os CSS custom properties reais de `index.css` (swatch "primary" resolve para `rgb(255,184,0)` = `--color-primary`). Sob a sidebar `FOUNDATIONS/`. Se MDX voltar a ser exigido, o caminho é corrigir o renderer ou downgrade de React.
- [x] **AC4 — Docs de primitivas críticas**: Button, Badge, Card, Input, Dialog, Sheet, Select, Table, Toast, Tooltip documentados como CSF/autodocs equivalentes a MDX, com Controls/ArgsTable automáticos, descrição de uso/a11y e `x-ds`. MDX permanece bloqueado pela limitação registrada no AC3 e na decisão `storybook-mdx-to-csf-autodocs.md`.
- [x] **AC5 — Patterns com estados completos**: Sidebar, KanbanBoard, GateCard, ValidatingBar, MarchingBorder, Search, ActivityTimeline, NavHeader têm stories cobrindo default + estados (empty, loading, error, collapsed, mobile) e exportam `x-ds`.
- [x] **AC6 — Superfícies do client catalogadas**: HomeView, FlowView, ExecutionView, ContextView, SpecsView, WorkspacesView expostos como stories de composição (decorators com tema/provider) consumindo `@letra/ui`.
- [x] **AC7 — CI de catálogo**: workflow GitHub Actions executa `storybook:build` + addon-a11y em modo CI; Chromatic (ou equivalente) captura regressão visual em PRs.
- [x] **AC8 — Catálogo machine-readable**: script pós-build gera `ds-catalog.json` (componente → tokens, categorias, status, surfaces) consumível por agentes e por validador de drift.

## Context

O `@letra/ui` (DS v2) já possui 65 exports, tokens canônicos validados e 39 stories em Ladle. Porém o Ladle é limitado: não gera docs automáticas, não tem Controls/ArgsTable, não tem addon de a11y, e as stories de patterns são mínimas (1-2 variações, sem estados). O usuário (e os agentes) não conseguem visualizar o DS completo nem auditar conformidade.

Esta spec existe para tornar o DS transparente e auditável: um catálogo visual onde humanos navegam componentes/tokens e agentes consultam metadados para manter o drift zero. É pré-requisito para fechar o ciclo "DS como fonte da verdade" iniciado em ITEM-66/67/68 e convergente com `ux-release-readiness`.

## Plano de Execução (fases)

1. **Foundation**: migrar Ladle→Storybook 8 (config + addons) — AC1, AC2
2. **Foundations pages**: Tokens, Typography, Motion como CSF stories — AC3
3. **Primitives docs**: 10 primitivas críticas via CSF/autodocs equivalente a MDX — AC4
4. **Patterns**: expandir 8 patterns com estados — AC5
5. **Surfaces**: 6 views do client como stories — AC6
6. **CI**: build + a11y + visual snapshots equivalentes — AC7
7. **Agent metadata**: ds-catalog.json + validador — AC8
