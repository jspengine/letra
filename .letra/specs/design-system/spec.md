# Spec: Design System

## Outcome

Design system consistente e documentado para o Letra Flow UI, com tokens de design, componentes primitivos, e diretrizes visuais que garantem coerência entre telas e facilitam a manutenção.

## Constraints

- **Zero runtime dependencies** — CSS variables + Tailwind v4 apenas
- **OKLCH como espaço de cor** — superior a HSL para consistência perceptual em dark/light
- **Dark & light mode** — todos os tokens devem ter variante escura
- **Acessibilidade** — contraste mínimo WCAG AA em ambos os temas
- **Inspiração shadcn/ui** — estrutura de tokens semelhante, componentes copiados não dependência
- **Mobile-ready** — breakpoints pensados para telas de 320px a 4K

## Exclusions

- Animação complexa (micro-interações, parallax, scroll mágico)
- Ícones customizados — usar inline SVGs ou biblioteca padrão (Lucide)
- Fontes customizadas — usar fontes do sistema (system-ui stack)
- Design system como pacote npm — só documentação + CSS + componentes

## Design Tokens

### 1. Cores — Paleta Base

A paleta usa OKLCH para garantir consistência perceptual entre temas.

```
PRIMÁRIA (Azul)
  Light: oklch(0.546 0.245 262.881)    → #4f7cff (aprox)
  Dark:  oklch(0.685 0.246 262.881)    → #8ab4ff (aprox)

  Uso: botões principais, links, indicadores ativos, foco

SECUNDÁRIA (Neutral)
  Light: oklch(0.922 0 0)              → #eaeaea
  Dark:  oklch(0.269 0 0)              → #3a3a3a

  Uso: badges secundários, backgrounds sutis

DESTAQUE (Âmbar — warning)
  Light: oklch(0.769 0.188 70.08)     → #f5a623
  Dark:  oklch(0.769 0.188 70.08)     → #f5a623 (igual)

  Uso: warnings, estágios "Em andamento", atenção

SUCESSO (Verde)
  Light: oklch(0.627 0.194 149.214)   → #34d399
  Dark:  oklch(0.627 0.194 149.214)   → #34d399 (igual)

  Uso: concluído, ACs aprovadas, badges "done"

ERRO (Vermelho)
  Light: oklch(0.577 0.245 27.325)    → #ef4444
  Dark:  oklch(0.577 0.245 27.325)    → #ef4444 (igual)

  Uso: erros, drift crítico, bloqueios
```

### 2. Cores — Tokens Semânticos

```
--background         Fundo geral da página
--foreground         Cor do texto principal
--card               Fundo de cards/superfícies elevadas
--card-foreground    Texto dentro de cards
--border             Cor de bordas padrão
--muted              Fundo de elementos muted/secundários
--muted-foreground   Texto secundário (labels, hints)
--primary            Cor de ação principal
--primary-foreground Texto sobre primary
--secondary          Fundo de ação secundária
--secondary-foreground Texto sobre secondary
--ring               Outline de foco / hover ring
--success            Verde semântico
--warning            Âmbar semântico
--error              Vermelho semântico
--info               Azul informativo
```

### 3. Tipografia

```
Font stack: system-ui, -apple-system, sans-serif
Mono stack: ui-monospace, SFMono-Regular, 'Cascadia Code', monospace

Escala (rem):
  xs:    0.75rem   (12px)  — labels, metadados
  sm:    0.875rem  (14px)  — body small, badges
  base:  1rem      (16px)  — body text
  lg:    1.125rem  (18px)  — headings small
  xl:    1.25rem   (20px)  — headings medium
  2xl:   1.5rem    (24px)  — headings large
  3xl:   1.875rem  (30px)  — page titles

Pesos:
  normal:   400  — body text
  medium:   500  — labels, botões
  semibold: 600  — subtítulos
  bold:     700  — títulos

Line height:
  tight:   1.2  — headings
  normal:  1.5  — body
  relaxed: 1.75 — descrições longas
```

### 4. Espaçamento

```
Escala base 4px (Tailwind padrão):
  0:   0px
  1:   0.25rem  (4px)
  2:   0.5rem   (8px)
  3:   0.75rem  (12px)
  4:   1rem     (16px)
  5:   1.25rem  (20px)
  6:   1.5rem   (24px)
  8:   2rem     (32px)
  10:  2.5rem   (40px)
  12:  3rem     (48px)
  16:  4rem     (64px)
```

### 5. Border Radius

```
none:   0px
sm:     0.375rem  (6px)
md:     0.5rem    (8px)
lg:     0.75rem   (12px)
xl:     1rem      (16px)
2xl:    1.5rem    (24px)
full:   9999px    (pill)
```

### 6. Sombras (modo light)

```
sm:     0 1px 2px 0 rgb(0 0 0 / 0.05)
md:     0 4px 6px -1px rgb(0 0 0 / 0.1)
lg:     0 10px 15px -3px rgb(0 0 0 / 0.1)
xl:     0 20px 25px -5px rgb(0 0 0 / 0.1)
```

Dark mode: mesmas sombras com opacidade reduzida (rgb(0 0 0 / 0.15) → 0.25).

### 7. Transições

```
default: 150ms ease
fast:    100ms ease
slow:    300ms ease
```

## Component Architecture

### Primitivos (já existentes)

```
Button    → variants: default, secondary, outline, ghost, link
          → sizes: sm, md, lg, icon

Card      → subcomponentes: CardHeader, CardTitle, CardDescription, CardContent
          → prop: noBorder (para uso em kanban)

Badge     → variants: default, secondary, outline, success, warning, error
```

### A adicionar

```
Typography
  → Heading (h1-h6 com escala de tokens)
  → Text (com variant: p, lead, muted, small, code)
  → List (ul/ol estilizados)

Form
  → Input (com estados: default, focus, error, disabled)
  → Select (dropdown estilizado)
  → Checkbox (toggle check)
  → Label

Navigation
  → Tabs (abas de navegação horizontal)
  → Breadcrumb (navegação hierárquica)

Feedback
  → Alert (variants: info, success, warning, error)
  → Toast (notificação temporária)
  → Skeleton (loading placeholder)

Layout
  → Container (max-width constraint)
  → Stack (flex gap vertical/horizontal)
  → Grid (CSS grid wrapper)
```

## Layout & Grid

### App shell

```
┌──────────────────────────────────────────────────┐
│  Header    · 56px                                │
├──────────────────────────────────────────────────┤
│  Nav tabs  · 40px                                │
├──────────────────────────────────────────────────┤
│                                                    │
│  Content (flex-1, overflow-y-auto)                 │
│  ─ max-w-5xl mx-auto para telas largas            │
│  ─ padding: px-6 py-4 (24px/16px)                │
│                                                    │
└──────────────────────────────────────────────────┘
```

### Breakpoints

```
sm:   640px   — mobile landscape
md:   768px   — tablet
lg:   1024px  — desktop
xl:   1280px  — desktop wide
2xl:  1536px  — desktop ultra-wide
```

## Visual Style

### Bordas

- Default: `1px solid var(--border)`
- Cards sem borda em contexto de grid (kanban)
- Inputs: borda fina, foco com ring primary

### Elevação

- Superfície base: background puro
- Cards: shadow-sm + borda sutil
- Modais/dialogs: shadow-xl
- Elementos flutuantes (dropdowns): shadow-lg

### Ícones

- Inline SVGs nos componentes (sem dep externa)
- Tamanhos: 14px (inline), 16px (small), 20px (medium), 24px (large)
- Cor: currentColor (herda do texto ao redor)

## Acceptance Criteria

- [ ] CSS tokens documentados neste spec existem como variáveis reais em `index.css`
- [ ] Dark mode tem todas as variáveis com valores apropriados
- [ ] Componentes primitivos (Button, Card, Badge) refletem os tokens
- [ ] Tipografia usa apenas system-ui stack (sem fontes externas)
- [ ] Espaçamento segue escala 4px (Tailwind)
- [ ] Contraste mínimo WCAG AA em ambos os temas
- [ ] Shell de navegação segue o layout do app shell descrito
- [ ] Breakpoints responsivos funcionam de 320px a 4K
- [ ] Componentes existentes podem ser migrados um a um sem quebrar o todo

## Context

A escolha por OKLCH em vez de HSL é porque HSL não é perceptualmente uniforme — cores com mesma saturação lightness parecem diferentes em matizes distintos. OKLCH resolve isso. shadcn/ui migrou para OKLCH no Tailwind v4, o que reforça a decisão.

O design system é "shadcn-inspired" e não "shadcn-dependent" porque:
- Não usamos `npx shadcn` para gerar componentes
- Copiamos os patterns de tokens e estrutura, adaptando para o contexto do Letra
- Mantemos zero runtime dependencies
