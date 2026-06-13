# ADR: Design System — shadcn/ui + Dark/Light mode

**Data:** 2026-06-08
**Contexto:** ITEM-14 — SPA React, ITEM-13 — Flow Designer
**Status:** Aceita

## Decisão

Adotar **shadcn/ui** como base do design system do Flow UI, com suporte nativo a **dark e light mode**.

### Detalhes

- **shadcn/ui** não é uma dependência — é uma coleção de componentes copiáveis via CLI (`npx shadcn@latest add`). Isso significa:
  - Zero runtime dependencies além do React
  - Código 100% nosso pra customizar
  - Tema via CSS variables (dark/light nativo)
  - Acessibilidade (Radix UI under the hood)
- **Modo escuro**: toggle no header (🌙/☀️) + detecta `prefers-color-scheme` no load
- **Persistência**: salva escolha no `localStorage`
- **Paleta**: `slate` como cor base (padrão shadcn), adaptada pra Letra (blue accent)

### Árvore de componentes importados do shadcn

```
button       → botões primário/secundário/ghost
card         → cards do dashboard/kanban
badge        → badges de stage
select       → dropdown de stage/move
dialog       → modal de spec/tasks/config
sheet        → side panel
dropdown-menu→ menu de ações
input        → formulários
label        → labels
separator    → separadores
toggle       → toggle dashboard/kanban
```

### Estrutura de tema

```css
:root {
  --background: 0 0% 100%;          /* light */
  --foreground: 222.2 84% 4.9%;
  --primary: 221.2 83.2% 53.3%;     /* blue accent */
  /* ... demais tokens shadcn padrão */
}

.dark {
  --background: 222.2 84% 4.9%;     /* dark */
  --foreground: 210 40% 98%;
  --primary: 217.2 91.2% 59.8%;
}
```

## Alternativas consideradas

| Alternativa | Motivo da rejeição |
|---|---|
| Material UI (MUI) | Bundle pesado, runtime theme provider, difícil customizar |
| Ant Design | Estilo corporativo forte, difícil desviar do visual chinês |
| Chakra UI | Dependência runtime, ecossistema menor que shadcn |
| Tailwind UI | Pago ($299), sem acessibilidade embutida |
| CSS puro + Tailwind | Zero atalho — tudo na mão, sem patterns consistentes |

## Consequências

**Positivas:**
- Tema dark/light grátis
- Componentes acessíveis (Radix UI)
- Código fonte próprio (customizável)
- Bundle enxuto (só o que importamos)
- Tailwind + CSS variables = tema consistente

**Negativas:**
- shadcn/ui muda com frequência (breaking changes menores)
- Precisa `npx shadcn` pra adicionar cada componente novo
- Time precisa conhecer Tailwind + Radix patterns

## Próximos passos

- ITEM-14: Setup do monorepo + Vite + Tailwind + shadcn init
- ITEM-21: Implementar theme toggle (dark/light) + persistência
- ITEM-22: Migrar UI atual para componentes shadcn
