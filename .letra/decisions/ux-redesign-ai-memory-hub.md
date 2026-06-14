# ADR: UX Redesign — Letra como AI Memory & Spec Hub

**Data:** 2026-06-13
**Contexto:** ITEM-13 — Flow Designer
**Status:** Proposta

## Problema

A web UI do Letra cresceu com 4 views concorrentes (Setup Wizard, Dashboard 3 zonas, Kanban, SidePanel) que disputam espaço sem hierarquia clara. O produto perdeu o foco: virou um kanban genérico em vez de reforçar seu diferencial — ser o hub de specs e contexto para agentes de IA.

## Decisão

Redesenhar o Letra Flow UI como **"AI Memory & Spec Hub"** — um painel que coloca specs e contexto do projeto em primeiro plano, com o fluxo de trabalho como view secundária.

### Princípios de design

| Princípio | Descrição |
|---|---|
| **Spec-first** | A home mostra saúde das specs, drift detection e foco atual — não colunas de kanban |
| **Flow como timeline** | Kanban vira toggle opcional; default é pipe horizontal simplificado |
| **3 abas máximas** | Home | Specs | Flow — cada aba com propósito único |
| **Detalhe inline** | Ao clicar em item, expande no lugar — sem side panel sobreposto |
| **Contexto acessível** | Aba dedicada pra ler context.md, constitution.md, decisões |
| **Setup pontual** | Wizard inline de 3 passos, não tela cheia |

### Arquitetura de telas

```
┌──────────────────────────────────────────────────────────────┐
│  Header: [logo] [projeto]                    [busca] [tema]  │
├──────────────────────────────────────────────────────────────┤
│  Nav:  [ Home ] [ Specs ] [ Flow ] [ Context ]               │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Área de conteúdo (varia por aba)                      │  │
│  │                                                        │  │
│  │  - Home: health check, specs recentes, flow resumo,    │  │
│  │         decisões recentes, métricas                    │  │
│  │  - Specs: lista + CRUD de specs (criar, editar,       │  │
│  │           marcar ACs, validar)                         │  │
│  │  - Flow: pipe visual (default) ou kanban (toggle),     │  │
│  │         detalhe inline ao clicar em item               │  │
│  │  - Context: visualizador markdown de context.md,       │  │
│  │         constitution.md, glossary.md, decisões         │  │
│  │                                                        │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Views detalhadas

#### 1. Home — Painel de saúde do projeto

```
┌──────────────────────────────────────────────────────────────┐
│  🏠  HOME                                                    │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐ │
│  │ ✅ SPECS      │  │ ⚠ DRIFT      │  │ 🎯 FOCO ATUAL     │ │
│  │ 23 válidas    │  │ 2 specs      │  │ "Implementar auth" │ │
│  │ 0 erros       │  │ sem revisão  │  │ ───────────────── │ │
│  │               │  │ há 8 dias    │  │ ITEM-3 · code      │ │
│  │ [ver todas]   │  │ [revisar]    │  │                    │ │
│  └──────────────┘  └──────────────┘  └────────────────────┘ │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  📋  SPECS RECENTES                                     │ │
│  │                                                         │ │
│  │  auth-flow .............. ✅ 100%  · atualizado ontem   │ │
│  │  api-endpoints .......... ✅ 100%  · atualizado ontem   │ │
│  │  dark-mode ............. ⚠  50%  · desatualizado 8d   │ │
│  │  notifications ......... ❌   0%  · rascunho           │ │
│  │                                                         │ │
│  │  [+ nova spec]  [ver todas →]                          │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────────┐ │
│  │ 📌 FLUXO    │  │ 🗂 DECISÕES  │  │ 📊 MÉTRICAS         │ │
│  │ backlog →   │  │ 13/jun:     │  │ Tempo médio/estágio  │ │
│  │ design →    │  │  Usar React │  │ backlog:   2.3d     │ │
│  │ code →      │  │ 12/jun:     │  │ design:    4.1d     │ │
│  │ review →    │  │  Mobile 1st │  │ code:      ---      │ │
│  │ done        │  │             │  │ bottleneck: design   │ │
│  │ [ver fluxo] │  │ [ver mais]  │  │                      │ │
│  └─────────────┘  └─────────────┘  └──────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

#### 2. Specs — Gerenciamento de especificações

```
┌──────────────────────────────────────────────────────────────┐
│  📋  SPECS                                          [+nova] │
│                                                              │
│  [Buscar specs...________________]  [Todas ✓] [⚠️] [❌]      │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  auth-flow          ✅ 100%  · 5 ACs · atualizado 1d   │ │
│  │  ├─ Implementar login OAuth                            │ │
│  │  ├─ Fluxo de refresh token                             │ │
│  │  └─ Proteção de rotas privadas                         │ │
│  ├─────────────────────────────────────────────────────────┤ │
│  │  api-endpoints      ✅ 100%  · 8 ACs · atualizado 2d   │ │
│  │  dark-mode          ⚠  50%  · 4 ACs · desatualizado 8d │ │
│  │  notifications      ❌   0%  · 3 ACs · rascunho        │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
│  Ao clicar, expande detalhe inline:                         │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  📄  auth-flow                                    [editar]│
│  │                                                         │ │
│  │  Outcome:                                               │ │
│  │  Usuário consegue fazer login com Google/GitHub e       │ │
│  │  manter sessão ativa por 7 dias.                        │ │
│  │                                                         │ │
│  │  Acceptance Criteria:                                   │ │
│  │  ☑ Login com Google retorna token JWT válido            │ │
│  │  ☑ Refresh token renova sem pedir senha                 │ │
│  │  ☑ Rotas privadas redirecionam para /login              │ │
│  │  ☑ Logout limpa cookies e redireciona                   │ │
│  │  ☑ Sessão expira após 7 dias de inatividade             │ │
│  │                                                         │ │
│  │  Tags: auth, security, frontend                         │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

#### 3. Flow — Pipe visual (default)

```
┌──────────────────────────────────────────────────────────────┐
│  📌  FLOW                               [pipe] [kanban]     │
│                                                              │
│  backlog          design           code           done       │
│  ┌──────┐        ┌──────┐        ┌──────┐       ┌──────┐   │
│  │ ITEM │        │      │        │ ITEM │       │ ITEM │   │
│  │  ● 3 │        │      │        │  ● 1 │       │  ● 2 │   │
│  │  ● 7 │───────▶│ ❁ 4 │───────▶│  ● 5 │      │  ● 6 │   │
│  │  ● 9 │        │      │        │      │       │      │   │
│  └──────┘        └──────┘        └──────┘       └──────┘   │
│    3 items         1 item         2 items        2 items    │
│                                                              │
│  ● = normal  ❁ = com foco (item selecionado)                │
│                                                              │
│  Ao clicar em item, expande detalhe inline:                  │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  ❁  ITEM-4  ·  Design  ·  "Criar protótipo UX"        │ │
│  │                                                         │ │
│  │  Tasks:  [████░░░░]  2/5                               │ │
│  │  ● Pesquisar concorrentes  (done)                      │ │
│  │  ● Definir user personas  (done)                       │ │
│  │  ○ Esboçar wireframes  ← você está aqui               │ │
│  │  ○ Validar com usuários                                │ │
│  │  ○ Refinar com base no feedback                        │ │
│  │                                                         │ │
│  │  Spec vinculada: auth-flow                             │ │
│  │  Criado: 10/jun · 3d em design                         │ │
│  │                                                         │ │
│  │  [mover → code]  [← mover backlog]                     │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

#### 4. Flow — Modo kanban (toggle)

```
┌──────────────────────────────────────────────────────────────┐
│  📌  FLOW                               [pipe] [kanban]     │
├──────────┬──────────┬──────────┬──────────┬─────────────────┤
│ BACKLOG  │ DESIGN   │  CODE    │ REVIEW   │  DONE           │
│          │          │          │          │                 │
│ ITEM-3   │ ITEM-4 ◀ │ ITEM-1   │          │  ITEM-2         │
│ ITEM-7   │          │ ITEM-5   │          │  ITEM-6         │
│ ITEM-9   │          │          │          │  ITEM-8         │
│          │          │          │          │                 │
├──────────┴──────────┴──────────┴──────────┴─────────────────┤
│                                                              │
│  Ao clicar em um item, expande inline abaixo do kanban:     │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  ❁  ITEM-4  ·  Design  ·  "Criar protótipo UX"     │   │
│  │  ────────────────────────────────────────────────── │   │
│  │  Tasks: [████░░░░] 2/5   ·  3d em design            │   │
│  │  [mover → code]  [← mover backlog]                  │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

#### 5. Context — Memória do projeto

```
┌──────────────────────────────────────────────────────────────┐
│  🗂  CONTEXT                                                  │
│                                                              │
│  [context.md]  [constitution.md]  [glossary.md]  [decisões]  │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  # Context                                              │ │
│  │                                                         │ │
│  │  > Updated: 2026-06-13                                  │ │
│  │  > Owner: letra-dev                                     │ │
│  │                                                         │ │
│  │  ## Intent                                              │ │
│  │                                                         │ │
│  │  Letra é um framework de Specification-Driven           │ │
│  │  Development (SDD)...                                   │ │
│  │                                                         │ │
│  │  [expandir]                                              │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  📜  DECISÕES RECENTES                                  │ │
│  │                                                         │ │
│  │  13/jun —  Adotar React em vez de Vue                  │ │
│  │            Motivo: ecossistema maior, mais devs         │ │
│  │                                                         │ │
│  │  12/jun —  Priorizar mobile primeiro                    │ │
│  │            Motivo: 70% dos usuários são mobile          │ │
│  │                                                         │ │
│  │  [ver todas as 12 decisões →]                           │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### Empty state (primeira execução)

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│                     ◉  letra                                  │
│                                                              │
│               Bem-vindo ao Letra                             │
│         Seu hub de specs e contexto para IA                 │
│                                                              │
│    ┌──────────────────┐  ┌──────────────────┐               │
│    │  🚀  Começar      │  │  📋  Templates   │               │
│    │  Configuração     │  │  Ver exemplos   │               │
│    │  guiada (3 passos)│  │  de projetos    │               │
│    └──────────────────┘  └──────────────────┘               │
│                                                              │
│    ┌─────────────────────────────────────────────────────┐   │
│    │  O que você pode fazer:                             │   │
│    │                                                     │   │
│    │  📝  Escrever specs para suas features              │   │
│    │  📌  Organizar o fluxo de trabalho                  │   │
│    │  🤖  Alimentar agentes de IA com contexto           │   │
│    │  📊  Acompanhar métricas e drift                    │   │
│    └─────────────────────────────────────────────────────┘   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Setup wizard inline (3 passos)

```
┌──────────────────────────────────────────────────────────────┐
│  Configuração guiada                      Passo 1/3         │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Qual o nome do seu projeto?                         │   │
│  │                                                      │   │
│  │  ┌────────────────────────────────────────────────┐  │   │
│  │  │  meu-projeto                                   │  │   │
│  │  └────────────────────────────────────────────────┘  │   │
│  │                                                      │   │
│  │  [continuar →]                                       │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  Passo 2/3 · Quais os estágios do seu fluxo?               │
│  Passo 3/3 · Quais ferramentas de IA você usa?             │
└──────────────────────────────────────────────────────────────┘
```

## Alternativas consideradas

| Alternativa | Motivo da rejeição |
|---|---|
| Kanban-first (atual) | Produto vira clone de Trello, perde identidade |
| Apenas CLI, sem UI | Exclui não-devs do público-alvo |
| Dashboard de métricas puro | Remove capacidade de interagir com specs/flow |

## Consequências

**Positivas:**
- Produto com identidade clara (specs + IA context, não kanban)
- Menos views = menos código = mais fácil manter
- Hierarquia clara do que é importante

**Negativas:**
- Requer reescrita significativa do App.tsx e navegação
- Perde a view "Dashboard 3 zonas" atual
- Usuários acostumados com kanban tradicional podem estranhar

## Próximos passos

1. Implementar shell de navegação (abas Home | Specs | Flow | Context)
2. Migrar Home para health check
3. Migrar Specs como view principal
4. Simplificar Flow com toggle pipe/kanban
5. Adicionar aba Context
6. Remover Setup Wizard tela cheia (substituir por inline)

## Referências

- Decisão anterior: `design-system-shadcn-dark-light.md`
- Decisão anterior: `spa-react-vite-flow-ui.md`
- Design system: `.letra/specs/design-system/spec.md`
