# Product Rebrand — Implementation Plan

**Base:** Architecture document at `decisions/product-rebrand-architecture.md`
**Spec:** `specs/product-rebrand/spec.md` (26 ACs)

---

## Sprint 1: Foundation (Navigation + Theme)

### Tasks

```
T-01 Sidebar collapsible
  └── 3 grupos: Workspace (🏠📦🤖⚙🧠), Execução (📋🎨📝📊🚀📈), Governança (📜⚙)
  └── Ícones Lucide, texto aparece/oculta no toggle
  └── NavItem ativo destacado (bg-primary/10 + text-primary)
  └── Badge de notificação em gates pendentes

T-02 TopBar
  └── Breadcrumb (Workspace > View atual)
  └── Workspace selector dropdown
  └── Notification bell com badge count
  └── User avatar (placeholder)

T-03 Theme swap (light first)
  └── Default: light mode (was dark)
  └── Dark mode via toggle no header
  └── CSS variables amber em light + dark

T-04 Amber palette
  └── primary → oklch(0.7 0.18 85)
  └── Gate tokens: --gate-waiting, --gate-available, --gate-approved, --gate-blocked
  └── Animações: pulse-gate-waiting, pulse-gate-urgent
```

**ACs cobertas:** AC1, AC2, AC3, AC21, AC22, AC23

---

## Sprint 2: Dashboard + Gate System

### Tasks

```
T-05 PipelineStatus component
  └── 9 StageNodes em linha (horizontal scroll em mobile)
  └── Estados: idle(○), running(▶), waiting(⏳), done(✅), failed(❌), blocked(⛔)
  └── Stage atual destacado com amber glow
  └── Conexões visuais entre stages

T-06 MetricCards
  └── 4 cards: Agents (total/online), Tasks (active/done), PRs (open/merged), Health (ok/warn)
  └── Skeleton loading state
  └── Click leva à view correspondente

T-07 GateCard (reusable component)
  └── Props: feature, stage, agent, timestamp, status, onApprove, onReject, onChanges
  └── Estados: waiting(⏳), available(🔴), approved(✅), changes-requested(✏️), rejected(⛔), expired(⏰)
  └── Available state: fundo vermelho sutil, pulse animation, 3 botões de ação
  └── DESTAQUE: "HUMAN APPROVAL REQUIRED" header em vermelho

T-08 GatePendingList no Dashboard
  └── Lista de cards de gate pendentes
  └── Ações inline: Approve / Request Changes / Reject
  └── Empty state: "Nenhum gate pendente"
```

**ACs cobertas:** AC4, AC5, AC6, AC7, AC8, AC9, AC10

---

## Sprint 3: Execution Flow

### Tasks

```
T-09 ExecutionView
  └── Pipeline vertical com 9 stages
  └── Stage atual com destaque e animação de entrada
  └── AgentBadge em cada stage (nome + status)
  └── Output/summary do agente em cada stage concluído

T-10 GateActions inline
  └── Botões Approve / Request Changes / Reject no stage de gate
  └── ConfirmDialog para Reject (motivo obrigatório)
  └── Toast de confirmação pós-ação

T-11 AgentThinking indicator
  └── Shimmer animation no stage running
  └── "Agent is working..." com dots animados
  └── Tempo decorrido desde o início

T-12 AgentDetail page
  └── AgentInfo: modelo, status, ferramentas, taxa de sucesso, tempo médio
  └── PromptEditor: textarea com system prompt
  └── RunHistory: tabela com últimas execuções
```

**ACs cobertas:** AC11, AC12, AC13, AC17, AC18

---

## Sprint 4: Kanban + Audit

### Tasks

```
T-13 KanbanBoard redesign
  └── 9 colunas em 2 linhas (4 superior + 5 inferior)
  └── StageColumn com header nome + contagem + cor
  └── ItemCard com title, slug, agent badge, time
  └── GateInline card nas colunas HumanRev

T-14 Drag & Drop
  └── Arrastar itens entre colunas
  └── Validação: gate stages não aceitam drop direto
  └── Drop em gate stage → abre confirmação

T-15 ActivityTimeline
  └── Feed lateral no board
  └── ActivityItem: timestamp, agent, action, target
  └── Auto-scroll para última activity

T-16 AuditLogView
  └── Tabela paginada (50 por página)
  └── Filtros: agent, action, date range
  └── Busca textual
  └── LogEntry: timestamp, actor, action, target, metadata
```

**ACs cobertas:** AC14, AC15, AC16, AC19, AC20

---

## Sprint 5: Estados + Onboarding

### Tasks

```
T-17 Loading states (todas as views)
  └── SkeletonPipeline, SkeletonCards, SkeletonTable
  └── Esqueletos correspondem ao layout real

T-18 Empty states
  └── Texto descritivo + ação primária
  └── Ilustração/ícone contextual
  └── "Nenhum workspace" → "[Criar Workspace]"

T-19 Error states
  └── Mensagem + botão Retry
  └── "Falha ao carregar. Verifique conexão."

T-20 Responsive adjustments
  └── Pipeline horizontal (scroll) em mobile
  └── Kanban: swipe entre colunas
  └── Sidebar: drawer overlay em mobile
```

**ACs cobertas:** AC24, AC25, AC26

---

## Dependências

```
Sprint 1 ──→ Sprint 2 ──→ Sprint 3
                    │               │
                    └──→ Sprint 4 ──┘
                            │
                            └──→ Sprint 5
```

- Sprint 3 depende do sistema de gates (Sprint 2)
- Sprint 4 depende dos componentes base (Sprint 1)
- Sprint 5 pode rodar paralelo a Sprint 3-4

## Estimativa

| Sprint | Tasks | Esforço estimado |
|--------|-------|-----------------|
| 1 | 4 tasks | 2-3 dias |
| 2 | 4 tasks | 2-3 dias |
| 3 | 4 tasks | 3-4 dias |
| 4 | 4 tasks | 2-3 dias |
| 5 | 4 tasks | 1-2 dias |
| **Total** | **20 tasks** | **10-15 dias** |
