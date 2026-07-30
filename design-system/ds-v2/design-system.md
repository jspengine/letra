# Design System — Letra

> Alinhado ao Brand System oficial (`letra-web.vercel.app/brand`). Ferramenta de orquestração e supervisão de agentes de IA para engenheiros — "Mission Control para engenharia assistida por IA."

---

## 0. Princípios

1. **Consistência sobre criatividade pontual** — um componente se comporta igual em qualquer tela do produto.
2. **Tokens, não valores mágicos** — cor, espaçamento, tipografia e ícone sempre referenciados por token semântico.
3. **Acessibilidade é requisito** — contraste AA mesmo em tema escuro, navegação por teclado, foco visível.
4. **Roxo é a cor do agente, não decoração** — reservado exclusivamente para estados de raciocínio/ação de IA, nunca usado esteticamente em outro contexto.

---

## 1. Fundamentos

### 1.1 Paleta de cores (oficial)

| Token | Cor | Valor | Uso |
|---|---|---|---|
| `color-primary` (Amber) | 🟧 | `#FFB800` | Marca, ações primárias, foco, energia/atenção |
| `color-bg-base` (Slate) | ⬛ | `#0F1115` | Fundo da aplicação, estrutura |
| `color-success` (Emerald) | 🟩 | `#22C55E` | Execução bem-sucedida |
| `color-info` (Blue) | 🟦 | `#3B82F6` | Informação, telemetria |
| `color-danger` (Red) | 🟥 | `#EF4444` | Erro, bloqueio, risco |
| `color-agent` (Purple) | 🟪 | `#8B5CF6` | **Agentes e raciocínio de IA** — exclusivo desse contexto |

**Derivados de superfície (a partir do Slate base):**

| Token | Valor | Uso |
|---|---|---|
| `color-bg-surface` | `#171A20` | Cards, modais, drawers |
| `color-bg-sunken` | `#1D2128` | Sidebar, inputs |
| `color-border` | `#2A2F38` | Bordas padrão |
| `color-text-primary` | `#ECEDEF` | Texto principal |
| `color-text-secondary` | `#9AA1AC` | Texto de apoio |
| `color-text-disabled` | `#5B6270` | Texto desabilitado |

**Regra de uso do Amber:** funciona tanto como cor de marca quanto como "atenção" (ex: badge de destaque, warning leve) — o brand oficial não separa um `warning` do `primary`. Reservar tons mais claros (`#FFC933`) para hover e mais escuros (`#E0A400`) para estado pressed.

**Regra do Purple (agente):** é a única cor do sistema com significado de domínio, não de UI genérica — usar apenas em: avatar de agente, indicador de "raciocinando", badge de tipo "agent", nunca como accent decorativo.

### 1.2 Tipografia (oficial)

| Token | Fonte / peso | Tamanho | Uso |
|---|---|---|---|
| `text-display` | Sora 600 | 56px | Hero, wordmark em contexto de página |
| `text-h1` | Sora 600 | 40px | Título de página — ex: *"Da intenção à entrega"* |
| `text-h2` | Inter 600 | 28px | Subtítulo de seção — ex: *"Engineering, orchestrated"* |
| `text-h3` | Inter 600 | 20px | Título de card/bloco |
| `text-body` | Inter 400 | 16px | Texto corrido — ex: *"Mission Control para engenharia assistida por IA."* |
| `text-body-sm` | Inter 400 | 13px | Texto de apoio |
| `text-caption` | Inter 500 | 12px | Metadados — ex: *"4 agents active · Awaiting approval"* |
| `text-mono` | JetBrains Mono 400 | 14px | Comandos, IDs, dados — ex: `$ letra flow start --workspace my-project` |

**Regra:** Sora só em display/H1 (identidade da marca); Inter em toda a UI funcional; Mono exclusivamente para conteúdo literalmente técnico (comandos, IDs, payloads, métricas), nunca para texto de interface comum.

### 1.3 Iconografia

**Biblioteca oficial:** [`lucide-react`](https://lucide.dev).

**Regras:**
- `stroke-width: 1.75–2` padrão.
- Tamanho: `16px` inline com texto, `20px` em botões/navegação, `24px+` em estados vazios.
- Cor do ícone = token semântico do contexto (nunca cor fixa): ícone de agente → `color-agent`; ícone de sucesso → `color-success`; ícone neutro → `color-text-secondary`.

**Mapeamento de domínio:**

| Conceito | Ícone Lucide | Cor |
|---|---|---|
| Agente / raciocínio de IA | `bot`, `sparkles` | `color-agent` |
| Execução ativa | `activity`, `zap` | `color-primary` |
| Pipeline / orquestração | `workflow`, `git-branch` | `color-info` |
| Logs / terminal | `terminal`, `scroll-text` | `color-text-secondary` |
| Sucesso | `circle-check` | `color-success` |
| Erro / bloqueio | `circle-x`, `octagon-alert` | `color-danger` |
| Aprovação pendente | `clock`, `hourglass` | `color-primary` |
| Conector / MCP | `plug` | `color-info` |
| Configuração | `settings-2`, `sliders-horizontal` | `color-text-secondary` |

### 1.4 Motion

| Token | Valor |
|---|---|
| `duration-fast` | `180ms` |
| `ease-standard` | `cubic-bezier(0.2, 0.8, 0.2, 1)` |

**Regra:** todo hover, tap e transição de estado usa esse par duration/easing — é a assinatura de movimento da marca. Reservar durações maiores (`280–320ms`) apenas para abertura/fechamento de drawers e modais (deslocamento maior de área).

### 1.5 Espaçamento e grid

Base 4px: `space-1`(4) → `space-16`(64). Grid 12 colunas, gutter `space-6`(24px), max-width 1200px.

---

## 2. Componentes

O brand oficial já documenta uma base de componentes (`/brand#components`): **Button** (primary/secondary/danger/ghost/sm), **Card**, **Input & Textarea**, **Badge** (5 variantes: amber/success/info/error/agent), **Progress**, **Checkbox**, **Tag/Chip**, **Tabs**, **Avatar**, **List Item**.

Este documento estende essa base com os componentes de produto necessários para telas de supervisão (Drawers, Menus laterais, Toasts, Search, Modais), seguindo os mesmos tokens.

### 2.1 Button
**Variantes:** `primary` (amber sólido), `secondary` (outline slate), `danger` (red sólido), `ghost` (sem fundo/borda), `sm` (compacto).
**Estados:** default, hover (`color-primary-hover` + transição `duration-fast`/`ease-standard`), active/pressed, disabled, loading (ícone `loader-circle` girando).

### 2.2 Card
**Anatomia:** header (título + ação opcional) → corpo → footer/ações.
**Variante de domínio:** card de agente usa borda esquerda de 2px em `color-agent` quando o agente está ativo/raciocinando.

### 2.3 Input & Textarea
Borda de foco em `color-primary` (âmbar) — comportamento já definido no brand oficial. Erro sobrepõe o foco com `color-danger`.

### 2.4 Badge
5 variantes oficiais: `amber`, `success`, `info`, `error`, `agent`. Sempre ícone + texto, nunca só cor.

### 2.5 Progress
Barra preenchida — usar `color-primary` para progresso genérico, `color-success` para conclusão, `color-danger` para falha/rollback.
**Domínio:** progress de execução de agente pode usar `color-agent` enquanto o agente ainda está "raciocinando" (antes de haver resultado determinístico), trocando para success/danger ao concluir.

### 2.6 Checkbox
Accent color = `color-primary`. Estados: default, checked, disabled.

### 2.7 Tag / Chip
Pill-shaped, fundo sólido ou variante translúcida. Usado para tecnologias, tipos de agente, integrações (ex: "React", "TypeScript", "Amber").

### 2.8 Tabs
Tab ativa com underline em `color-primary`. Estados: active, inactive, disabled.

### 2.9 Avatar
Circular com iniciais (humanos) ou ícone `bot` (agentes). Avatar de agente usa fundo `color-bg-sunken` + ícone em `color-agent`, com dot de status (`success`/`danger`/`text-disabled`) sobreposto.

### 2.10 List Item
Linha clicável: ícone → título + descrição → ação/chevron opcional. Usado para listas de agentes, pipelines, execuções.

### 2.11 Drawers *(extensão de produto)*
Painel lateral para inspeção contextual (detalhe de execução de um agente). Overlay + foco preso + fecha com Esc/clique fora/botão X. Duração de transição `280ms` com `ease-standard`.

### 2.12 Menus laterais *(extensão de produto)*
Navegação fixa, sem overlay. Item ativo em `color-primary`, ícones Lucide 20px.

### 2.13 Toasts *(extensão de produto)*
Tipos mapeados às cores oficiais: sucesso (`circle-check`/emerald), erro (`circle-x`/red), info (`info`/blue), e um tipo adicional **"agent update"** (`sparkles`/purple) para notificações geradas por um agente autônomo, distinguindo-as de eventos do sistema.

### 2.14 Search *(extensão de produto)*
Ícone `search`, debounce ~300ms, resultado destacado com `color-primary` translúcido.

### 2.15 Modais *(extensão de produto)*
Overlay bloqueia scroll, foco preso, máximo 1 ação primária + 1 secundária no footer.

### 2.16 Alert
**Variantes:** `info` (blue), `success` (emerald), `warning` (amber), `error` (red).
**Anatomia:** ícone semântico à esquerda → título opcional → mensagem. Fundo com 12% de opacidade da cor do token, borda com 35%.

### 2.17 Accordion
**Anatomia:** `Accordion` raiz → `AccordionItem` → `AccordionTrigger` + `AccordionContent`.
**Comportamento:** acordeão controlado por estado de abertura via `@base-ui/react/accordion`. Chevron rotate indica aberto/fechado.

### 2.18 Collapsible
**Anatomia:** `Collapsible` raiz → `CollapsibleTrigger` + `CollapsibleContent`.
**Uso:** painéis expansíveis inline, sem animação de acordeão — mais leve que Accordion.

### 2.19 Command (Palette)
**Anatomia:** `Command` → `CommandInput` (filtro) → `CommandList` → `CommandGroup` + `CommandItem` | `CommandEmpty`.
**Comportamento:** filtragem automática por query, navegação por setas, `CommandShortcut` para atalhos de teclado.
**Uso de domínio:** paleta de comandos do Letra para buscar agentes, pipelines, executar ações.

### 2.20 Dialog
**3 variantes:**
| Variante | Função |
|---|---|
| `Dialog` | Modal genérico com título, corpo, ações |
| `ConfirmDialog` | Confirmação com `variant="default\|danger"` |
| `PromptDialog` | Input de texto com submit |
**Comportamento:** overlay com fade, fecha com Esc/clique fora, foco preso no dialog (`<dialog>` nativo).

### 2.21 Dropdown Menu
**Anatomia:** `DropdownMenu` → `DropdownMenuTrigger` + `DropdownMenuContent` → `DropdownMenuItem` | `DropdownMenuSeparator` | `DropdownMenuLabel`.
**Align:** `start`, `center`, `end`. Suporta `asChild` no trigger.
**Estados:** item com hover/focus, disabled (`data-disabled`).

### 2.22 Empty State
**Props:** `icon`, `title`, `description`, `action`.
**Uso:** estado vazio de listas, boards, resultados de busca — sempre com call-to-action opcional.

### 2.23 Error Banner
**Anatomia:** ícone `x-circle` → título + mensagem → `onRetry` (Tentar novamente) + `details` (expansível).
**Comportamento:** fundo com 10% de opacidade do token `error`, borda sólida no token. Detalhes colapsáveis com `pre` formatado para stack traces.

### 2.24 Icon
**Biblioteca:** SVG inline custom — 40+ ícones nomeados no objeto `ICONS`.
**Tamanhos:** `10`, `12`, `14`, `16`, `18`, `20`, `24`.
**Regra:** `stroke-width: 1.75`, cor sempre herdada de `currentColor` ou token semântico. Não substitui `lucide-react` — é complementar para ícones de domínio (specs, flow, context, etc.).

### 2.25 Label
Label de formulário com `peer-disabled` para alinhamento visual com inputs desabilitados.
**Uso:** sempre acoplado a `Input`, `Select`, `Textarea`, `RadioGroup` via `htmlFor`/`id`.

### 2.26 Navigation Menu
**Anatomia:** `NavigationMenu` → `NavigationMenuList` → `NavigationMenuItem` → `NavigationMenuTrigger` + `NavigationMenuContent`.
**Features:** submenu com portal, chevron animado, navegação por teclado. Baseado em `@base-ui/react/navigation-menu`.

### 2.27 Popover
**Anatomia:** `Popover` → `PopoverTrigger` + `PopoverContent`.
**Align:** `start`, `center`, `end`. Fecha com clique fora/Esc.
**Uso:** dicas contextuais, filtros rápidos, menus de ação inline.

### 2.28 Radio Group
**Anatomia:** `RadioGroup` → `RadioGroupItem` (com `RadioGroup.Indicator`).
**Estados:** default, checked, disabled.
**Accent:** `color-primary` (âmbar) no estado checked.

### 2.29 Scroll Area
**Anatomia:** `ScrollArea` wrapper + `ScrollAreaViewport`.
**Tipos de scrollbar:** `always`, `auto`, `hover`.

### 2.30 Separator
**Props:** `orientation` (`horizontal` | `vertical`), `decorative` (define `aria-hidden`).
**Uso:** separação visual entre seções, grupos de menu, itens de lista.

### 2.31 Sheet
**Anatomia:** `Sheet` → `SheetTrigger` + `SheetContent` → `SheetHeader` + `SheetTitle` + `SheetDescription` + `SheetFooter` | `SheetClose`.
**Side:** `top`, `bottom`, `left`, `right`. Largura padrão `sm:max-w-lg`.
**Comportamento:** overlay, foco preso, aria-modal. Similar ao Drawer mas com suporte a 4 direções.

### 2.32 Skeleton
**6 variantes de layout:**
| Variante | Uso |
|---|---|
| `Skeleton` | Bloco genérico (`animate-pulse`) |
| `SkeletonCard` | Card de loading (grid) |
| `SkeletonPipeline` | Pipeline de execução (5 etapas) |
| `SkeletonTable` | Tabela com 5 linhas |
| `SkeletonAgentList` | Lista de agentes |
| `SkeletonKanban` | Board Kanban 4-5 colunas |

### 2.33 Switch
**Tamanhos:** `sm`, `default`.
**Estados:** checked/unchecked, disabled.
**Accent:** `color-primary` (âmbar) no estado checked. Baseado em `@base-ui/react/switch`.

### 2.34 Table
**Anatomia:** `Table` → `TableHeader` → `TableBody` → `TableRow` → `TableHead` / `TableCell`.
**Extras:** `TableFooter`, `TableCaption`. Container com `overflow-x-auto` para responsividade.
**Estados:** row com `hover` e `aria-expanded` highlight.

### 2.35 Tooltip
**Props:** `content` (string), `position` (`top` | `bottom` | `left` | `right`).
**Comportamento:** show em hover/focus, hide em blur/leave. `pointer-events-none` no tooltip para não interferir em interações.

---

## 3. Padrões de Composição

Padrões de UI específicos do produto Letra — combinam componentes base em composições reutilizáveis.

### 3.1 Sidebar (shadcn)
**Anatomia:** `SidebarProvider` → `Sidebar` (com `SidebarHeader`, `SidebarContent`, `SidebarFooter`) → `SidebarMenu` → `SidebarMenuItem` + `SidebarMenuButton`.
**Variantes:** `sidebar` (default), `floating`, `inset`.
**Colapsável:** `offcanvas` (desliza), `icon` (ícone apenas), `none`.
**Comportamento:** toggle com `Ctrl+B`, cookie persiste estado, mobile usa `Sheet` como drawer. SidebarInset para o conteúdo principal.
**Sub-componentes:** `SidebarTrigger`, `SidebarRail`, `SidebarInput`, `SidebarSeparator`, `SidebarGroup`, `SidebarGroupLabel`, `SidebarGroupAction`, `SidebarGroupContent`, `SidebarMenuSub`, `SidebarMenuBadge`, `SidebarMenuSkeleton`, `SidebarMenuAction`.

### 3.2 Document Editor
**Anatomia:** `RulerHeader` (título + seções + progresso) + preview `Markdown` | split Editor/Preview lado a lado.
**Modos:** `read` (visualização) | `edit` (editor markdown + preview ao vivo).
**Comportamento:** `Ctrl+S` salva, dirty state com indicador visual, scroll sync com navegação por seções.

### 3.3 Kanban Board
**Anatomia:** grid de colunas por estágio → `ItemCard` + drop zone.
**ItemCard:** badge de tipo (FEAT/BUG/CHORE/DOCS) + slug + estado operacional + responsável + progresso de ACs + idade.
**Comportamento:** drag & drop entre colunas, validação via `allowDrop`, filtro (all/running/waiting/blocked/done).
**Estado visual:** coluna com gate humano ganha destaque âmbar + badge pulsante. Item em gate humano tem `animate-human-pulse`.
**Vazio:** estado "Vazio" com fallback textual.

### 3.4 Gate Card
**Estados:** `waiting`, `available`, `approved`, `changes-requested`, `rejected`, `expired`.
**Anatomia:** `Card` com borda esquerda de 4px colorida + badge de status + feature + stage/agent + ações.
**Ações:** (estado `available`) Aprovar, Rejeitar, Solicitar Alterações.
**Urgência:** se >5min em `available`, ativa `animate-pulse-gate-urgent`.
**Composição:** `GatePendingList` agrupa múltiplos gates com contagem.

### 3.5 Activity Timeline
**Anatomia:** linha vertical + dots de atividade + avatar (humano) ou ícone (sistema).
**Agrupamento:** Hoje / Ontem / Esta semana / Anterior.
**Comportamento:** scroll infinito (limite 30 itens), timestamp relativo.
**Domínio:** usado para "Itens observados" — rastreio de movimentação de itens entre estágios.

### 3.6 Marching Border
**Anatomia:** SVG overlay com `rect` de dash animado (`stroke-dashoffset` marching ants).
**Uso:** borda ativa em cards claimed por um agente — indica "ao vivo"/"em andamento".
**Cor:** `var(--live)`.

### 3.7 Validating Bar
**Anatomia:** barra fina (2px) no topo da viewport com `animate-validating-bar` (shimmer horizontal).
**Comportamento:** `active: boolean` controla opacidade (0 → 1). `pointer-events-none` quando inativa.
**Cor:** `var(--primary)` (âmbar).

---

## 4. Assets de marca

Logos oficiais disponíveis em SVG: horizontal (uso preferencial), vertical, símbolo isolado, wordmark dark/light, app icon, monocromático, favicon — todos em `letra-web.vercel.app/brand/logos/svg/`.

**Regra de uso:** símbolo isolado (`letra-symbol.svg`) para espaços compactos (favicon, avatar da marca, ícone de app); horizontal para cabeçalhos e materiais com espaço amplo; monocromático apenas sobre fundos com contraste extremo onde a versão colorida perderia legibilidade.

---

## 4. Template de documentação por componente

1. Preview visual + snippet de código
2. Anatomia
3. Props/variantes
4. Estados
5. Do's and Don'ts
6. Acessibilidade

---

## 5. Referência visual

Ver `design-system-showcase.html` — showcase com os tokens e componentes acima, incluindo os logos oficiais do Letra.
