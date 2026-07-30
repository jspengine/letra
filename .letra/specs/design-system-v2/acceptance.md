## Acceptance Criteria — DS v2 Correções de Inconsistência

- [x] **AC-TYPO**: Typography Scale
- [x] `.text-h1` usa `font-size: 40px`, `font-weight: 600`, `font-family: var(--font-display)`
- [x] `.text-h2` usa `font-size: 28px`, `font-weight: 600`, `font-family: var(--font-body)`
- [x] `.text-h3` existe com `font-size: 20px`, `font-weight: 600`, `font-family: var(--font-body)`
- [x] `.text-body` usa `font-size: 16px`, `font-weight: 400`
- [x] `.text-caption` usa `font-weight: 500`
- [x] `.text-mono` usa `font-size: 14px`
- [x] Todas as utilities tipográficas funcionam em dark e light mode

- [x] **AC-RADIUS**: Border Radius revisado

**Nova escala 5-tier com hierarquia visual:**

| Token | Valor | Uso |
|-------|-------|-----|
| `--radius-xs` | `6px` | Tags, checkboxes, compact elements |
| `--radius-sm` | `8px` | Inputs, selects, form fields, tooltips |
| `--radius-md` | `12px` | Cards, panels, alerts, toasts, buttons |
| `--radius-lg` | `16px` | Dialogs, sheets, modals — containers imersivos |
| `--radius-xl` | `20px` | Premium overlays, splash, hero containers |
| `--radius-full` | `9999px` | Pills, badges, avatars, toggles, progress |

- [x] `--radius-xs` = `6px` existe e é usado em: Checkbox, Tag/Chip, Search clear button
- [x] `--radius-sm` = `8px` existe e é usado em: Input, Textarea, Select trigger, Tooltip, Search container, Button sm
- [x] `--radius-md` = `12px` existe e é usado em: Card, Button default/lg, Alert, ErrorBanner, Toast, Popover/Dropdown content, Kanban coluna/item, GateCard, Sidebar items, ValidatingBar, Command, NavigationMenu items, SkeletonCard
- [x] `--radius-lg` = `16px` existe e é usado em: Dialog, Sheet, Drawer bottom-sheet, Command container
- [x] `--radius-xl` = `20px` existe e é usado em: Premium overlay containers, splash panels
- [x] `--radius-full` = `9999px` existe e é usado em: Badge, Avatar, RadioGroup, Switch, Progress, ScrollArea bar
- [x] Nenhum componente usa `rounded-lg`, `rounded-xl` ou `rounded-[5px]`/`rounded-[3px]` hardcoded — todos usam token
- [x] Componentes no client (`packages/client/src`) que usam `rounded-lg` hardcoded (HomeView, SupervisionInbox, etc.) migrados para token
- [x] Client-side `shadcn` components (button.tsx, input.tsx, sidebar.tsx, tabs.tsx) consomem `--radius-*` tokens em vez de `rounded-lg` hardcoded

- [x] **AC-ACCENT**: Accent Purple
- [x] `--accent` = `var(--color-agent)` (purple `#8B5CF6`)
- [x] `--accent-foreground` = `var(--color-text-primary)`
- [x] Nenhum componente usa `--accent` onde deveria usar `--color-primary`
- [x] Purple é exclusivo de contexto de agente (princípio #4)

- [x] **AC-MISSING-TOKENS**: Tokens faltantes
- [x] `--space-0` = `0px` existe
- [x] `--space-16` = `64px` existe
- [x] `--z-base` (1), `--z-dropdown` (10), `--z-sticky` (20), `--z-overlay` (30), `--z-modal` (40), `--z-toast` (50), `--z-tooltip` (60) existem
- [x] `--focus-ring-width` (2px), `--focus-ring-offset` (2px), `--focus-ring-color` (`var(--color-primary)`) existem
- [x] `--surface-hover` e `--surface-selected` existem conforme semantic-map.md §3
- [x] `--motion-fast` (140ms), `--motion-base` (180ms), `--motion-slow` (280ms) existem
- [x] `--bp-sm` (640px), `--bp-md` (768px), `--bp-lg` (1024px), `--bp-xl` (1280px), `--bp-2xl` (1536px) existem

- [x] **AC-FONT-ALIAS**: Renomeação de fontes
- [x] `--font-ui` existe e aponta para `'Inter', system-ui, -apple-system, sans-serif`
- [x] `--font-mono` existe e aponta para `'JetBrains Mono', 'Fira Code', monospace`
- [x] `--font-body` mantido como alias de `--font-ui` (backwards compat)
- [x] `--font-code` mantido como alias de `--font-mono` (backwards compat)
- [x] `:root, .dark` usa token unificado de font stack

- [x] **AC-BUTTON**: Button cleanup
- [x] Variantes `outline`, `success`, `warning` removidas
- [x] `default` e `primary` unificados (eram duplicatas)
- [x] Loading spinner usa `Icon` com nome `loader-circle` em vez de SVG inline
- [x] `sm` é exclusivamente size (não variante)
- [x] Variantes oficiais: `primary`, `secondary`, `danger`, `ghost`
- [x] Todos os usos no client (`App.tsx`, `Header.tsx`, etc.) seguem as variantes atualizadas

- [x] **AC-BADGE**: Badge cleanup
- [x] Variantes `default`, `secondary`, `outline`, `warning` removidas
- [x] Variantes oficiais: `amber`, `success`, `info`, `error`, `agent`
- [x] Badge sempre renderiza ícone + texto (não aceita children soltos sem ícone)
- [x] `variant="amber"` é o padrão
- [x] Todos os usos no client seguem as variantes atualizadas

- [x] **AC-PROGRESS**: Progress agent state
- [x] `state="agent"` existe e usa `var(--color-agent)` para a barra
- [x] `state="agent"` é usado quando um agente está "raciocinando" antes de ter resultado

- [x] **AC-CARD**: Card agent variant
- [x] `Card` aceita `variant="agent"` opcional
- [x] `variant="agent"` renderiza borda esquerda de 2px sólida em `var(--color-agent)`
- [x] `variant="agent"` é semanticamente restrito a cards de agente ativo

- [x] **AC-DESIGN-TOKENS-CSS**: Spec morta
- [x] `design-tokens.css` removido ou substituído por referência ao `index.css` canônico
- [x] `semantic-map.md` §8 atualizado para refletir implementação real
- [x] Nenhum token duplicado entre `design-system/tokens/*` e `packages/ui/src/index.css`
- [x] `packages/ui/src/index.css` é a única fonte de verdade de tokens

- [x] **AC-BUILD**: Build
- [x] `npm run build` passa nos 3 pacotes (ui, client, cli)
- [x] Nenhum warning novo de TypeScript

---

## Fase 2 — Identidade Visual "Mission Control" e Experiência do Usuário

- [x] **AC-MOTION**: Sistema de animações completo
- [x] `animate-agent-running` implementado: agente em execução (1.5s, opacidade/translate pulsando)
- [x] `animate-agent-breathe` implementado: agente ocioso (2s, opacidade sutil)
- [x] `animate-pulse-gate-waiting` implementado: gate humano pendente (2s, pulso âmbar)
- [x] `animate-pulse-gate-urgent` implementado: gate pronto/urgente (1s, pulso rápido)
- [x] `animate-shimmer-slide` implementado: loading shimmer (1.2s)
- [x] `animate-timeline-dot` implementado: timeline ativa (2s, pulso)
- [x] `animate-human-pulse` implementado: aprovação humana (2s)
- [x] `animate-slide-up` implementado: entrada de conteúdo (0.3s)
- [x] `animate-progress-stripes` implementado: progresso indeterminado (0.6s)
- [x] `animate-dash-march` implementado: marching border (0.4s, stroke-dashoffset animation)
- [x] `animate-drift-pulse` implementado no DriftIndicator (1s)
- [x] `animate-validating-bar` implementado (1.5s)
- [x] Skeleton usa shimmer animado (não só pulse genérico)
- [x] Todas as animações respeitam `prefers-reduced-motion: reduce`

- [x] **AC-ICONS-DOMAIN**: Ícones de domínio
- [x] `sparkles` adicionado ao ICONS (agente/raciocínio)
- [x] `zap` adicionado ao ICONS (execução ativa)
- [x] `workflow` adicionado ao ICONS (orquestração)
- [x] `terminal` adicionado ao ICONS (logs/terminal)
- [x] `scroll-text` adicionado ao ICONS (logs)
- [x] `circle-check` adicionado ao ICONS (sucesso)
- [x] `circle-x` adicionado ao ICONS (erro)
- [x] `octagon-alert` adicionado ao ICONS (bloqueio)
- [x] `hourglass` adicionado ao ICONS (aprovação pendente)
- [x] `plug` adicionado ao ICONS (conector/MCP)
- [x] `settings-2` adicionado ao ICONS (configuração)
- [x] `sliders-horizontal` adicionado ao ICONS (configuração)
- [x] Cobertura de 14+ ícones de domínio conforme brand doc §1.3
- [x] Mapeamento cor-ícone documentado: agente → `color-agent`, execução → `color-primary`, etc.

- [x] **AC-AGENT-IDENTITY**: Identidade visual do agente
- [x] `AgentStatusIndicator` componente novo: dot + glow roxo para estados: idle, thinking, running, error, done
- [x] `state="thinking"` no AvatarWithStatus: rotação sutil + glow `color-agent` na borda
- [x] Card de agente com `variant="agent"` tem hover com `box-shadow` roxo (não translateY)
- [x] Badge `variant="agent"` com ícone `sparkles` ou `bot`
- [x] Transição de cor âmbar→roxa quando ação passa de operacional para agente
- [x] Nenhum elemento não-agente usa cor purple (princípio #4 reforçado)

- [x] **AC-MICRO**: Micro-interações
- [x] Button primário: `hover:scale-[1.02]` além de hover de cor (duração 140ms)
- [x] Card: hover com glow sutil na borda (não translateY) para variante default
- [x] Card agent: hover com glow roxo (não translateY) para variante agent
- [x] GateCard urgente: badge com `animate-pulse-gate-urgent`
- [x] Timeline avatares: dot pulsante em agentes ativos
- [x] Toast de agente: ícone `sparkles` + cor purple (distinto de toast de sistema)
- [x] Skeleton: shimmer animado esquerda→direita (não pulse opaco genérico)
- [x] Input focus: glow âmbar sutil (`box-shadow`) além de outline
- [x] Dialog/Sheet abertura: overlay com fade + content com slide-up (280ms)
- [x] `prefers-reduced-motion: reduce` respeitado em todas as micro-interações

- [x] **AC-GLASS**: Glassmorphism e profundidade
- [x] `--shadow-glow` = `0 0 32px rgba(255, 184, 0, 0.12)` adicionado a tokens (existe em design-tokens.css, não em index.css)
- [x] Overlay de Dialog/Sheet usa `backdrop-blur-sm` (não só opacidade preta)
- [x] `GlassPanel` componente novo: Card com `background: color-mix(...)` + `backdrop-blur` + borda sutilmente iluminada
- [x] Modais têm profundidade visual com `--radius-lg` + `--shadow-xl` + backdrop-blur
- [x] Cards têm micro-profundidade: sombra sutil + hover com elevação

- [x] **AC-DATAVIZ**: Telemetria "Mission Control"
- [x] `Sparkline` componente: mini gráfico de linha para métricas (throughput, agentes ativos, etc.)
- [x] `ThroughputMeter` componente: barra horizontal com indicador de throughput vs baseline
- [x] `StatusDot` componente: dot colorido com tooltip (reutilizável, não só em Avatar)
- [x] Header pode exibir métricas ao vivo (agentes ativos, gates pendentes, drift count)
- [x] DashboardView usa sparklines para métricas de execução

- [x] **AC-COMPONENTS-NOVOS**: Novos componentes de produto
- [x] `GlassPanel`: Card com backdrop-blur + borda iluminada — para contextual overlays
- [x] `AgentStatusIndicator`: Dot + glow + label com tooltip — estados idle, thinking, running, error, done
- [x] `DriftIndicator`: Banner/barra com `animate-drift-pulse` e label "Drift detectado"
- [x] `CommandResult`: Output de comando executado (terminal simulado) com syntax highlight mínimo
- [x] `Timeline` (não ActivityTimeline): visualização de pipeline temporal com branching
- [x] `DataViz` subsystem: Sparkline, ThroughputMeter, StatusDot
- [x] `Tag`/`Chip`: Pill-shaped, fundo translúcido, para tecnologias/tipos (React, TypeScript, etc.)
- [x] `Grid` system: utilitários CSS para grid de 12 colunas com gutter `--space-6`

- [x] **AC-COLOR-CLEANUP**: Limpeza de paleta
- [x] `--color-warning` removido ou renomeado para valor distinto de `--color-primary` (ex: `#F59E0B` ambra escuro em vez de `#FFB800`)
- [x] `--color-warning` não é mais idêntico a `--color-primary` — cada token tem valor único
- [x] `--primary-alpha` adicionado: `color-mix(in oklch, var(--color-primary) 15%, transparent)` para backgrounds sutis
- [x] `--shadow-glow` adicionado aos tokens
- [x] Light mode revisado: cores testadas visualmente em todos os componentes base

- [x] **AC-GRID**: Sistema de grid
- [x] `--grid-columns` = `12` definido em index.css
- [x] `--grid-gutter` = `var(--space-6)` definido
- [x] `--grid-max-width` = `1200px` definido
- [x] Classe `.grid` utilitária: `display: grid; grid-template-columns: repeat(12, 1fr); gap: var(--grid-gutter)`
- [x] Classes `.grid-col-{3,4,6,8,12}` para spans
- [x] Breakpoints `--bp-*` usados para grid responsivo
