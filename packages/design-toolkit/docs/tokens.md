# Design Tokens

> Fonte da verdade: `packages/ui/src/index.css`
> Gerado do spec em `.letra/specs/design-system/spec.md`

## Superfícies

Controlam a hierarquia visual de fundos.

| Token | Light | Dark | Uso |
|---|---|---|---|
| `--surface-1` | oklch(1 0 0) | oklch(0.145 0 0) | Fundo geral da página |
| `--surface-2` | oklch(0.965 0 0) | oklch(0.205 0 0) | Cards, superfícies elevadas |
| `--surface-3` | oklch(0.922 0 0) | oklch(0.269 0 0) | Hover, elementos secundários |
| `--surface-input` | oklch(0.985 0 0) | oklch(0.145 0 0) | Input fields |

**Regra:** Sempre usar `--surface-{n}`. Nunca `background: #fff` ou `bg-white`.

## Texto

| Token | Light | Dark | Uso |
|---|---|---|---|
| `--text-primary` | oklch(0.145 0 0) | oklch(0.985 0 0) | Body, headings |
| `--text-secondary` | oklch(0.556 0 0) | oklch(0.708 0 0) | Labels, hints, metadados |
| `--text-disabled` | oklch(0.556 0 0 / 0.5) | oklch(0.708 0 0 / 0.5) | Itens desabilitados |
| `--text-link` | oklch(0.546 0.245 262.881) | oklch(0.685 0.246 262.881) | Links |
| `--text-inverse` | oklch(1 0 0) | oklch(0.145 0 0) | Texto sobre primary/success/etc |

## Bordas

| Token | Light | Dark | Uso |
|---|---|---|---|
| `--border-default` | oklch(0.922 0 0) | oklch(0.269 0 0) | Borda padrão |
| `--border-hover` | oklch(0.87 0 0) | oklch(0.33 0 0) | Hover em cards/buttons |
| `--border-focus` | oklch(0.546 0.245 262.881) | oklch(0.685 0.246 262.881) | Foco (ring) |
| `--border-disabled` | oklch(0.922 0 0 / 0.5) | oklch(0.269 0 0 / 0.5) | Elementos desabilitados |

## Brand

| Token | Light | Dark |
|---|---|---|
| `--primary` | oklch(0.546 0.245 262.881) | oklch(0.685 0.246 262.881) |
| `--primary-foreground` | oklch(1 0 0) | oklch(0.985 0 0) |
| `--accent` | oklch(0.715 0.143 215.42) | oklch(0.685 0.246 262.881) |
| `--accent-foreground` | oklch(0.985 0 0) | oklch(0.985 0 0) |

## Semântica (feedback)

| Token | Light/Dark | Uso |
|---|---|---|
| `--success` | oklch(0.627 0.194 149.214) | Concluído, ACs aprovadas |
| `--warning` | oklch(0.769 0.188 70.08) | Atenção, em andamento |
| `--error` | oklch(0.577 0.245 27.325) | Erros, drift crítico |
| `--info` | *igual primary* | Informação geral |
| `--live` | oklch(0.627 0.194 149.214) | Indicador "ao vivo" |

## Micro-interações

Ver `design-system.md:Micro-interactions` para a tabela completa.

Padrão:
| Elemento | Efeito |
|---|---|
| Cards interativos | `hover:shadow-md hover:-translate-y-0.5 hover:border-primary/30 transition-all duration-200` |
| Botões | `transition-all duration-150 hover:opacity-90 active:scale-[0.98]` |
| Foco visível | `focus-visible:ring-2 ring-[color]` onde ring = `--border-focus` com opacidade |
