## Acceptance Criteria

### Layer 1: Tokens Foundation

- [x] **AC1**: `packages/ui/src/index.css` — substituir `hue 262.881` (blue) por `hue ~65` (amber) em `--primary`, `--primary-foreground`, `--ring`, `--border-focus`, `--accent`, `--accent-foreground`, `--text-link`, `--info`. Manter estrutura OKLCH. Validar contraste WCAG AA 4.5:1.
- [ ] **AC2**: Gray scale expandida — adicionar `--surface-50` a `--surface-900` no `:root` e `.dark`, com variação suave de luminância OKLCH (~2% steps). Manter `--surface-1/2/3` como aliases para `--surface-900/800/700` (dark) e `--surface-50/100/200` (light).
- [x] **AC3**: Shadows tokens — adicionar `--shadow-sm`, `--shadow-md`, `--shadow-lg`, `--shadow-xl` no index.css usando valores OKLCH (substituir rgba por `oklch(0 0 0 / X)`).
- [x] **AC4**: Lucide stroke-width — configurar `lucide-react` com `strokeWidth={1.75}` globalmente via contexto ou prop padrão.

### Layer 2: Typography

- [x] **AC5**: Font-face — adicionar `Inter` (body) e `JetBrains Mono` (code) via `@fontsource/inter` e `@fontsource/jetbrains-mono` ou CDN preconnect. Criar tokens `--font-body: 'Inter', system-ui, sans-serif` e `--font-code: 'JetBrains Mono', monospace`. Aplicar `--font-body` no `<body>` e `--font-code` em `<code>`, `<pre>`, `.markdown-code`.

### Layer 3: Dark Mode

- [x] **AC6**: Dark mode first — `<html>` deve começar com classe `.dark` por padrão. Toggle continua funcionando, mas o estado inicial é dark. Persistir preferência do usuário em `localStorage`. Se o sistema do usuário preferir `prefers-color-scheme: light`, usar light como fallback.

### Layer 4: UI States

- [x] **AC7**: Validating state — componente `<ValidatingBar>`: barra horizontal fina (3px) no topo do header com animação de progresso indeterminate (amber gradient sweep, duração 1.5s, ease-in-out). Visível durante chamadas POST /api/validate, POST /api/diagnostics/scan, POST /api/sitrep.
- [x] **AC8**: Drift state — utilitário CSS `.drift-blink`: animação `@keyframes drift-pulse` alternando opacidade 1 → 0.4 → 1 (1s, ease). Aplicado em ícone amber ao lado de items/specs com drift detectado.
- [x] **AC9**: Empty states — componente `<EmptyState>` com ilustração SVG geométrica minimalista (linhas finas, estilo "pitagórico"), título (`string`), descrição (`string`), slot `actions` (ReactNode). Usar em Kanban (sem items), Specs (sem specs), Context (sem decisões), Dashboard (sem dados).
- [x] **AC10**: Error state — componente `<ErrorBanner>`: fundo `var(--error)` a 10% opacidade, borda `var(--error)`, texto `var(--error)` escuro (light mode) / claro (dark mode). Botão "Tentar novamente" opcional. Altura colapsável (accordion) para detalhes técnicos.

### Layer 5: Component Polish

- [x] **AC11**: Button loading — adicionar prop `loading?: boolean` no `@letra/ui Button`. Quando `true`: exibir `<Loader2>` spinner (animação rotate), desabilitar clique, mostrar texto opaco a 70%.
- [x] **AC12**: Input focus glow — no `@letra/ui Input`: quando `:focus-visible`, borda `var(--primary)` + `box-shadow: 0 0 0 2px var(--primary)` a 20% opacidade. Transição 150ms ease.
- [x] **AC13**: KanbanCard drag animation — ao iniciar drag: `opacity: 0.7`, `scale: 1.02`, `box-shadow: var(--shadow-md)` com transição 200ms ease. Drop zone: `border: 2px dashed var(--primary)` a 30% opacidade.

### Layer 6: Accessibility & Responsiveness

- [ ] **AC14**: WCAG 2.2 AA audit — verificar todas as páginas (Home, Specs, Flow, Context) com axe DevTools ou ferramenta equivalente. Corrigir: foco visível (`:focus-visible` outline 2px `var(--primary)`), navegação por Tab em Kanban, `aria-live="polite"` em SSE updates, `alt` text em avatares/ícones decorativos, contraste de cor >= 4.5:1 para texto normal. Responsivo: 3 breakpoints (>=1280px 3 painéis, 768-1279px sidebar colapsada, <768px hamburger + coluna única).
