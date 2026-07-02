# Token Scale — AC3

> Atualizado: 2026-06-29
> Base: brand manual (`brand/brand-book.md`, grid 8px) + Tailwind v4 conventions
> Define spacing, z-index, focus rings, motion e breakpoints do LDL.

---

## 1. Spacing Scale (base 4px)

Grid modular de 8px do símbolo da marca se traduz em escala base 4px para UI.

| Token | Valor | Uso típico |
|---|---|---|
| `--space-0` | `0px` | Sem espaçamento |
| `--space-1` | `4px` | Micro espaçamento interno |
| `--space-2` | `8px` | Padding compacto, gap entre elementos inline |
| `--space-3` | `12px` | Padding de inputs, labels |
| `--space-4` | `16px` | Padding padrão de cards |
| `--space-5` | `20px` | Gap entre seções em cards |
| `--space-6` | `24px` | Padding de painéis laterais |
| `--space-8` | `32px` | Margem entre seções da página |
| `--space-10` | `40px` | Seções maiores, hero |
| `--space-12` | `48px` | Espaçamento de página |
| `--space-16` | `64px` | Seções de template |

Correspondência Tailwind:
```
space-1  → p-1   (4px)
space-2  → p-2   (8px)
space-3  → p-3   (12px)
space-4  → p-4   (16px)
space-5  → p-5   (20px)
space-6  → p-6   (24px)
space-8  → p-8   (32px)
space-10 → p-10  (40px)
space-12 → p-12  (48px)
space-16 → p-16  (64px)
```

---

## 2. Z-Index Scale

| Token | Valor | Uso |
|---|---|---|
| `--z-base` | `1` | Elementos posicionados |
| `--z-dropdown` | `10` | Dropdowns, popovers |
| `--z-sticky` | `20` | Headers fixos |
| `--z-overlay` | `30` | Overlay de modais |
| `--z-modal` | `40` | Modais, sheets |
| `--z-toast` | `50` | Toasts, notificações |
| `--z-tooltip` | `60` | Tooltips |

---

## 3. Focus Ring

Focus ring único para todo o sistema.

```css
/* Padrão */
--focus-ring-width: 2px;
--focus-ring-offset: 2px;
--focus-ring-color: var(--brand-primary);

/* Aplicação */
:focus-visible {
  outline: var(--focus-ring-width) solid var(--focus-ring-color);
  outline-offset: var(--focus-ring-offset);
}
```

Regras:
- `:focus-visible` em vez de `:focus` para não poluir clique
- Cor âmbar (`--brand-primary`) para foco visível
- `2px` de espessura, `2px` de offset — legível sem sufocar o elemento

---

## 4. Motion & Animation

Extraído de `brand/motion.md`.

### Duração

| Token | Valor | Uso |
|---|---|---|
| `--motion-fast` | `140ms` | Hover, micro-interações |
| `--motion-base` | `180ms` | Focus ring, state transitions |
| `--motion-slow` | `280ms` | Progress, pipeline, panel slide |
| `--motion-emphasis` | `cubic-bezier(0.2, 0.8, 0.2, 1)` | Curva padrão |
| `--motion-ease-out` | `ease-out` | Entradas curtas |

### Animações do sistema

Validadas conforme brand book (execução, não espetáculo).

| Classe | Quando usar | Duração | Baseada em |
|---|---|---|---|
| `animate-fade-in` | Entrada de elementos | `var(--motion-base)` | brand: fade curto |
| `animate-slide-in-right` | Painéis laterais | `var(--motion-slow)` | brand: transição de painel |
| `animate-pulse-gate-waiting` | Gate humano pendente | `2s` | brand: nós pulsando |
| `animate-pulse-gate-urgent` | Gate pronto/urgente | `1s` | brand: highlight |
| `animate-agent-running` | Agente em execução | `1.5s` | brand: linha avançando |
| `animate-timeline-dot` | Timeline ativa | `2s` | brand: nós pulsando |
| `animate-human-pulse` | Aprovação humana | `2s` | brand: checkpoint |
| `animate-shimmer-slide` | Loading shimmer | `1.2s` | brand: feedback curto |
| `animate-slide-up` | Entrada de conteúdo | `0.3s` | brand: fade curto |
| `animate-agent-breathe` | Agente ocioso | `2s` | brand: nó sutil |
| `animate-progress-stripes` | Progresso indeterminado | `0.6s` | brand: progresso |
| `animate-validating-bar` | Validação em andamento | `1.5s` | brand: execução |
| `animate-drift-pulse` | Alerta de drift | `1s` | brand: sinal |
| `animate-dash-march` | Borda de claim ativo | `0.4s` | brand: handoff |

### O que evitar (do brand manual)
- Particles, neon pulsante, parallaxe decorativa, bounce excesso, flashes intensos

---

## 5. Breakpoints

| Nome | Largura mínima | Alvo |
|---|---|---|
| `--bp-sm` | `640px` | Mobile landscape |
| `--bp-md` | `768px` | Tablet |
| `--bp-lg` | `1024px` | Desktop compacto |
| `--bp-xl` | `1280px` | Desktop padrão |
| `--bp-2xl` | `1536px` | Desktop amplo |

Correspondência Tailwind v4:
```css
@theme {
  --breakpoint-sm: 640px;
  --breakpoint-md: 768px;
  --breakpoint-lg: 1024px;
  --breakpoint-xl: 1280px;
  --breakpoint-2xl: 1536px;
}
```

---

## 6. Border Radius

| Token | Valor | Uso |
|---|---|---|
| `--radius-sm` | `10px` | Inputs, botões compactos |
| `--radius-md` | `16px` | Cards, painéis |
| `--radius-lg` | `24px` | Modais, sheets |
| `--radius-full` | `9999px` | Badges, pills, avatares |
| `--radius-none` | `0px` | Elementos que precisam de quina reta |

---

## 7. Font Stacks

| Token | Famílias | Uso |
|---|---|---|
| `--font-brand` | `"Sora", "Inter", system-ui, sans-serif` | Headlines, branding |
| `--font-ui` | `"Inter", system-ui, sans-serif` | UI, corpo, documentação |
| `--font-mono` | `"JetBrains Mono", "SFMono-Regular", Consolas, monospace` | Código, logs, IDs |

### Hierarquia tipográfica

| Papel | Fonte | Peso | Tamanho | Line-height | Tracking |
|---|---|---|---|---|---|
| Display | Sora | 600 | clamp(3rem, 5vw, 4.5rem) | 1.1 | -0.02em |
| H1 | Sora | 600 | clamp(2rem, 3vw, 3rem) | 1.2 | -0.01em |
| H2 | Inter | 600 | clamp(1.5rem, 2vw, 2rem) | 1.3 | normal |
| H3 | Inter | 600 | 1.25rem | 1.4 | normal |
| Body | Inter | 400 | 1rem | 1.5 | normal |
| Small | Inter | 500 | 0.8125rem | 1.4 | normal |
| Caption | Inter | 500 | 0.75rem | 1.3 | normal |
| Mono | JetBrains Mono | 500 | 0.75rem–0.875rem | 1.4 | normal |
