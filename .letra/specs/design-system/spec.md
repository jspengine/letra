# Spec: design-system

> Updated: 2026-06-22

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
