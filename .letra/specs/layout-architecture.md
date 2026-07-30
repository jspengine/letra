# Spec: Letra Design System — Fonte da Verdade e Arquitetura de Layout

> Status: canonical
> Updated: 2026-07-08
> Owner: Letra Core / UX
> Scope: @letra/ui + packages/client + superficies consumers do DS

## Outcome

Todo desenvolvimento de frontend e UX do Letra é orientado por um documento canônico de Design System. Mudanças no catálogo do DS refletem na aplicação web e em outras superfícies. Não há drift entre o que está documentado e o que está implementado.

## Constraints

- Nenhuma mudança de layout/estilo no client pode usar tokens/cores/alias que não existam em `packages/ui/src/index.css`.
- Qualquer novo padrão visual deve ser documentado antes de implementado.
- Tema light e dark devem ser validados antes de merge.
- App shell, grid system e tokens de layout são propriedade do DS, não do client.
- O DS é a fonte da verdade para cores, espaçamento, tipografia, radios, motion e semântica visual.

## Exclusions

- Esta spec não altera backend, API ou lógica de negócio.
- Esta spec não impede adaptações pontuais em superfícies específicas quando o DS proveê variantes explícitas para isso.
- Esta spec não cria novos componentes visuais sem documentação.

## Acceptance Criteria

- [ ] **AC1**: Spec canônica `layout-architecture.md` salva em `.letra/specs/` com toda a análise, drifts, proposta e regras.
- [ ] **AC2**: Fase `frontend-review` adicionada ao `sdlc.yaml` do workspace como gate obrigatório.
- [ ] **AC3**: Comando `letra check:ds` criado em `packages/cli/src/commands/check-ds.ts` e linkado no fluxo de desenvolvimento.
- [ ] **AC4**: Nenhum alias shadcn legado pode ser usado no `packages/client` sem fallback explícito pelo DS.
- [ ] **AC5**: Layout tokens centralizados em `index.css` e usados pelo AppShell.
- [ ] **AC6**: Grid system documentado e adotado como padrão em novas telas.
- [ ] **AC7**: Build do client e UI ficam verdes após a reorganização inicial.
- [ ] **AC8**: Light theme validado visualmente em pelo menos: Header, Sidebar, FlowView, HomeView.

## Context

### Problema
O Letra possui um Design System componentizado (`@letra/ui`) que já define tokens e componentes reutilizáveis. No entanto, o `packages/client` mantém um layout shell, grid e semântica visual paralelos, usando aliases shadcn legados, valores hardcoded e tokens inexistentes no light theme. Isso gera drift: mudanças no catálogo do DS não refletem na aplicação web, e o tema light quebra em múltiplos componentes.

### Diagnóstico
- O DS é a fonte da verdade em componentes isolados, mas não em layout/navegação.
- O client usa: `var(--muted)`, `var(--muted-foreground)`, `var(--primary)`, `var(--success)`, `var(--warning)`, `var(--error)`, `var(--live)`, `var(--gate-*)` — aliases que não pertencem ao núcleo canônico do DS e que no `.light` caem para fallbacks de contraste ruins.
- Espaçamento hardcoded: `px-5`, `py-2.5`, `gap-2`, `gap-3`, `h-7`, `w-80`, `grid-cols-6`, `25vw` — sem passar pelo sistema de tokens.
- Navegação fragmentada: Sidebar usa `SidebarProvider` shadcn + estilos inline; SidePanel legado com largura fixa `w-80`; Header global inchado misturando contexto e ações locais; FlowView tem header próprio porque o global não suporta contexto de fluxo.
- Light theme quebrado: texto branco hardcoded em Badge/Button/Toast/PipelineSnapshot quando o fundo vira claro.

### Impacto
- Custo de mudança: alterar o DS não move o app.
- Risco de regressão: light theme falha em múltiplos componentes.
- Paralelismo UX: agentes não conseguem alterar layout com segurança porque não há guardrails.
- Manutenibilidade: cada tela resolve seu próprio grid, espaçamento e semântica.

### Decisão
O DS passa a ser a Fonte da Verdade única para:
1. Tokens canônicos: `--space-*`, `--border-*`, `--icon-*`, `--radius-*`, `--duration-*`, `--color-bg-*`, `--color-text-*`, `--color-border`, `--color-primary`, `--color-success`, `--color-info`, `--color-danger`, `--color-warning`, `--color-agent`.
2. Layout tokens: `--layout-header-height`, `--layout-sidebar-width`, `--layout-sidebar-width-collapsed`, `--layout-inset-padding`, `--layout-content-max-width`, `--layout-gap`.
3. Grid system centralizado com breakpoints nomeados.
4. AppShell como componente do DS.
5. Semântica visual consistente: `--live`, `--gate-available`, `--gate-waiting`, `--gate-blocked` documentados ou integrados aos tokens canônicos.

## Full Analysis

### O que o DS define hoje
- Tokens CSS em `packages/ui/src/index.css`.
- Componentes: Badge, Button, Card, Alert, Avatar, Progress, ScrollArea, Toast, Sheet, Drawer, Command, Dialog, Skeleton, Separator, Input, Select, Tabs, Tooltip.
- Tema light via bloco `.light` em `index.css`.
- Padrões: `NavHeader`, `GateCard`, `ValidatingBar`, `MarchingBorder`, `Search`, Sidebar, Kanban.

### O que o client faz hoje
**App.tsx:**
- Usa gride externo: `grid-cols-[auto_minmax(0,1fr)]`
- Define sidebar via inline style: `--sidebar-width: 25vw`, `--sidebar-width-icon: 3rem`
- Aplica `Header`, `SidebarProvider`, `SidebarInset`

**Header:**
- Grid responsivo: `xl:grid-cols-[minmax(0,1fr)_auto]`
- Usa aliases shadcn: `var(--muted-foreground)`
- Badges inline com variantes que não existem no Badge do DS (`error`, `success` dependendo de variantes do DS que não estão mapeadas)
- Ícones tamanho `16`, sem token `--icon-md`

**Sidebar:**
- Tokens de sidebar não canônicos: `--color-sidebar-accent`, `--color-sidebar-active`, `--color-sidebar-active-foreground`
- Estados `onMouseEnter/Leave` inline para cor de fundo, fugindo do sistema de estados
- Usa `ShadcnSidebar` com `collapsible="icon"` — padrão não documentado no DS

**FlowView:**
- Grid `grid-cols-6` para estatísticas — sem token de grid
- `PipelineSnapshot` tem círculos com `color: "white"` hardcoded, causando invisibilidade no light theme
- Usa tokens `--live`, `--gate-available`, `--gate-waiting`, `--gate-blocked` sem existirem no DS
- Tipografia `text-[10px]`, `text-[9px]` — sem token tipográfico
- Botões tamanho `h-7 px-2` — sem token de espaçamento ou button size no DS
- SidePanel legado com largura `w-80`

**HomeView:**
- Grid de specs: `grid-cols-1 sm:grid-cols-2 xl:grid-cols-4` — padrão por tela, não grid system
- Stat cards com border/background inline e tokens inválidos

**SidePanel:**
- Não usa `Sheet` do DS
- Largura fixa `w-80`
- Cores inline usando `var(--background)`, `var(--card)`, `var(--foreground)` — aliases shadcn

### Drifts detectados
1. **Aliases shadcn legados no client**: `--muted`, `--muted-foreground`, `--background`, `--foreground`, `--card`, `--primary`, `--success`, `--warning`, `--error`, `--live` — usados diretamente no client sem existir no DS ou no bloco `.light`.
2. **Layout hardcoded**: `25vw`, `w-80`, `min-h-16`, `px-5`, `py-2.5`, `text-[10px]`, `grid-cols-6` — valores que não passam por tokens.
3. **Grid system ausente**: cada tela inventa suas colunas e breakpoints.
4. **Semântica visual fragmentada**: tokens de gate/pipeline/live não documentados no DS.
5. **Light theme quebrado**: texto branco em botões/badges/pipeline sobre fundo claro.
6. **Navegação híbrida**: Sidebar global shadcn + SidePanel legado + header por tela.
7. **Tokens de ícone não adotados**: tamanhos `12`, `14`, `16`, `18`, `24` hardcoded em vez de `--icon-xs`, `--icon-sm`, `--icon-md`, `--icon-lg`.
8. **AppShell não é componente do DS**: toda estrutura de layout pertence ao client, não ao catálogo.

## Proposed Architecture

### Princípios
1. O DS é a fonte da verdade. O client consome o DS. O DS não consome o client.
2. Layout é parte do catálogo do DS.
3. Qualquer mudança visual no client deve passar por validação de conformidade com o DS.

### Objetivos
- Unificar tokens de layout no DS.
- Criar `AppShell` como componente do DS.
- Migrar `packages/client` para usar apenas tokens canônicos e componentes do DS.
- Documentar e adotar grid system central.
- Fechar light theme em todas as telas.

### Não Objetivos
- Não alterar backend ou contratos de API.
- Não criar novos componentes visuais sem documentação prévia.
- Não quebrar funcionalidades existentes durante a migração.

### Decisões tomadas
- Tokens canônicos residem exclusivamente em `packages/ui/src/index.css`.
- Layout tokens serão adicionados ao mesmo arquivo, no bloco `:root`.
- `AppShell` será criado em `packages/ui/src/app-shell.tsx`.
- Alias shadcn (`--muted`, `--muted-foreground`, etc.) serão eliminados do `packages/client` via migração guiada pelo `check:ds`.
- Light theme será tratado como cidadão de primeira classe; todo componente novo deve ter exemplo/teste em light e dark.

## Implementation Notes

### Ordem recomendada
1. Documentar layout tokens em `index.css` e criar `AppShell`.
2. Migrar `App.tsx` para usar `AppShell`.
3. Criar `letra check:ds` e integrar ao fluxo.
4. Adicionar gate `frontend-review` no `sdlc.yaml`.
5. Migrar `Header`, `Sidebar`, `FlowView`, `HomeView`, `SidePanel` para tokens canônicos.
6. Eliminar aliases shadcn e tokens fantasma (`--live`, `--gate-*`).
7. Validar light theme em todas as telas.
8. Atualizar CI para rodar `check:ds`.

### Riscos
- Refatorar shell primeiro pode quebrar múltiplas telas.
- Light theme atual quebra por aliases inexistentes; migração deve ser incremental com validação visual.
- Grid system atual tem muitos valores hardcoded; mudança deve ser por camada.

## References

- `packages/ui/src/index.css`
- `packages/ui/src/button.tsx`
- `packages/ui/src/badge.tsx`
- `packages/ui/src/progress.tsx`
- `packages/ui/src/scroll-area.tsx`
- `packages/client/src/App.tsx`
- `packages/client/src/components/Header/Header.tsx`
- `packages/client/src/components/Sidebar/Sidebar.tsx`
- `packages/client/src/components/Flow/FlowView.tsx`
- `packages/client/src/components/Home/HomeView.tsx`
- `packages/client/src/components/SidePanel/SidePanel.tsx`
