# Design System Reference

> Updated: 2026-06-13

## Stack

- **React 19** + TypeScript (functional components, hooks)
- **Tailwind v4** with `@tailwindcss/vite` (NO PostCSS, NO tailwind.config.js)
- **CSS variables** in `packages/client/src/index.css`
- **OKLCH** color space (not HSL)
- **Zero runtime dependencies** — all components hand-rolled

## Color Tokens

Defined in `packages/ui/src/index.css`. Dark mode via `.dark` class on `<html>`.

**Source of truth:** `packages/ui/src/index.css` — the UI package owns all tokens.
**Client** imports via `@import "../../ui/src/index.css"`.

### Surfaces

| Token | Light | Dark | Uso |
|---|---|---|---|
| `--surface-1` | oklch(1 0 0) | oklch(0.145 0 0) | Fundo geral |
| `--surface-2` | oklch(0.965 0 0) | oklch(0.205 0 0) | Cards, elevado |
| `--surface-3` | oklch(0.922 0 0) | oklch(0.269 0 0) | Hover, secundário |
| `--surface-input` | oklch(0.985 0 0) | oklch(0.145 0 0) | Input fields |

### Text

| Token | Light | Dark | Uso |
|---|---|---|---|
| `--text-primary` | oklch(0.145 0 0) | oklch(0.985 0 0) | Body, headings |
| `--text-secondary` | oklch(0.556 0 0) | oklch(0.708 0 0) | Labels, hints |
| `--text-disabled` | oklch(0.556 0 0 / 0.5) | oklch(0.708 0 0 / 0.5) | Desabilitado |
| `--text-link` | oklch(0.546 0.245 262.881) | oklch(0.685 0.246 262.881) | Links |
| `--text-inverse` | oklch(1 0 0) | oklch(0.145 0 0) | Sobre primary |

### Borders

| Token | Light | Dark | Uso |
|---|---|---|---|
| `--border-default` | oklch(0.922 0 0) | oklch(0.269 0 0) | Borda padrão |
| `--border-hover` | oklch(0.87 0 0) | oklch(0.33 0 0) | Hover |
| `--border-focus` | oklch(0.546 0.245 262.881) | oklch(0.685 0.246 262.881) | Foco/ring |
| `--border-disabled` | oklch(0.922 0 0 / 0.5) | oklch(0.269 0 0 / 0.5) | Desabilitado |

### Brand

`--primary`, `--accent`, `--primary-foreground`, `--accent-foreground`

### Semantic

`--success`, `--warning`, `--error`, `--info`, `--live` (+ *-foreground)

### Overlay

`--overlay: oklch(0 0 0 / 0.4)` — usado em dialogs/modais

**Regra:** Sempre use `var(--*)`. Nunca `#hex` ou `rgb()` ou `oklch()` inline em componentes.
Use `npm run ds:check` para verificar violações.

## Typography

- **Font stack:** `system-ui, -apple-system, sans-serif`
- **Mono stack:** `ui-monospace, SFMono-Regular, 'Cascadia Code', monospace`
- **Scale:** Tailwind text scale (`text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`, `text-2xl`, `text-3xl`)

## Spacing & Radius

| Token | Value |
|---|---|
| Base unit | 4px (Tailwind `p-1` = 4px) |
| `rounded-sm` | 6px |
| `rounded-lg` | 12px |
| `rounded-xl` | 16px |
| Transitions | 150ms default, 200ms hover, 300ms slow |

## Layout

- **Shell:** Header(56px) + NavTabs(40px) + Content(flex-1 overflow-y-auto)
- **Content padding:** `p-6`
- **Card max-width detail:** `max-w-3xl mx-auto`
- **Sidebar:** `w-80` (Specs), `w-72` (Context)

## Icons

### Component: `<Icon>`

```tsx
import { Icon } from "../ui/icon";
import type { IconName } from "../ui/icon";

<Icon name="home" size={16} className="text-primary" />
<Icon name="info" size={14} style={{ color: "var(--muted-foreground)" }} />
```

### API

| Prop | Type | Default | Description |
|---|---|---|---|
| `name` | `IconName` | required | Icon identifier from the set below |
| `size` | `14 \| 16 \| 20 \| 24` | `16` | Pixel dimensions (square) |
| `className` | `string` | — | Tailwind classes (`shrink-0` always applied) |
| `style` | `CSSProperties` | — | Inline styles (use for `color: var(--*)`) |

### Rules (do not violate)

1. **Always use `<Icon>`** — never inline raw `<svg>` in component code
2. **No icon library dependencies** — all SVGs are hand-defined in `icon.tsx`
3. **24×24 viewBox** — every icon uses this standard grid
4. **2px stroke** — `strokeWidth="2"`, `strokeLinecap="round"`, `strokeLinejoin="round"`
5. **`currentColor`** — color inherits from text; use `className="text-*"` to change
6. **`aria-hidden="true"`** — all icons are decorative, no need for screen reader announcement

### Adding a New Icon

1. Open `packages/client/src/components/ui/icon.tsx`
2. Add the icon path(s) to the `ICONS` record as an array of path `d` strings
3. The key becomes the `IconName` — no other file needs updating for the type to work
4. If the icon is standard (e.g., Lucide-flavored), copy the `d` attributes directly

### Available Icons (20)

| Name | Preview (path count) | Used In |
|---|---|---|
| `home` | House (1) | NavTabs |
| `specs` | File with lines (5) | NavTabs |
| `flow` | Bar chart / layout (1) | NavTabs |
| `context` | Clipboard with clipboard (2) | NavTabs |
| `sun` | Sun with rays (2) | Header theme toggle |
| `moon` | Crescent moon (1) | Header theme toggle |
| `grid` | Expand / crosshairs (8) | SetupWizard welcome |
| `star` | 5-pointed star (1) | Template "Ágil" |
| `list-three` | Three horizontal lines (3) | Template "Kanban" |
| `cross` | Cross with arrows (6) | Template "Padrão" |
| `settings` | Gear with inner circle (2) | Template "Personalizar" |
| `plus` | Plus sign (2) | Specs "Nova" button |
| `trash` | Trash can with lid (5) | Specs delete button |
| `check` | Checkmark (1) | Validation success |
| `edit` | Pencil (2) | Specs edit button |
| `search` | Magnifying glass (2) | Specs search input |
| `info` | Circled-i (3) | HomeView tooltips |
| `chevron-left` | Left chevron (1) | Navigation |
| `chevron-right` | Right chevron (1) | Navigation |
| `arrow-up` | Up arrow (2) | Misc |
| `x` | Close / X mark (2) | SpecsView filter (errors) |
| `alert-triangle` | Warning triangle (3) | SpecsView filter (warnings) |

## Package

Components now live in **`@letra/ui`** (`packages/ui/`) — a shared workspace package importable by any app.

```
import { Button, Badge, Card, Checkbox, Icon } from "@letra/ui";
// CSS tokens (if not using Tailwind):
import "@letra/ui/styles";
```

## Components

### Button

```tsx
<Button variant="default" size="sm" onClick={handleClick}>Salvar</Button>
```

**Variants:** `default`, `secondary`, `outline`, `ghost`
**Sizes:** `sm` (xs), `default` (sm), `lg` (base)

### Badge

```tsx
<Badge variant="success">healthy</Badge>
<Badge variant="warning">3 stale</Badge>
```

**Variants:** `default`, `secondary`, `outline`, `success`, `warning`

### Card

```tsx
<Card className="hover:shadow-md hover:-translate-y-0.5">
  <CardContent>...</CardContent>
</Card>
```

### Input / Textarea / Checkbox

```tsx
<Input placeholder="Buscar..." aria-label="Buscar" />
<Textarea value={content} onChange={fn} spellCheck={false} />
<Checkbox checked={true} label="Accept" onChange={fn} />
```

### Icon

```tsx
<Icon name="flow" size={20} className="text-primary" />
```

29 icons: home, specs, flow, context, sun, moon, grid, plus, trash, check, edit, search, info, chevron-left, chevron-right, arrow-up, star, list-three, settings, cross, x, alert-triangle, user, x-circle, check-circle, alert-circle, help, bar-chart, code

### Dialog / ConfirmDialog / PromptDialog

```tsx
<ConfirmDialog open={show} onClose={fn} onConfirm={fn} title="Excluir" variant="danger" />
<PromptDialog open={show} onClose={fn} onSubmit={fn} title="Add" label="Name" />
```

Use **instead of** `window.confirm` / `window.prompt`.

### Tabs

Reusable tab navigation — renders `role="tablist"` with panels via render prop.

```tsx
<Tabs tabs={[{id:"a",label:"A"},{id:"b",label:"B"}]}>
  {(id) => <div>Panel {id}</div>}
</Tabs>
```

### Progress

```tsx
<Progress value={3} max={5} label="Tasks" />
```

### EmptyState

```tsx
<EmptyState title="No items" description="Create one" action={<Button>New</Button>} />
```

### Alert

```tsx
<Alert variant="error" title="Error">Something went wrong</Alert>
```

Variants: `info`, `success`, `warning`, `error`

### Tooltip

```tsx
<Tooltip content="Help text" position="top"><Button>Hover</Button></Tooltip>
```

### Avatar

```tsx
<Avatar name="John Doe" size="md" />
<Avatar src="/photo.jpg" size="lg" />
```

### Skeleton / Toast

```tsx
<Skeleton className="h-8 w-12" />
<SkeletonCard />
const { toast } = useToast();
toast("Spec salva", "success");
```

## Micro-interactions

| Element | Effect |
|---|---|
| Cards (metric, pipeline, spec) | `hover:shadow-md hover:-translate-y-0.5 hover:border-primary/30` |
| NavTabs | `hover:bg-muted/50`, active: `bg-primary/10 text-primary` |
| Buttons | `hover:opacity-90`, `focus:ring-2 ring-primary/30` |
| Spec list items | `hover:bg-muted/50`, `focus-visible:ring-2 ring-primary/30` |
| Context tab buttons | `hover:bg-muted/50`, `focus-visible:ring-2 ring-primary/30` |
| Tab content | `animate-fade-in` on `<main>` wrapper |
| Badge "live" | `animate-pulse-live` (pulsing green glow, 2s) |
| Toast | `animate-slide-in-right` (slides in from right, 300ms) |

## Accessibility (WCAG 2.2 AA)

- **Focus visible:** All interactive elements have `focus-visible:ring-2 ring-primary/30`
- **ARIA labels:** Inputs without visible `<label>` use `aria-label`
- **Roles:** NavTabs uses `role="tablist"`, context tabs use `role="tab" aria-selected`
- **aria-hidden:** All `<Icon>` elements have `aria-hidden="true"` (decorative)
- **Reduced motion:** `prefers-reduced-motion: reduce` disables all animations
- **Color contrast:** OKLCH tokens maintain 4.5:1 minimum contrast ratio

## Animations

Defined in `index.css`:

- `animate-fade-in` — content panels (200ms, translateY 4px)
- `animate-slide-in-right` — toast notifications (300ms, translateX 100%)
- `animate-pulse-live` — "live" badge (2s, glowing box-shadow)

All gated by `@media (prefers-reduced-motion: reduce)`.
