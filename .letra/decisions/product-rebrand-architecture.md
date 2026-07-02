# Product Rebrand: AI-Native Software Delivery Workspace

**Data:** 2026-06-23
**Status:** Spec Draft
**Autores:** Product Design
**Contexto:** Revisão completa da arquitetura de produto do Letra para reposicioná-lo como plataforma de orquestração de desenvolvimento de software assistida por agentes de IA, com humanos como aprovadores estratégicos.

---

## 1. Arquitetura da Informação

### 1.1 Modelo Conceitual

```
Humano (aprovador estratégico) ──┐
                                  ├── LETRA ──→ Software Entregue
Agentes de IA (executores) ──────┘
```

### 1.2 Hierarquia de Informação

```
Workspace (solução)
  ├── Flow (ciclo SDLC ativo)
  │     ├── Discovery       ── agente: discovery-agent
  │     ├── Design          ── agente: design-agent
  │     ├── Specification   ── agente: spec-agent
  │     ├── Human Review    ── GATE 1 (humano)
  │     ├── Code            ── agente: code-agent
  │     ├── AI Review       ── agente: review-agent
  │     ├── Human Review    ── GATE 2 (humano)
  │     ├── PR              ── agente: pr-agent
  │     └── Done
  ├── Items (cards por estágio)
  ├── Specs (especificações)
  ├── Decisions (decisões)
  └── Audit Log (registro imutável)
```

### 1.3 Níveis de Abstração

| Nível | Artefato | Quem vê |
|-------|----------|---------|
| Estratégico | Dashboard, Health, Status | Humano |
| Tático | Kanban Board, Execution Flow | Humano + Agentes |
| Operacional | Specs, Code, Review, PR | Agentes |
| Auditável | Log completo | Compliance |

---

## 2. Sitemap

```
LETRA
│
├── Dashboard                          # Visão geral do fluxo de entrega
│   ├── Pipeline Status                # Discovery → ... → Done
│   ├── Metric Cards                   # Agents | Tasks | PRs | Health
│   ├── Human Gates Pending            # Cards de aprovação pendente
│   └── Recent Activity                # Timeline de execuções
│
├── WORKSPACE (sidebar grupo)
│
├── Projetos                          # Gestão de workspaces
│   ├── Lista de Workspaces
│   │   ├── Workspace Detail
│   │   │   ├── Overview
│   │   │   ├── Repositories
│   │   │   ├── Agents Configuration
│   │   │   └── Activity Log
│   │   └── Create Workspace Wizard
│
├── Agentes                           # Configuração de agentes
│   ├── Lista de Agentes
│   │   ├── Discovery Agent Detail
│   │   ├── Design Agent Detail
│   │   ├── Spec Agent Detail
│   │   ├── Code Agent Detail
│   │   ├── Review Agent Detail
│   │   └── PR Agent Detail
│   └── Agent Registry
│
├── Harness                           # Templates de workflow
│   ├── Flow Templates (SDLC, Kanban, Custom)
│   ├── Gate Definitions
│   └── Policy Rules
│
├── Conhecimento                      # Contexto do workspace
│   ├── Context
│   ├── Constitution
│   ├── Glossary
│   └── Decisions
│
├── EXECUÇÃO (sidebar grupo)
│
├── Discovery                         # Tela de Discovery Agent
├── Design                            # Tela de Design Agent
├── Specifications                    # Specs aprovadas
├── Quadro                            # Kanban Board SDLC
├── Pull Requests                     # PRs gerados
└── Monitoramento                     # Métricas + Health
│
├── GOVERNANÇA (sidebar grupo)
│
├── Auditoria                         # Log imutável de decisões
│   ├── Execution Log
│   ├── Approval History
│   └── Agent Outputs
│
└── Configurações                     # Gerais
    ├── Theme
    ├── Notifications
    ├── API Keys
    └── Team Members
```

---

## 3. Wireframes ASCII Completos

### 3.1 Layout Global

```
┌──────────────────────────────────────────────────────────────┐
│ [≡] LETRA           Workspace: Delivery SaaS    [🔔] [👤]   │
├────────┬─────────────────────────────────────────────────────┤
│        │                                                     │
│ 🏠 Dash│  ┌─────────────────────────────────────────────┐   │
│        │  │ Status: ▶ Em execução  •  3 agents ativos   │   │
│ 📦 Proj│  └─────────────────────────────────────────────┘   │
│ 🤖 Agen│                                                     │
│ ⚙ Harne│  ┌──────┬──────┬──────┬──────┐                     │
│ 🧠 Conh│  │Agents│Tasks │PRs   │Health│                     │
│        │  │  6   │  12  │  3   │  ✅  │                     │
│ 📋 Disc│  └──────┴──────┴──────┴──────┘                     │
│ 🎨 Desi│                                                     │
│ 📝 Spec│  ┌─────────────────────────────────────────────┐   │
│ 📊 Quad│  │ Pipeline:                          ⏳ 3/9   │   │
│ 🚀 PR  │  │ Discovery  ✓── Design  ✓── Spec  ✓──        │   │
│ 📈 Moni│  │ HumanRev  ⏳── Code  ○── AIRev  ○──         │   │
│        │  │ HumanRev2 ○── PR  ○── Done  ○──             │   │
│ 📜 Audi│  └─────────────────────────────────────────────┘   │
│ ⚙ Confi│                                                     │
│        │  ┌─────────────────────────────────────────────┐   │
│        │  │ ⛔ HUMAN APPROVAL REQUIRED (2)              │   │
│        │  │                                             │   │
│        │  │ ┌──────────────────────────────────────┐    │   │
│        │  │ │ Feature: User Authentication         │    │   │
│        │  │ │ Spec completed. Awaiting approval.   │    │   │
│        │  │ │ [Approve] [Request Changes]          │    │   │
│        │  │ └──────────────────────────────────────┘    │   │
│        │  └─────────────────────────────────────────────┘   │
└────────┴─────────────────────────────────────────────────────┘
```

### 3.2 Quadro (Kanban SDLC)

```
┌──────────────────────────────────────────────────────────────┐
│ [≡] LETRA           Quadro: Delivery SaaS                    │
├────────┬─────────────────────────────────────────────────────┤
│        │                                                     │
│ 🏠 Dash│  ┌──────────┬──────────┬──────────┬──────────┐     │
│        │  │ Discovery│  Design  │   Spec   │Human Rev │     │
│ 📦 Proj│  │ 🟢 3 it  │ 🟢 2 it  │ 🟡 4 it  │ 🔴 1 it  │     │
│ 🤖 Agen│  ├──────────┼──────────┼──────────┼──────────┤     │
│ ⚙ Harne│  │ Item A   │          │          │          │     │
│ 🧠 Conh│  │ ┌────────┴──────────┴──────────┴────────┐ │     │
│        │  │ │ ⛔ GATE: Human Approval Required       │ │     │
│ 📋 Disc│  │ │ "User Auth" - [Approve] [Changes]     │ │     │
│ 🎨 Desi│  │ └───────────────────────────────────────┘ │     │
│ 📝 Spec│  ├──────────┬──────────┬──────────┬──────────┤     │
│ 📊 Quad│  │   Code   │ AI Rev   │Human Rev │   Done   │     │
│ 🚀 PR  │  │ 🟢 1 it  │ ○ 0 it   │ ○ 0 it   │ ✅ 5 it  │     │
│ 📈 Moni│  └──────────┴──────────┴──────────┴──────────┘     │
│        │                                                     │
│ 📜 Audi│  ┌─────────────────────────────────────────────┐   │
│ ⚙ Confi│  │ Timeline:                                    │   │
│        │  │ 10:32 — Code Agent concluded item B          │   │
│        │  │ 10:15 — Human approved "Login Flow"          │   │
│        │  │ 09:50 — Spec Agent completed "User Auth"     │   │
│        │  └─────────────────────────────────────────────┘   │
└────────┴─────────────────────────────────────────────────────┘
```

### 3.3 Execution Flow (Tela de Execução)

```
┌──────────────────────────────────────────────────────────────┐
│ [≡] LETRA           Execution: User Authentication           │
├────────┬─────────────────────────────────────────────────────┤
│        │                                                     │
│        │  Discovery Agent                                    │
│        │  ┌─────────────────────────────────────────────┐   │
│        │  │ ✅ Completed                    10:32       │   │
│        │  │ "Requisitos de autenticação mapeados"      │   │
│        │  └─────────────────────────────────────────────┘   │
│        │                                                     │
│        │  Design Agent                                       │
│        │  ┌─────────────────────────────────────────────┐   │
│        │  │ ✅ Completed                    10:45       │   │
│        │  │ "UX flow + telas definidas"                │   │
│        │  └─────────────────────────────────────────────┘   │
│        │                                                     │
│        │  Spec Agent                                         │
│        │  ┌─────────────────────────────────────────────┐   │
│        │  │ ✅ Completed                    11:02       │   │
│        │  │ "Spec + ACs gerados"                        │   │
│        │  └─────────────────────────────────────────────┘   │
│        │                                                     │
│        │  ╔═══════════════════════════════════════════════╗  │
│        │  ║  ⛔ HUMAN REVIEW REQUIRED                    ║  │
│        │  ║  Spec: User Authentication                   ║  │
│        │  ║                                              ║  │
│        │  ║  [● Approve]  [Request Changes]  [Reject]   ║  │
│        │  ║                                              ║  │
│        │  ║  ▲ Waiting — 12min                          ║  │
│        │  ╚═══════════════════════════════════════════════╝  │
│        │                                                     │
│        │  Code Agent                                         │
│        │  ┌─────────────────────────────────────────────┐   │
│        │  │ ○ Waiting for human approval...             │   │
│        │  └─────────────────────────────────────────────┘   │
└────────┴─────────────────────────────────────────────────────┘
```

### 3.4 Tela de Agentes

```
┌──────────────────────────────────────────────────────────────┐
│ [≡] LETRA           Agent: Code Agent                        │
├────────┬─────────────────────────────────────────────────────┤
│        │                                                     │
│        │  ┌─────────────────────────────────────────────┐   │
│        │  │ Code Agent                                   │   │
│        │  │                                             │   │
│        │  │ Model:    claude-sonnet-4-20250514           │   │
│        │  │ Status:   🟢 Online (idle)                   │   │
│        │  │ Tools:    read, write, bash, glob, grep      │   │
│        │  │ Rate:     94% sucesso (47/50)                │   │
│        │  │ Avg time: 3m 24s por task                    │   │
│        │  │ Last run: 10:32 — "User Authentication"     │   │
│        │  └─────────────────────────────────────────────┘   │
│        │                                                     │
│        │  System Prompt                                      │
│        │  ┌─────────────────────────────────────────────┐   │
│        │  │ You are a senior software engineer. Your    │   │
│        │  │ role is to implement the specification...   │   │
│        │  │ [Edit Prompt]                               │   │
│        │  └─────────────────────────────────────────────┘   │
│        │                                                     │
│        │  Recent Runs                                       │
│        │  ┌─────────────────────────────────────────────┐   │
│        │  │ # Task          Status   Duration  Output   │   │
│        │  │ 1  User Auth    ✅ Pass   4m 12s   3 files  │   │
│        │  │ 2  Login Flow   ❌ Fail   2m 01s   —        │   │
│        │  └─────────────────────────────────────────────┘   │
└────────┴─────────────────────────────────────────────────────┘
```

### 3.5 Human Gate Card (reutilizado em Dashboard, Quadro, Notificações)

```
┌──────────────────────────────────────────────┐
│ ⛔ HUMAN APPROVAL REQUIRED                    │
├──────────────────────────────────────────────┤
│ Feature: User Authentication                 │
│                                              │
│ Stage: Specification                         │
│ Agent:  Spec Agent                           │
│ Since:  11:02 (12min ago)                    │
│                                              │
│ [View Spec]                                  │
│                                              │
│ ┌──────┐  ┌──────────────┐  ┌──────────┐   │
│ │✓ Appr│  │✗ Req. Changes│  │⛔ Reject │   │
│ └──────┘  └──────────────┘  └──────────┘   │
└──────────────────────────────────────────────┘
```

---

## 4. Fluxos Detalhados

### 4.1 Fluxo Principal (Happy Path)

```
[User]                                 [Agentes]                         [Sistema]
  │                                        │                                │
  │ 1. Cria workspace                      │                                │
  │ ──────────────────────────────────────────────────────────────────→    │
  │                                        │                                │
  │ 2. Inicia item "Login"                 │                                │
  │ ──────────────────────────────────────────────────────────────────→    │
  │                                        │                                │
  │                                        │ 3. Discovery Agent             │
  │                                        │ ←────────────────────────────  │
  │                                        │    Entende requisitos          │
  │                                        │    Output: discovery.md       │
  │                                        │ ────────────────────────────→  │
  │                                        │                                │
  │                                        │ 4. Design Agent                │
  │                                        │ ←────────────────────────────  │
  │                                        │    UX + arquitetura de telas   │
  │                                        │    Output: design.md          │
  │                                        │ ────────────────────────────→  │
  │                                        │                                │
  │                                        │ 5. Spec Agent                  │
  │                                        │ ←────────────────────────────  │
  │                                        │    Spec + ACs + requisitos     │
  │                                        │    Output: spec.md            │
  │                                        │ ────────────────────────────→  │
  │                                        │                                │
  │ 6. Notificado: "Spec aguarda revisão"  │                                │
  │ ←──────────────────────────────────────────────────────────────────    │
  │                                        │                                │
  │ 7. Revisa spec                         │                                │
  │    [Approve] ──────────────────────────┼────────────────────────────→  │
  │                                        │                                │
  │                                        │ 8. Code Agent                  │
  │                                        │ ←────────────────────────────  │
  │                                        │    Implementa spec             │
  │                                        │    Output: codigo + testes    │
  │                                        │ ────────────────────────────→  │
  │                                        │                                │
  │                                        │ 9. AI Review Agent             │
  │                                        │ ←────────────────────────────  │
  │                                        │    Revisa qualidade+segurança  │
  │                                        │    Output: review.log         │
  │                                        │ ────────────────────────────→  │
  │                                        │                                │
  │ 10. Notificado: "Code review concluído"│                                │
  │ ←──────────────────────────────────────────────────────────────────    │
  │                                        │                                │
  │ 11. Revisa código                      │                                │
  │     [Approve] ─────────────────────────┼────────────────────────────→  │
  │                                        │                                │
  │                                        │ 12. PR Agent                   │
  │                                        │ ←────────────────────────────  │
  │                                        │     Gera PR + descrição        │
  │                                        │     Output: PR URL            │
  │                                        │ ────────────────────────────→  │
  │                                        │                                │
  │ 13. "PR #42 aberto: Login Flow"       │                                │
  │ ←──────────────────────────────────────────────────────────────────    │
```

### 4.2 Fluxo de Rejeição (Changes Requested)

```
[User]                              [Agentes]                        [Sistema]
  │                                      │                              │
  │ 1. [Request Changes] na Spec         │                              │
  │ ──────────────────────────────────────────────────────────────→    │
  │                                      │                              │
  │                                      │ 2. Spec Agent reaberto       │
  │                                      │ ←──────────────────────────  │
  │                                      │    Ajusta spec com feedback  │
  │                                      │ ──────────────────────────→  │
  │                                      │                              │
  │ 3. Notificado: "Spec atualizada"    │                              │
  │ ←──────────────────────────────────────────────────────────────    │
  │                                      │                              │
  │ 4. [Approve]                         │                              │
  │ ──────────────────────────────────────────────────────────────→    │
  │                                      │ 5. Code Agent inicia        │
```

### 4.3 Fluxo de Falha de Agente

```
[Sistema]                            [Humano]
  │                                      │
  │ 1. Code Agent falhou (erro timeout)  │
  │    Output: error.log                 │
  │                                      │
  │ 2. Marca item como "blocked"        │
  │    Notifica humano                   │
  │ ──────────────────────────────────→  │
  │                                      │
  │ 3. Humano revisa erro               │
  │    Opções:                           │
  │    [Retry] [Skip] [Edit Prompt]      │
  │ ←──────────────────────────────────  │
  │                                      │
  │ 4. [Retry] → Code Agent reexecuta   │
```

---

## 5. Componentes

### 5.1 Árvore de Componentes

```
App
├── Sidebar (collapsible)
│   ├── Logo
│   ├── NavGroup (Workspace)
│   │   ├── NavItem (Dashboard)
│   │   ├── NavItem (Projetos)
│   │   ├── NavItem (Agentes)
│   │   ├── NavItem (Harness)
│   │   └── NavItem (Conhecimento)
│   ├── NavGroup (Execução)
│   │   ├── NavItem (Discovery)
│   │   ├── NavItem (Design)
│   │   ├── NavItem (Specifications)
│   │   ├── NavItem (Quadro)
│   │   ├── NavItem (Pull Requests)
│   │   └── NavItem (Monitoramento)
│   └── NavGroup (Governança)
│       ├── NavItem (Auditoria)
│       └── NavItem (Configurações)
│
├── TopBar
│   ├── Breadcrumb
│   ├── WorkspaceSelector
│   ├── NotificationBell
│   │   └── NotificationDropdown
│   │       └── GateAlertCard[]
│   └── UserAvatar
│
└── MainContent (router)
    ├── DashboardView
    │   ├── PipelineStatus
    │   │   └── StageNode[] (com ícone de status)
    │   ├── MetricCards
    │   │   └── MetricCard[]
    │   ├── GatePendingList
    │   │   └── GateCard[] (com ações Approve/Reject)
    │   └── RecentActivity
    │       └── ActivityItem[]
    │
    ├── ProjectsView
    │   ├── WorkspaceList
    │   │   └── WorkspaceCard[]
    │   └── CreateWorkspaceWizard
    │
    ├── AgentsView
    │   ├── AgentList
    │   │   └── AgentCard[]
    │   └── AgentDetail
    │       ├── AgentInfo
    │       ├── PromptEditor
    │       └── RunHistory (tabela)
    │
    ├── ExecutionView (tela de execução)
    │   └── ExecutionPipeline
    │       └── ExecutionStage[]
    │           ├── StageHeader
    │           ├── StageStatus
    │           └── GateActions (se for gate)
    │
    ├── KanbanView (Quadro)
    │   ├── StageColumn[]
    │   │   ├── ColumnHeader
    │   │   └── ItemCard[]
    │   │       └── GateInline (se item está em gate)
    │   └── ActivityTimeline
    │
    └── AuditView
        ├── LogFilter
        └── LogTable
            └── LogEntry[]
```

### 5.2 Componentes Compartilhados

| Componente | Props | Usado em |
|------------|-------|----------|
| `GateCard` | feature, stage, agent, timestamp, onApprove, onReject, onChanges | Dashboard, Quadro, Notificações |
| `StageNode` | id, name, status (idle/running/done/blocked/waiting), agent | PipelineStatus, ExecutionView |
| `AgentBadge` | name, model, status (online/offline/busy/error) | AgentCard, ExecutionStage |
| `StatusDot` | status (success/warning/error/idle/blocked) | Universal |
| `MetricCard` | label, value, icon, trend | Dashboard |
| `ExecutionStage` | stage, status, agent, output, duration, error | ExecutionView |
| `NavGroup` | title, icon, items[] | Sidebar |
| `ActivityItem` | timestamp, agent, action, target | Timeline, RecentActivity |

---

## 6. Estados de Tela

### 6.1 Estados por View

| View | Loading | Empty | Normal | Error | Edge Case |
|------|---------|-------|--------|-------|-----------|
| **Dashboard** | Skeleton pipeline + metric cards | "No active workspace. Create one." | Pipeline + gates + metrics | "Failed to load workspace. [Retry]" | Workspace with 0 items |
| **Quadro** | Skeleton columns | "No items yet. Create your first." | Full kanban with cards | "Board error. [Reload]" | Single item in each column |
| **Execution** | Skeleton stages | "No active execution." | Live flow with agent status | "Agent failed: timeout. [Retry]" | Multiple gates waiting simultaneously |
| **Agentes** | Skeleton cards | "No agents configured." | Agent list + details | "Agent offline. Check API key." | Agent with 0% success rate |
| **Auditoria** | Skeleton table | "No logs recorded yet." | Paginated log table | "Log load failed." | 10k+ entries, needs search |
| **Projetos** | Skeleton cards | "No workspaces. Create one." | Workspace list | "Failed to list workspaces." | 50+ workspaces |

### 6.2 Gate Card States

| State | Visual | Ações |
|-------|--------|-------|
| `waiting` | ⏳ Amber pulse | [View] |
| `available` | 🔴 Red highlight + badge | [View Spec] [Approve] [Changes] [Reject] |
| `approved` | ✅ Green check | nenhuma |
| `changes-requested` | ✏️ Yellow edit | [View Updated Spec] [Approve] |
| `rejected` | ⛔ Red stop | [View Reason] [Restart] |
| `expired` | ⏰ Gray timeout | [View] [Restart] |

### 6.3 Pipeline Stage States

```
○ idle         — stage não iniciado (cinza fraco)
▶ running      — agente executando (azul/ambrer pulse)
⏳ waiting      — aguardando gate humano (ambrer pulsing)
✅ done        — completo com sucesso (verde)
❌ failed      — erro na execução (vermelho)
⛔ blocked     — bloqueado por dependência (vermelho escuro)
✏️ changes      — aguardando ajustes (amarelo)
```

---

## 7. Design System (Atualizado)

### 7.1 Cores

**Tema:** Claro prioritário, escuro como override

| Token | Light | Dark | Uso |
|-------|-------|------|-----|
| `--background` | oklch(0.98 0.01 85) | oklch(0.145 0.01 85) | Fundo da página |
| `--foreground` | oklch(0.145 0.01 85) | oklch(0.98 0.01 85) | Texto primário |
| `--primary` | oklch(0.7 0.18 85) (#F59E0B amber) | oklch(0.75 0.18 85) | Ações principais, links |
| `--primary-foreground` | oklch(0.98 0 0) | oklch(0.145 0 0) | Texto em primary |
| `--card` | oklch(0.99 0.01 85) | oklch(0.18 0.01 85) | Cards, superfícies |
| `--card-hover` | oklch(0.97 0.015 85) | oklch(0.22 0.015 85) | Hover em cards |
| `--border` | oklch(0.9 0.015 85) | oklch(0.25 0.015 85) | Bordas |
| `--muted` | oklch(0.95 0.01 85) | oklch(0.22 0.01 85) | Fundo muted |
| `--muted-foreground` | oklch(0.6 0.02 85) | oklch(0.7 0.02 85) | Texto secundário |
| `--success` | oklch(0.65 0.18 145) | same | Status positivo |
| `--warning` | oklch(0.75 0.18 80) | same | Alerta amarelo |
| `--error` | oklch(0.6 0.22 30) | same | Erro, falha |

**Gate colors (novas):**

| Token | Cor | Uso |
|-------|-----|-----|
| `--gate-waiting` | var(--warning) | ⏳ Gate pendente |
| `--gate-available` | var(--error) | 🔴 Gate precisa ação |
| `--gate-approved` | var(--success) | ✅ Gate aprovado |
| `--gate-blocked` | oklch(0.4 0.22 30) | ⛔ Gate bloqueado |

### 7.2 Tipografia

| Elemento | Família | Peso | Tamanho | Tracking |
|----------|---------|------|---------|----------|
| Headings | Inter | 700 | 24/20/18 | -0.02em |
| Body | Inter | 400 | 14 | normal |
| Small | Inter | 400 | 12 | normal |
| Mono | JetBrains Mono / Cascadia Code | 400 | 13 | normal |
| Badge | Inter | 600 | 11 | 0.04em |
| Sidebar | Inter | 500 | 13 | -0.01em |

### 7.3 Grid e Espaçamento

| Token | Valor | Uso |
|-------|-------|-----|
| `--space-1` | 4px | Micro espaçamento |
| `--space-2` | 8px | Padding interno |
| `--space-3` | 12px | Gap entre elementos |
| `--space-4` | 16px | Padding de cards |
| `--space-6` | 24px | Padding de página |
| `--space-8` | 32px | Seções |
| `--space-12` | 48px | Seções grandes |

**Radius:**

| Token | Valor | Uso |
|-------|-------|-----|
| `--radius-sm` | 8px | Inputs, badges |
| `--radius-md` | 12px | Cards, dialogs |
| `--radius-lg` | 16px | Modals, sidebars |
| `--radius-xl` | 24px | Avatares, logos |

### 7.4 Sombras

| Layer | Light | Dark |
|-------|-------|------|
| Card | `0 1px 3px oklch(0 0 0 / 0.06)` | `0 1px 3px oklch(0 0 0 / 0.30)` |
| Card hover | `0 4px 12px oklch(0 0 0 / 0.10)` | `0 4px 12px oklch(0 0 0 / 0.40)` |
| Dropdown | `0 8px 24px oklch(0 0 0 / 0.12)` | `0 8px 24px oklch(0 0 0 / 0.50)` |
| Modal | `0 16px 48px oklch(0 0 0 / 0.20)` | `0 16px 48px oklch(0 0 0 / 0.60)` |
| Gate alert | `0 0 0 3px var(--gate-available), 0 4px 12px oklch(0 0 0 / 0.15)` | same |

### 7.5 Animações (Novas)

| Animação | Gatilho | Duração |
|----------|---------|---------|
| `pulse-gate-waiting` | ⏳ Gate waiting | 2s infinite |
| `pulse-gate-urgent` | 🔴 Gate available >5min | 1s infinite |
| `stage-enter` | Novo stage ativo | 300ms ease-out |
| `agent-thinking` | Agente processando | 1.5s shimmer |
| `slide-pipeline` | Pipeline avança | 400ms ease |

---

## 8. Modelo de Entidades

### 8.1 Workspace

```yaml
id: string        # slug único
name: string      # "Delivery SaaS"
description: string
createdAt: datetime
templateRef: string  # "sdlc", "kanban"
gates:
  - gate:
      id: string    # "spec-review", "code-review"
      stage: string # estágio onde o gate ocorre
      type: "human-approval"
      timeout: number?  # horas para expirar
repositories:
  - id: string
    path: string
    branch: string
harness:
  version: string
  path: string
```

### 8.2 Flow (ciclo ativo)

```yaml
id: string
workspaceId: string
templateRef: string
stages:
  - id: string       # "discovery", "design", "spec", "human-review-1", "code", "ai-review", "human-review-2", "pr", "done"
    name: string
    order: number
    zone: "todo" | "doing" | "done"
    agent: string?          # agente responsável
    gate: string?           # gate id se este estágio requer aprovação
items:                      # cards no board
  - id: string
    title: string
    stage: string
    agent: string?
    status: "idle" | "running" | "done" | "failed" | "blocked"
    spec: string?           # spec id
    assignee: "agent" | "human"
    createdAt: datetime
    updatedAt: datetime
```

### 8.3 Agent

```yaml
id: string          # "discovery-agent", "code-agent"
name: string        # "Discovery Agent"
role: string        # "discovery", "design", "spec", "code", "review", "pr"
model: string       # "claude-sonnet-4-20250514"
status: "online" | "offline" | "busy" | "error"
systemPrompt: string
tools: string[]     # "read", "write", "bash", "glob", "grep", "web"
config:
  temperature: number
  maxTokens: number
  timeout: number
metrics:
  totalRuns: number
  successRate: number     # 0-100
  avgDuration: number     # segundos
  lastRun: datetime?
```

### 8.4 Execution

```yaml
id: string
itemId: string
stage: string
agentId: string
status: "running" | "done" | "failed" | "blocked"
input:
  spec: string
  context: string
output:
  artifacts: string[]   # paths gerados
  summary: string
  duration: number
error?: string
startedAt: datetime
completedAt: datetime?
```

### 8.5 Audit Log

```yaml
id: string
timestamp: datetime
action: "agent_started" | "agent_completed" | "agent_failed" | "gate_opened" | "gate_approved" | "gate_rejected" | "gate_changes_requested" | "item_moved"
actor:
  type: "agent" | "human"
  id: string
  name: string
target:
  type: "item" | "spec" | "execution" | "gate"
  id: string
metadata:
  input?: string
  output?: string
  reason?: string
duration?: number
```

### 8.6 Gate Instance

```yaml
id: string
itemId: string
stage: string
type: "human-approval"
status: "waiting" | "available" | "approved" | "changes-requested" | "rejected" | "expired"
openedAt: datetime
decidedAt: datetime?
decidedBy: string?     # user id
decision: string?      # "approved" | "changes" | "rejected"
comment: string?
timeout: number        # horas
```

---

## 9. Requisitos Funcionais

### RF1 — Pipeline Visualization
RF1.1 Exibir fluxo Discovery → Design → Spec → Human Review → Code → AI Review → Human Review → PR → Done
RF1.2 Cada stage exibe status: idle, running, done, failed, blocked, waiting
RF1.3 Stage atual deve ser visualmente destacado
RF1.4 Gate stages devem ter ícone de escudo/destaque visual

### RF2 — Human Gates
RF2.1 Dois gates obrigatórios: após Spec e após AI Review
RF2.2 Gate deve exibir: feature, agente responsável, timestamp, botões de ação
RF2.3 Ações: Approve, Request Changes, Reject
RF2.4 Request Changes deve reabrir o agente da etapa anterior
RF2.5 Reject deve mover item para backlog com registro de motivo
RF2.6 Notificação push quando gate fica disponível
RF2.7 Gate expirado (>24h) deve ser destacado em vermelho

### RF3 — Sidebar Navigation
RF3.1 Sidebar colapsável com ícones
RF3.2 Três grupos: Workspace, Execução, Governança
RF3.3 Indicador visual de item ativo
RF3.4 Badge de notificação em gates pendentes

### RF4 — Agent Management
RF4.1 Listar agentes disponíveis
RF4.2 Exibir detalhes: modelo, status, ferramentas, métricas
RF4.3 Editar system prompt do agente
RF4.4 Ver histórico de execuções por agente

### RF5 — Execution Flow
RF5.1 Tela dedicada por item em execução
RF5.2 Pipeline vertical com status por estágio
RF5.3 Botões de ação nos gates humanos
RF5.4 Indicador de "agente pensando" durante execução

### RF6 — Kanban Board
RF6.1 Nove colunas representando os 9 estágios (2 linhas)
RF6.2 Arrastar itens entre colunas
RF6.3 Cards de gate inline nas colunas de gate
RF6.4 Timeline de atividades ao lado

### RF7 — Dashboard
RF7.1 Pipeline Status com 9 nodes
RF7.2 Metric Cards: Agents, Tasks, PRs, Health
RF7.3 Gate Pending List com ações diretas
RF7.4 Recent Activity feed

### RF8 — Auditoria
RF8.1 Log imutável de todas as ações
RF8.2 Filtros: agente, ação, item, data
RF8.3 Busca textual
RF8.4 Exportar log

### RF9 — Projetos (Workspaces)
RF9.1 CRUD de workspaces
RF9.2 Workspace detail com overview + repositórios + agents

### RF10 — Notificações
RF10.1 Push notification quando gate fica disponível
RF10.2 Badge no sidebar + topbar
RF10.3 Dropdown de notificações com ações rápidas

---

## 10. Roadmap do MVP

### Fase 1 — Foundation (Sprint 1-2)
```
[ ] Sidebar collapsible com 3 grupos
[ ] Dashboard com pipeline + metric cards
[ ] Gate Card component (reutilizável)
[ ] Nova paleta amber (light mode first)
[ ] TopBar com workspace selector + notificações
```

### Fase 2 — Execution Flow (Sprint 3-4)
```
[ ] Execution View com pipeline vertical
[ ] Agente execução simulada (status cycling)
[ ] Gate actions: Approve / Changes / Reject
[ ] Agent Detail page
```

### Fase 3 — Board + Auditoria (Sprint 5-6)
```
[ ] Kanban com 9 colunas (2 linhas)
[ ] Drag and drop entre estágios
[ ] Activity Timeline no board
[ ] Audit Log view com filtros
```

### Fase 4 — Multi-agent (Sprint 7-8)
```
[ ] Agent registry
[ ] System prompt editor
[ ] Run history + metrics
[ ] Notificação push real
```

### Fase 5 — Polimento (Sprint 9-10)
```
[ ] Temas (claro/escuro) consistentes
[ ] Responsivo
[ ] Performance (listas 100+ items)
[ ] Onboarding + empty states
```
