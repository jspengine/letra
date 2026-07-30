# Mapa Semântico de Tokens — AC2

> Atualizado: 2026-07-07
> Base: brand manual (`brand/colors.md`, `brand/typography.md`, `brand/motion.md`)
> Este documento descreve a ponte semântica histórica e aponta para a implementação atual do DS v2.
>
> **⚠ Implementação canônica**: `packages/ui/src/index.css` é a única fonte de verdade.

---

## Princípios

1. **OKLCH como formato único** — todas as cores em OKLCH (maior precisão, `color-mix`, manipulação programática)
2. **Primitivos (`--letra-*`)** — valores fixes da marca, nunca mudam
3. **Semânticos (`--brand-*`, `--surface-*`, `--text-*`, etc.)** — apontam para primitivos, podem variar por tema (dark/light)
4. **Aliases shadcn** — `--background`, `--foreground`, etc. apontam para tokens semânticos (compatibilidade)

---

## 1. Primitivos da Marca (`--letra-*`)

Valores históricos extraídos do `brand/colors.md` e do precursor `design-tokens.css`. A implementação canônica atual usa os tokens `--color-*`, `--space-*`, `--radius-*`, `--motion-*` e aliases de compatibilidade em `packages/ui/src/index.css`.

| Token | HEX | OKLCH | Papel |
|---|---|---|---|
| `--letra-amber-400` | `#ffd36a` | `oklch(0.86 0.12 80)` | brand soft |
| `--letra-amber-500` | `#ffb800` | `oklch(0.78 0.18 75)` | brand primary |
| `--letra-amber-600` | `#f59e0b` | `oklch(0.72 0.18 75)` | brand strong |
| `--letra-slate-950` | `#090b0f` | `oklch(0.06 0.01 250)` | fundo profundo |
| `--letra-slate-900` | `#0f1115` | `oklch(0.09 0.01 250)` | fundo principal |
| `--letra-slate-800` | `#171a21` | `oklch(0.13 0.02 250)` | cards / surface |
| `--letra-slate-700` | `#232833` | `oklch(0.18 0.02 250)` | bordas elevadas |
| `--letra-slate-500` | `#6b7280` | `oklch(0.48 0.02 250)` | texto secundário |
| `--letra-slate-100` | `#f3f4f6` | `oklch(0.96 0.01 250)` | fundo claro |
| `--letra-white-soft` | `#f8fafc` | `oklch(0.98 0.01 250)` | texto em dark |
| `--letra-emerald-500` | `#22c55e` | `oklch(0.63 0.19 150)` | sucesso |
| `--letra-blue-500` | `#3b82f6` | `oklch(0.55 0.19 260)` | informação |
| `--letra-red-500` | `#ef4444` | `oklch(0.58 0.25 30)` | erro |
| `--letra-purple-500` | `#8b5cf6` | `oklch(0.55 0.25 290)` | agentes / IA |

---

## 2. Camada Semântica (`--brand-*` → `--surface-*` / `--text-*` / `--border-*`)

### Dark mode (padrão)

| Token Semântico | Aponta para | Uso |
|---|---|---|
| `--brand-background` | `--letra-slate-900` | Fundo principal da interface |
| `--brand-background-deep` | `--letra-slate-950` | Fundo de modais, dropdowns |
| `--brand-surface` | `--letra-slate-800` | Cards, painéis, superfícies |
| `--brand-surface-elevated` | `--letra-slate-700` | Dropdowns, popovers, tooltips |
| `--brand-border` | `color-mix(in oklch, --letra-slate-500 28%, transparent)` | Bordas de cards e painéis |
| `--brand-text` | `--letra-white-soft` | Texto primário |
| `--brand-text-muted` | `--letra-slate-500` | Texto secundário / meta |
| `--brand-primary` | `--letra-amber-500` | Acento operacional, foco |
| `--brand-primary-strong` | `--letra-amber-600` | Hover / active states |
| `--brand-primary-soft` | `--letra-amber-400` | Backgrounds sutis de destaque |
| `--brand-success` | `--letra-emerald-500` | Sucesso, concluído |
| `--brand-info` | `--letra-blue-500` | Informação, status neutro |
| `--brand-danger` | `--letra-red-500` | Erro, bloqueio, risco |
| `--brand-agent` | `--letra-purple-500` | Agentes, IA, raciocínio |

### Light mode (.theme-light)

| Token Semântico | Valor |
|---|---|
| `--brand-background` | `oklch(0.98 0.01 250)` |
| `--brand-background-deep` | `oklch(1 0 0)` |
| `--brand-surface` | `oklch(1 0 0)` |
| `--brand-surface-elevated` | `oklch(0.96 0.01 250)` |
| `--brand-border` | `color-mix(in oklch, --letra-slate-900 10%, transparent)` |
| `--brand-text` | `--letra-slate-900` |
| `--brand-text-muted` | `--letra-slate-500` |
| (demais cores semânticas mantêm os mesmos primitivos) |

---

## 3. Tokens de Superfície Detalhados (`--surface-*`)

Para componentes que precisam de até 5 níveis de profundidade visual (AC UX).

| Token | Dark | Light | Uso |
|---|---|---|---|
| `--surface-1` | `--letra-slate-900` | `oklch(0.98 0.01 250)` | Fundo da página |
| `--surface-2` | `--letra-slate-800` | `oklch(1 0 0)` | Cards, colunas |
| `--surface-3` | `--letra-slate-700` | `oklch(0.96 0.01 250)` | Inputs, headers de coluna |
| `--surface-hover` | `color-mix(in oklch, --letra-amber-500 8%, --surface-2)` | Hover de cards |
| `--surface-selected` | `color-mix(in oklch, --letra-amber-500 15%, --surface-2)` | Item selecionado |

---

## 4. Tokens de Texto (`--text-*`)

| Token | Dark | Light | Uso |
|---|---|---|---|
| `--text-primary` | `--letra-white-soft` | `--letra-slate-900` | Texto principal |
| `--text-secondary` | `--letra-slate-500` | `oklch(0.45 0.02 250)` | Labels, metadados |
| `--text-disabled` | `oklch(0.48 0.02 250 / 0.5)` | `oklch(0.45 0.02 250 / 0.4)` | Itens desabilitados |
| `--text-link` | `--letra-amber-500` | `--letra-amber-600` | Links |
| `--text-inverse` | `--letra-slate-900` | `--letra-white-soft` | Texto sobre fundo claro/escuro |

---

## 5. Tokens de Borda (`--border-*`)

| Token | Dark | Light | Uso |
|---|---|---|---|
| `--border-default` | `color-mix(in oklch, --letra-slate-500 28%, transparent)` | Bordas de cards |
| `--border-hover` | `color-mix(in oklch, --letra-slate-500 40%, transparent)` | Hover em elementos clicáveis |
| `--border-focus` | `--letra-amber-500` | Focus ring |
| `--border-disabled` | `color-mix(in oklch, --letra-slate-500 15%, transparent)` | Itens desabilitados |

---

## 6. Tokens de Gate

Gates são momentos de aprovação humana — tratamento visual especial.

| Token | Dark | Light | Uso |
|---|---|---|---|
| `--gate-waiting` | `--letra-amber-500` (pulse) | Gate humano pendente |
| `--gate-available` | `--letra-emerald-500` (pulse) | Gate pronto para aprovação |
| `--gate-approved` | `--letra-emerald-500` | Gate aprovado |
| `--gate-blocked` | `--letra-red-500` | Gate bloqueado |

---

## 7. Tokens de Sistema

| Token | Valor | Uso |
|---|---|---|
| `--live` | `--letra-emerald-500` | Indicador de servidor/conexão ativa |
| `--overlay` | `oklch(0 0 0 / 0.4)` | Fundo de modais e sheets |
| `--shadow-sm` | `0 1px 2px oklch(0 0 0 / 0.3)` | Cards (dark) |
| `--shadow-md` | `0 4px 6px -1px oklch(0 0 0 / 0.35)` | Elevação média |
| `--shadow-lg` | `0 10px 15px -3px oklch(0 0 0 / 0.4)` | Dropdowns / popovers |
| `--shadow-xl` | `0 20px 25px -5px oklch(0 0 0 / 0.45)` | Modais |

---

## 8. Aliases shadcn (Compatibilidade)

Mapeamento real implementado em `packages/ui/src/index.css`. Estes aliases existem apenas para compatibilidade com componentes shadcn/base-ui e apontam para os tokens semânticos canônicos `--color-*`, `--surface-*`, `--text-*` e `--border-*`.

```css
:root {
  --background: var(--color-bg-base);
  --foreground: var(--color-text-primary);
  --card: var(--color-bg-surface);
  --card-foreground: var(--color-text-primary);
  --popover: var(--color-bg-base);
  --popover-foreground: var(--color-text-primary);
  --primary: var(--color-primary);
  --primary-foreground: var(--color-on-accent);
  --secondary: var(--color-bg-sunken);
  --secondary-foreground: var(--color-text-primary);
  --muted: var(--color-bg-surface);
  --muted-foreground: var(--color-text-secondary);
  --accent: var(--color-agent);
  --accent-foreground: var(--color-text-primary);
  --destructive: var(--color-danger);
  --border: var(--color-border);
  --input: var(--color-input);
  --ring: oklch(0.666 0.179 58.318 / 0.3);
}
```

> **Nota**: `--accent` = `var(--color-agent)` (purple `#8B5CF6` no tema dark) é reservado para contexto de agente. A cor operacional padrão continua em `--color-primary`.

---

## 9. Status da Migração

| Fase | Status |
|------|--------|
| Fase 1 — Correções críticas | ✅ `--accent`=purple, `--info`=blue, `--font-brand`=Sora |
| Fase 2 — Unificação de nomenclatura | ✅ `--font-body`→`--font-ui`, `--font-code`→`--font-mono`, `--surface-hover`/`--surface-selected` |
| Fase 3 — Simplificação | ✅ `packages/ui/src/index.css` é fonte única |
| Fase 4 — Limpeza | ✅ `design-tokens.css`, `shadcn-theme.css`, `tailwind-preset.js`, `scale.md` removidos |
