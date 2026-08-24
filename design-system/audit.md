# Auditoria de Inconsistência de Tokens — AC1

> Gerado em: 2026-06-29
> Base: brand manual (`brand/`) vs código (`packages/client/src/`, `packages/ui/src/`, `design-system/tokens/`)

---

## Resumo Executivo

O sistema de tokens do Letra possui **3 fontes de verdade concorrentes** com namespaces, formatos de cor e propósitos divergentes. Não há ponte declarada entre os tokens oficiais da marca (`--letra-*` / `--brand-*`) e os tokens efetivamente usados na UI (`--surface-*`, `--text-*`, `--gate-*`, `--live`).

### As 3 fontes de token

| Fonte | Formato | Namespace | Uso real |
|---|---|---|---|
| `design-system/tokens/design-tokens.css` | HEX | `--letra-*`, `--brand-*` | **Não usada diretamente** — os tokens não aparecem em nenhum componente |
| `design-system/tokens/shadcn-theme.css` | HSL | `--background`, `--foreground`, etc. | **Quase não usada** — poucos componentes referenciam |
| `packages/ui/src/index.css` | OKLCH | `--surface-*`, `--text-*`, `--border-*`, `--gate-*` | **Única realmente ativa** — todos os componentes usam estes tokens |

---

## Gap #1: Namespace `--letra-*` vs `--*` semântico

O brand manual (`brand/colors.md`) define cores via `--letra-amber: #ffb800`. O `design-tokens.css` expande para `--letra-amber-400/500/600`. Porém, os componentes usam tokens completamente diferentes:

| Brand / design-tokens | Usado em componentes | Gap |
|---|---|---|
| `--letra-amber-500` (#FFB800) | `--primary` (oklch(0.72 0.18 75) ≈ #E5A800) | Cor diferente (mais escura) |
| `--letra-slate-900` (#0F1115) | `--surface-1` (oklch(0.145 0 0) ≈ #252525) | Cor diferente (mais clara) |
| `--letra-emerald-500` (#22C55E) | `--success` (oklch(0.627 0.194 149.214) ≈ #4ADE80) | Tom diferente |
| `--letra-purple-500` (#8B5CF6) | `--accent` (oklch(0.72 0.18 75) ≈ amber, não purple!) | **Erro grave**: `--accent` aponta para amber, não purple |
| `--letra-red-500` (#EF4444) | `--error` (oklch(0.577 0.245 27.325) ≈ #EF4444) | OK (mesma cor) |
| `--letra-blue-500` (#3B82F6) | `--info` (oklch(0.666 0.179 58.318) ≈ #FF9500) | **Erro grave**: info aponta para laranja, não azul! |

**Problemas críticos:**
1. `--accent` no `@letra/ui/index.css` aponta para amber (`oklch(0.72 0.18 75)`), mas no brand manual e design-tokens, "acento" operacional é amber e purple é para agentes. O shadcn-theme.css define `--accent` como purple (`258 90% 66%`), criando conflito direto.
2. `--info` no `@letra/ui/index.css` aponta para um laranja/amber, mas no brand manual info é blue (`--letra-blue-500` / `#3B82F6`).

## Gap #2: Nomenclatura de fontes

| brand manual / design-tokens | ui/index.css | Gap |
|---|---|---|
| `--font-ui: "Inter"...` | `--font-body: 'Inter'...` | Nome diferente para mesma fonte |
| `--font-mono: "JetBrains Mono"...` | `--font-code: 'JetBrains Mono'...` | Nome diferente para mesma fonte |
| `--font-brand: "Sora"...` | **Não definido** | Sora não está disponível como token no UI |

## Gap #3: Tokens órfãos (usados mas não definidos)

| Token | Onde é usado | Deficão |
|---|---|---|
| `--primary-alpha` | `Sidebar.tsx:129` | **Não definido** em nenhum CSS |
| `--font-brand` | `design-tokens.css` (definido) | **Não usado** em nenhum componente |

## Gap #4: Tokens sem equivalente no brand manual

| Token | Uso | Origem |
|---|---|---|
| `--surface-1` a `--surface-950` | Fundos de cards, painéis | ui/index.css |
| `--gate-waiting` | Gate aguardando aprovação | ui/index.css |
| `--gate-available` | Gate pronto para aprovação | ui/index.css |
| `--gate-approved` | Gate aprovado | ui/index.css |
| `--gate-blocked` | Gate bloqueado | ui/index.css |
| `--live` | Indicador de servidor ativo | ui/index.css |
| `--overlay` | Fundo de modais | ui/index.css |
| `--shadow-sm/md/lg/xl` | Sombras de elevação | ui/index.css |

Nenhum destes tokens tem contraparte em `design-tokens.css`.

## Gap #5: Formatos de cor divergentes

| Arquivo | Formato | Exemplo |
|---|---|---|
| `design-tokens.css` | HEX | `#FFB800` |
| `shadcn-theme.css` | HSL | `43 100% 50%` |
| `ui/src/index.css` | OKLCH | `oklch(0.72 0.18 75)` |

**3 formatos de cor simultâneos** — impossível garantir consistência visual sem conversão explícita.

## Gap #6: shadcn-theme.css praticamente inerte

`shadcn-theme.css` define tokens HSL (`--background`, `--foreground`, `--primary`, etc.) mas os componentes em `@letra/ui/src/` usam exclusivamente os tokens OKLCH de `ui/src/index.css`. Os únicos lugares que referenciam `var(--background)` etc. usam os aliases definidos em `ui/src/index.css` (que apontam para `--surface-1`), **não** os valores HSL do shadcn-theme.

**Impacto:** Se alguém modificar `shadcn-theme.css`, nenhum componente será afetado. É dead code.

## Gap #7: Árvore de UI duplicada

Componentes com versões independentes em `packages/client/src/components/ui/` e `packages/ui/src/`:

| Componente | client/src/components/ui/ | packages/ui/src/ |
|---|---|---|
| dialog.tsx | ✅ | ✅ |
| input.tsx | ✅ | ✅ |
| textarea.tsx | ✅ | ✅ |
| checkbox.tsx | ✅ | ✅ |
| skeleton.tsx | ✅ | ✅ |

Estas cópias divergiram — não há garantia de comportamento consistente.

---

## Mapa completo de tokens usados vs. oficiais

### Tokens usados no cliente (packages/client/src/)

```
--background     → 20 ocorrências (App, FlowView, ItemDetail, LogSearch, SetupWizard, SidePanel, DocumentEditor, dialog, input, textarea)
--foreground     → 20 ocorrências (App, FlowView, Header, ItemDetail, AuditLog, KanbanBoard, Diagnostics, Sidebar, etc.)
--border         → 42 ocorrências (maioria dos componentes)
--card           → 17 ocorrências (FlowView, Home, KanbanView, Sidebar, Specs, Diagnostics, etc.)
--muted          → 12 ocorrências (PipelineStatus, Execution, Sidebar, Specs, SidePanel, etc.)
--muted-foreground → 35 ocorrências (espalhado por quase todos os componentes)
--primary        → 28 ocorrências (FlowView, Kanban, Specs, Home, Execution, Diagnostics, etc.)
--primary-foreground → 6 ocorrências (FlowView, SetupWizard, Workspaces, Diagnostics, Specs)
--error          → 14 ocorrências (FlowView, ItemDetail, Kanban, AuditLog, Workspaces, Toast, etc.)
--success        → 14 ocorrências (FlowView, Home, Kanban, Execution, LogSearch, Toast, Workspaces, SetupWizard)
--warning        → 12 ocorrências (FlowView, Home, Kanban, LogSearch, ItemDetail, Diagnostics, Specs, etc.)
--overlay        → 2 ocorrências (ItemDetail, dialog)
--surface-1      → 5 ocorrências (Header, index.css, SetupWizard, Workspaces, DocumentEditor)
--surface-2      → 1 ocorrência (index.css)
--surface-3      → 1 ocorrência (index.css)
--text-primary   → 1 ocorrência (index.css)
--gate-waiting   → 5 ocorrências (GateCard, PipelineStatus, Home, Execution, index.css)
--gate-available → 5 ocorrências (GateCard, KanbanBoard, ActivityTimeline, Sidebar, index.css)
--gate-approved  → 1 ocorrência (GateCard)
--gate-blocked   → 3 ocorrências (GateCard, PipelineStatus, Home)
--live           → 3 ocorrências (FlowView, KanbanBoard, MarchingBorder, index.css)
--border-focus   → 1 ocorrência (KanbanView)
--info           → 2 ocorrências (LogSearch, item-utils)
--primary-alpha  → 1 ocorrência (Sidebar) — **NÃO DEFINIDO**
--success-foreground → 2 ocorrências (SetupWizard, Toast)
--error-foreground  → 1 ocorrência (Toast)
--card-foreground   → 2 ocorrências (Specs, toast)
--accent         → 2 ocorrências (App, item-utils)
--font-body      → 1 ocorrência (index.css)
--font-code      → 2 ocorrências (error-banner, DocumentEditor, index.css)
```

### Tokens definidos oficialmente (design-tokens.css)

```
--letra-amber-400/500/600      → Não usados
--letra-slate-950/900/800/700/500/100 → Não usados
--letra-white-soft             → Não usados
--letra-emerald-500            → Não usados
--letra-blue-500               → Não usados
--letra-red-500                → Não usados
--letra-purple-500             → Não usados
--brand-primary/strong/soft    → Não usados
--brand-background/deep        → Não usados
--brand-surface/elevated       → Não usados
--brand-border                 → Não usados
--brand-text/muted             → Não usados
--brand-success/info/danger/agent → Não usados
--font-brand/ui/mono           → Não usados (--font-body/code usado)
--radius-sm/md/lg              → Não usados
--shadow-glow/card             → Não usados
--motion-fast/base/slow/emphasis → Não usados
```

**NENHUM token de `design-tokens.css` é referenciado por qualquer componente.**

---

## Recomendações

1. **Unificar para OKLCH** como formato único de cor (maior precisão, suporte a manipulação via `color-mix`)
2. **Eliminar `shadcn-theme.css`** ou convertê-lo para referenciar os mesmos tokens OKLCH
3. **Criar ponte semântica** entre `--letra-*` (primitivos) e `--surface-*`/`--text-*`/`--border-*` (semântico)
4. **Corrigir `--accent`** para purple (conforme brand manual) e amber permanecer como `--primary`
5. **Corrigir `--info`** para blue (conforme brand manual)
6. **Definir `--font-brand`** (Sora) no `ui/src/index.css`
7. **Renomear `--font-body` → `--font-ui`** e **`--font-code` → `--font-mono`** para alinhar com brand
8. **Adicionar tokens de gate** (`--gate-*`) e `--live` ao design-tokens oficial
9. **Adicionar `--primary-alpha`** ao sistema de tokens
10. **Eliminar duplicação** entre `client/src/components/ui/` e `packages/ui/src/`
