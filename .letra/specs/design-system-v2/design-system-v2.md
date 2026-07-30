# Design System v2 — Tokens, Radius e Componentes Base

Aplicar a identidade visual oficial do Letra na biblioteca `@letra/ui`, tornando os tokens canônicos, padronizando border radius e redesenhando os componentes base sem perder compatibilidade com shadcn/base-ui.

## Contexto

Hoje o `packages/ui` é um esqueleto funcional com tokens genéricos e componentes base variantes mínimas (Button default/secondary/outline/ghost, Badge limitado, Card sem anatomia, Icon set defasado). A identidade real está em `design-system/ds-v2/design-system.md` e não é seguida consistentemente pelo código.

## Objetivo

Tornar `@letra/ui` a implementação canônica do DS v2 do Letra, servindo tanto para consumo web quanto como catálogo/caniuse para agentes de IA.

## Escopo

- `packages/ui/src/index.css`
- Tokens: cor, tipografia, motion, radius, shadows
- Componentes base reescritos: Button, Badge, Card, Input/Textarea/Label, Avatar, Progress, Dialog/ConfirmDialog/PromptDialog, Toast, Drawer, Sheet, Command, Dropdown, Popover, Tooltip, EmptyState, Icon, Alert, ErrorBanner, Separator, ScrollArea, RadioGroup, Switch, Table, Tabs, Accordion, Collapsible, Skeleton, NavigationMenu
- Docs: Ladle stories mínimas por componente

## Fora do Escopo

- Padrões de composição de produto (Sidebar produto, Kanban produto, GateCard produto, Marching Border, ValidatingBar, ActivityTimeline, Search) — backlog separado.
- Catálogo JSON para agentes — backlog separado.
- Componentes novos fora da base atual.

## Premissas

- Stack mantida: React 19, Tailwind v4, `@base-ui/react`, `lucide-react`.
- Tokens são CSS vars em `index.css`.
- `cn()` + `tailwind-merge` continua como utilitário.

## Restrições

- Não remover exports públicos de `index.ts`.
- Não quebrar consumo existente sem migração guiada.
- Não hardcodar cores hexadecimais em componentes; usar tokens.

## Critérios de Aceitação

### AC1 — Tokens canônicos carregam sem conflito
Dado `packages/ui` buildado/rodando
Quando o app aplica classe `bg-[var(--color-primary)]`
Então renderiza com cor oficial `#FFB800` em dark e light.

### AC2 — Tipografia segue DS v2
Dado qualquer componente com `text-display`, `text-h1`, `text-body`, `text-mono`
Quando renderizado
Então respeita famílias/pesos/tamanhos definidos e Mono aparece só em conteúdo técnico.

### AC3 — Motion canônico
Dado hover/focus de Button, Dialog, Drawer, Sheet, Toast
Quando transição acontece
Então usa `duration-fast/ease-standard` em superfície pequena e `280–320ms` em drawers/modais.

### AC4 — Border radius <= 5px por padrão
Dado snapshot visual dos componentes base do DS
Quando medido o border-radius
Então nenhum componente base usa valores acima de `5px`, exceto pills (`--radius-full`) justificados pelo domínio.

### AC5 — Button e Badge estão alinhados ao DS
Dado Button e Badge
Quando varridas variantes e tokens
Então implementam variantes oficiais e não usam cor mágica hardcoded.

### AC6 — Icon usa mapeamento oficial
Dado `Icon` e uso em componentes base
Quando verificado mapeamento
Então cobre pelo menos os ícones de domínio listados no DS v2 e respeita `stroke-width` padrão.

### AC7 — Build e stories saudáveis
Dado `packages/ui`
Quando executar `npm run build` e `npm run storybook`
Então build sem erro e stories carregam variantes principais.

### AC8 — Regressividade mínima
Dado consumo atual de `Button`, `Badge`, `Card`
Quando atualizar `@letra/ui`
Então tipos públicos preservados ou com breaking documentado em NOTES.

## Riscos

| Risco | Mitigação |
|---|---|
| Breaking em consumo atual | Manter aliases/variações compat enquanto converte; release minor quando possível. |
| Falta de aderência de agentes ao DS | Catálogo posterior; por enquanto docs + examples nas stories. |

## Decisões

- Manter `@base-ui/react` como base de comportamento acessível.
- `lucide-react` permanece biblioteca oficial; `Icon` continua como wrapper/domínio.
- Tokens em `index.css` são a única fonte de verdade; `utils.ts` não cresce.

## Tarefas

1. Aplicar tokens canônicos em `index.css`.
2. Revisar e corrigir componentes que violarem radius/tokens.
3. Reescrever Button e Badge.
4. Atualizar Icon/DomainIconSet.
5. Ajustar Card/Dialog/Sheet/Drawer/Toast/Command/Dropdown/Popover/Tooltip/Input/Textarea/Avatar/Progress/Alert/ErrorBanner/Separator/ScrollArea/RadioGroup/Switch/Table/Tabs/Accordion/Collapsible/NavigationMenu/Skeleton.
6. Revisar Ladle stories.
7. Rodar build + typecheck.

## Notas

- Esta spec substitui work ad-hoc anterior; mudanças de escopo devem gerar ADR.
- Próxima fase: catálogo JSON + padrões de composição.
