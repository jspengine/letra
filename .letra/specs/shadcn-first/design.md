# Design - Shadcn First e Identidade LDL

**Spec**: `shadcn-first`
**Item**: `ITEM-57`
**Date**: 2026-06-30
**Status**: Draft - aguardando aprovação humana

---

## Objetivo

Consolidar `@letra/ui` como fonte canônica dos primitives visuais e aplicar o
Letra Design Language (LDL) sem transformar a migração em uma troca mecânica
de componentes.

O resultado deve preservar a identidade definida pelo `ITEM-26`:

- amber como acento operacional
- slate como base de superfície
- Sora para marca e títulos, Inter para interface e JetBrains Mono para código
- dark mode primário
- movimento curto, funcional e supervisionável
- estados sempre comunicados por cor, ícone e texto

## Autoridade Visual

A ordem de autoridade para decisões de interface será:

1. `brand/brand-book.md`
2. `design-system/tokens/semantic-map.md`
3. `design-system/tokens/scale.md`
4. `design-system/states.md`
5. `design-system/screens/*.md`
6. primitives de `@letra/ui`
7. composição específica da aplicação

Componentes shadcn fornecem comportamento e acessibilidade. Eles não definem a
identidade do Letra; a aparência continua derivada dos tokens LDL.

## Baseline Real

A auditoria de 2026-06-30 encontrou:

| Elemento cru | Ocorrências | Classificação |
|---|---:|---|
| `<input>` | 1 | aplicação: `PersonalizationWizard.tsx` |
| `<button>` | 1 | implementação interna do primitive Sidebar |
| `<table>` | 2 | primitive Table e renderer Markdown |
| `<select>` | 0 | nenhuma |
| `<textarea>` | 0 | nenhuma |
| `<dialog>` | 0 | nenhuma |
| `<details>` | 0 | nenhuma |

Portanto, as estimativas históricas de dezenas de elementos crus não
representam mais o código atual.

Ainda existem duas árvores de primitives:

- `packages/ui/src`: pacote canônico `@letra/ui`
- `packages/client/src/components/ui`: primitives locais e componentes de
  domínio

Os componentes de domínio `DocumentEditor`, `DocumentView`, `Markdown`,
`MarkdownView` e `RulerHeader` permanecem locais conforme as exclusões da spec.

## Decisões

### 1. Promoção, não duplicação

Primitives genéricos locais serão promovidos para `@letra/ui` antes da troca de
imports. O arquivo local somente será removido quando nenhum consumidor
permanecer.

Primitives a promover:

- Table
- Collapsible
- Accordion
- RadioGroup
- Switch
- Label
- NavigationMenu
- Drawer
- Command

### 2. Sidebar é composição de aplicação

O `sidebar.tsx` local usa primitives shadcn internamente, mas representa uma
composição completa de navegação. Ele pode permanecer local nesta fase.
Button, Input, Separator, Sheet, Skeleton e Tooltip usados por ele devem vir de
`@letra/ui`.

### 3. Raw HTML dentro de primitives é permitido

Um primitive Table necessariamente renderiza `<table>`. Um Button renderiza
`<button>`. A proibição da constitution se aplica às superfícies de produto,
não à implementação interna acessível dos primitives.

### 4. Grid para estrutura; flex para alinhamento

CSS Grid será usado para estrutura de página, painéis e regiões principais.
Flex continua permitido para alinhamento interno de ícones, labels e ações.
Esta interpretação evita substituir usos corretos de flex sem ganho de UX.

### 5. Migração incremental

Cada lote deve compilar e manter a interface utilizável. Não haverá remoção em
massa da árvore local antes da migração dos consumidores.

## Sequência de Implementação

### Lote 1 - Fundação canônica

Escopo:

- adicionar e exportar os primitives ausentes em `@letra/ui`
- alinhar seus tokens ao LDL
- adicionar testes mínimos de renderização e acessibilidade

ACs: AC1.

### Lote 2 - Reuso já implementado

Escopo:

- mover Table, Collapsible, Accordion, RadioGroup, Switch e Label para
  `@letra/ui`
- migrar imports em AuditLogView, ItemDetailModal e AgentDetail
- manter componentes de domínio locais

ACs: AC4, AC10, AC11 e parte de AC12.

### Lote 3 - Formulários e navegação

Escopo:

- substituir o input cru de `PersonalizationWizard`
- confirmar que DocumentEditor usa Textarea canônico
- migrar Sidebar, NavTabs, DiagnosticsIndicator e confirmações
- eliminar Toast duplicado

ACs: AC7-AC9, AC12-AC19.

### Lote 4 - Estrutura visual

Escopo:

- migrar a estrutura principal de App para Grid
- usar Card e CardContent nos resumos de FlowView
- preservar breakpoints e comportamento mobile do Sidebar

ACs: AC20 e AC21.

### Lote 5 - Evidência e limpeza

Escopo:

- remover primitives locais sem consumidores
- executar testes, typecheck e build
- auditar teclado, foco, nomes acessíveis e contraste
- atualizar o relatório de migração com contagens finais

ACs: AC22 e AC23.

## Critérios de Não Regressão

- nenhuma tela perde operação por teclado
- Dialog, Sheet, Popover e Dropdown preservam focus trap e retorno de foco
- nenhuma superfície de produto introduz elemento interativo cru
- contraste de texto normal permanece em pelo menos 4.5:1
- dark e light mode permanecem funcionais
- desktop, tablet e mobile preservam acesso às ações principais
- `npm -w packages/client test` e `npm run build` permanecem verdes

## Gate Humano

Antes de mover `ITEM-57` para Code, a aprovação deve confirmar:

- LDL como identidade visual do produto
- promoção gradual dos primitives para `@letra/ui`
- permanência dos componentes específicos de domínio no cliente
- Grid apenas para estrutura, sem proibir flex em alinhamentos internos
- execução em cinco lotes verificáveis

