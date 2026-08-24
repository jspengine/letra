# NavTabs

**Arquivo**: `packages/client/src/components/NavTabs/NavTabs.tsx`
**Propósito**: Navegação principal entre as views (Home, Specs, Flow, Context, Logs).

## Layout
- Barra horizontal de tabs
- Ícone + label por tab
- Tab ativa com destaque âmbar (primary)
- Role tablist com a11y

## Elementos principais
- 5 tabs: Home, Specs, Flow, Context, Logs
- Active indicator (border-bottom + bg com opacidade)
- Ícones do `@letra/ui/Icon`

## Tokens usados
`--border`

## Conformidade LDL
- [x] Usa `Icon` de `@letra/ui`
- [x] Acento âmbar na tab ativa
- [x] Role tablist com aria-selected e aria-controls — acessível
- [ ] Classes Tailwind hardcoded (`bg-primary/10`, `text-muted-foreground`) — ideal seria tokens
- [ ] Tab Flow não aparece se não há workflow — lógica de exibição condicional
