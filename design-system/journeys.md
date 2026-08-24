# Jornadas UX — AC6

> Atualizado: 2026-06-29
> 4 jornadas principais do Letra: Onboarding, Item em andamento, Gate pendente, Erro crítico.
> Fluxo de telas e transições.

---

## Princípios de jornada

1. **Agente primeiro** — o valor está na visibilidade do que os agentes estão fazendo
2. **Visibilidade de agência** — o usuário sempre sabe qual agente fez o quê
3. **Sem automação silenciosa** — toda ação de IA é visível e reversível
4. **Usuário supervisiona** — gates humanos são obrigatórios em momentos críticos

---

## Jornada 1: Onboarding

**Trigger**: Usuário acessa o Letra pela primeira vez (sem workflow configurado)

```
[Sistema sem workflow]                               [Setup Wizard]
      │                                                     │
      ├─ EmptyState: "Nenhum workflow configurado"          │
      │   CTA: "Configurar agora" ──────────────────────────┤
      │                                                     │
      └─ Sidebar: nenhum workspace ativo                    │
          CTA: "Criar workspace" ───────────────────────────┤
                                                            │
                                                    ┌───────┴───────┐
                                                    │  Step 1: Nome │
                                                    │  Step 2: Pastas│
                                                    │  Step 3: Tools │
                                                    │  Step 4: Review│
                                                    └───────┬───────┘
                                                            │
                                                    [Workflow criado]
                                                            │
                                                    ┌───────┴───────┐
                                                    │  Header: nome  │
                                                    │  NavTabs ativo  │
                                                    │  Flow vazio     │
                                                    │  CTA: "Adicionar│
                                                    │  primeiro item" │
                                                    └────────────────┘
```

### Telas envolvidas
1. `HomeView` (empty state, sem workflow)
2. `Sidebar` (sem workspace)
3. `InlineSetupWizard` / `PersonalizationWizard`
4. `FlowView` (workflow criado, sem itens)

### Transições
- EmptyState CTA → `InlineSetupWizard` (slide-up, 300ms)
- Setup completo → `FlowView` (fade-in, 180ms)
- Erro no setup → `ErrorBanner` inline (fade-in, 180ms)
- `PersonalizationWizard` → `InlineSetupWizard` (slide, 240ms)

### Estados
- **Loading**: SkeletonPipeline no wizard
- **Empty**: Home sem workflow → EmptyState + CTA
- **Success**: Workflow criado → redirect + toast
- **Error**: Falha na criação → ErrorBanner com retry

---

## Jornada 2: Item em Andamento

**Trigger**: Usuário seleciona um item no kanban para trabalhar

```
[Kanban / Flow View]                              [Item Detail Modal]
      │                                                    │
      ├─ Card no kanban                                    │
      │   slug | agente | progresso | dias                 │
      │   Clique ──────────────────────────────────────────┤
      │                                                    │
      ├─ Flow: Pipeline visual + timeline                  │
      │   Item no estágio corrente                         │
      │                                                    │
      └─ Mission Control: Executive Summary                │
          Cards de métrica                                  │
                                                            │
                                                    ┌───────┴───────┐
                                                    │  Header: slug  │
                                                    │  Badge: tipo   │
                                                    │  Badge: estágio│
                                                    │  Descrição     │
                                                    │  Spec + ACs    │
                                                    │  Timeline      │
                                                    │  Mover estágio │
                                                    └───────┬───────┘
                                                            │
                                              [Clique "Mover" → confirma]
                                                            │
                                                    ┌───────┴───────┐
                                                    │  Toast: "Item  │
                                                    │  movido para   │
                                                    │  [estágio]"    │
                                                    │  Kanban atualiza│
                                                    └────────────────┘
```

### Telas envolvidas
1. `KanbanView` (board de itens)
2. `FlowView` (Mission Control + KanbanBoard + Timeline)
3. `ItemDetailModal`
4. `Toast` (feedback de mover)

### Transições
- Card click → `ItemDetailModal` (modal-enter, 200ms)
- Mover estágio → confirmação → `Toast` (slide-in-right, 300ms)
- Mudança de estágio → kanban re-render (sem animação extra)
- ItemDetail fechar → fade-out (150ms)

### Estados
- **Loading**: SkeletonCard no kanban
- **Empty**: Nenhum item no estágio → coluna vazia
- **Success**: Item movido → toast + kanban atualizado
- **Error**: Falha ao mover → ErrorBanner + item permanece
- **Claim ativo**: `MarchingBorder` animada (dash-march, 0.4s)

---

## Jornada 3: Gate Pendente

**Trigger**: Item chega em um estágio que requer aprovação humana (gate)

```
[Kanban / Flow View]
      │
      ├─ Coluna do gate: card com pulse âmbar
      │   Badge: "Aguardando aprovação"
      │   CTA: "Revisar" / "Aprovar" / "Solicitar alterações"
      │
      ├─ Flow: pipeline visual
      │   Gate stage com pulse animation
      │   Label: "Aguardando humano"
      │
      └─ Home: GateCard
          Pulse animation
          "Gate pendente — [feature]"
          CTA: "Aprovar"

[Aprovação individual]                    [Aprovação em lote]
      │                                           │
      ├─ ItemDetailModal                          ├─ FlowView header:
      │   Badge: "Gate"                            │   "N gates pendentes"
      │   Botões:                                  │   CTA: "Aprovar todos"
      │   ├─ "Aprovar"                             │
      │   ├─ "Solicitar alterações"                │
      │   └─ "Rejeitar"                            │
      │                                            │
      └──→ Confirma → Toast:                     └──→ Confirma → Toast:
          "Item aprovado"                              "N itens aprovados"
          Kanban atualiza                              Kanban atualiza
          Próximo estágio                              Gate badge atualiza
```

### Telas envolvidas
1. `KanbanView` (coluna com pulse)
2. `FlowView` (pipeline + gate column)
3. `HomeView` (GateCard)
4. `ItemDetailModal` (gate actions)
5. `Toast` (feedback)

### Transições
- Gate CTA → ConfirmDialog (modal-enter, 200ms)
- Aprovação → Toast + card move (fade, 180ms)
- Gate pulse: `animate-human-pulse` (2s, ease-in-out)
- Gate urgente: `animate-pulse-gate-urgent` (1s)

### Estados
- **Gate waiting**: Pulse âmbar, `--gate-waiting`, CTA "Revisar"
- **Gate available**: Pulse verde, `--gate-available`, CTA "Aprovar"
- **Gate approved**: Check + `--gate-approved`, sumir do gate column
- **Gate blocked**: X + `--gate-blocked`, corred vermelho

### Acessibilidade
- Gate status: cor + label + ícone (nunca apenas cor)
- Pulse animation respeita `prefers-reduced-motion`

---

## Jornada 4: Erro Crítico

**Trigger**: Um agente falha, spec inválida, ou operação crítica não pode prosseguir

```
[Qualquer tela]
      │
      ├─ Toast de erro (top-right)
      │   Role: alert, aria-live: assertive
      │   Ícone: alert-circle
      │   Mensagem descritiva
      │   CTA: "Tentar novamente" / "Ver detalhes"
      │   Auto-dismiss: 8s (erro) / persistente (crítico)
      │
      ├─ ErrorBanner (inline no componente)
      │   Fundo: --surface-1
      │   Borda esquerda: --error (4px)
      │   Ícone: alert-circle
      │   Mensagem + detalhe técnico (code)
      │   CTA: retry action
      │
      ├─ DiagnosticsIndicator (header)
      │   Badge âmbar com contagem
      │   Dropdown: lista de sugestões
      │   "Aplicar correção" / "Ignorar"
      │
      └─ Health Record (dashboard)
          Alerta persistente
          Severidade: alta (red), média (amber), info (blue)
          Ações: Ack, Dismiss
```

### Telas envolvidas
1. `Toast` (notificação)
2. `ErrorBanner` (inline)
3. `DiagnosticsIndicator` (header badge)
4. `HealthRecord` (dashboard)
5. Qualquer view com falha

### Transições
- Toast → `animate-slide-in-right` (300ms)
- ErrorBanner → `animate-fade-in` (180ms)
- Diagnostics badge → aparece com fade (140ms)

### Estados
- **Loading**: Antes do erro — skeleton
- **Error**: Banner/toast + descrição + ação de recovery
- **Recovery**: "Tentar novamente" → re-tenta operação
- **Dismiss**: Usuário ignora → alerta vai para "ciente"

### Cores por severidade
- **Crítico**: `--error` (red), role alert, persistente
- **Médio**: `--warning` (amber), badge, dismissível
- **Info**: `--info` (blue), badge, automaticamente resolvível

---

## Mapa de transições entre telas

```
                    ┌─────────────┐
                    │   HomeView  │◄────────┐
                    └──────┬──────┘         │
                           │                │
                    ┌──────┴──────┐         │
                    │  NavTabs    │         │
                    └──────┬──────┘         │
                           │                │
              ┌────────────┼────────────┐   │
              │            │            │   │
        ┌─────┴─────┐ ┌───┴───┐ ┌─────┴─────┐
        │ SpecsView │ │FlowView│ │ContextView│
        └─────┬─────┘ └───┬───┘ └─────┬─────┘
              │            │            │
              │       ┌────┴────┐       │
              │       │KanbanView│      │
              │       └────┬────┘       │
              │            │            │
              │       ┌────┴────┐       │
              │       │ItemDetail│      │
              │       │  Modal   │      │
              │       └────┬────┘       │
              │            │            │
              │       ┌────┴────┐       │
              │       │  Toast  │       │
              │       └─────────┘       │
              │                         │
        ┌─────┴─────┐         ┌────────┴────────┐
        │ LogSearch │         │ ExecutionView   │
        │ AuditLog  │         │ AgentDetail     │
        └───────────┘         └─────────────────┘
```

### Animações de transição
| Transição | Animação | Duração | Curva |
|---|---|---|---|
| Modal open | `modal-enter` (scale) | 200ms | `--motion-emphasis` |
| Panel slide | `slide-in-from-right` | 300ms | `ease-out` |
| Fade in | `fade-in` | 180ms | `--motion-emphasis` |
| Toast in | `slide-in-right` | 300ms | `--motion-emphasis` |
| Toast out | fade + translate | 240ms | `ease-in` |
| Tab switch | fade cross | 140ms | `ease-out` |
| Kanban scroll | native scroll | — | — |
