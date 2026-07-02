# Spec: Product Rebrand — AI-Native Software Delivery Workspace

## Contexto

Letra está sendo reposicionada de "ferramenta de specs + workflow para LLMs" para "plataforma de orquestração de desenvolvimento de software assistida por agentes de IA". Humanos atuam como aprovadores estratégicos dentro do fluxo SDLC.

## Visão Geral

Interface redesenhada com sidebar recolhível, dashboard de pipeline visual, kanban SDLC de 9 estágios, tela de execução com agents visíveis, gates humanos com destaque visual, e auditoria completa.

## Acceptance Criteria

### Navegação e Layout

- [x] AC1: Sidebar collapsible com 3 grupos (Workspace, Execução, Governança) e ícones
- [x] AC2: TopBar com workspace selector, notification bell com badge, e user avatar
- [x] AC3: Tema light como padrão, dark como override (inverter comportamento atual)

### Dashboard

- [x] AC4: Pipeline visual com 9 stages (Discovery → Design → Spec → Human Rev → Code → AI Rev → Human Rev2 → PR → Done) usando `StageNode` component
- [x] AC5: Cada stage exibe status com cor e ícone (idle/running/done/failed/blocked/waiting)
- [x] AC6: Metric Cards (Agents, Tasks, PRs, Health) no topo
- [x] AC7: Gate Pending List com cards de aprovação e ações diretas (Approve/Changes/Reject)

### Gates Humanos

- [x] AC8: Gate Card component reutilizável (Dashboard, Quadro, Notificações) com feature, stage, agent, timestamp, ações
- [x] AC9: Gate states: waiting, available (🔴), approved, changes-requested, rejected, expired
- [x] AC10: Request Changes reabre agente da etapa anterior; Reject move item ao backlog com motivo

### Execution View

- [x] AC11: Tela de execução por item com pipeline vertical, status por estágio, e botões de ação nos gates
- [x] AC12: Indicador "agente pensando" durante execução (shimmer animation)
- [x] AC13: Estados: loading (skeleton), empty, running, done, failed

### Quadro (Kanban)

- [x] AC14: 9 colunas em 2 linhas (Discovery/Design/Spec/HumanRev — Code/AIRev/HumanRev2/PR/Done)
- [x] AC15: Cards de gate inline nas colunas HumanRev com destaque visual
- [x] AC16: Activity Timeline ao lado do board

### Agent Management

- [x] AC17: Agent List com cards: nome, modelo, status (online/offline/busy/error), taxa de sucesso
- [x] AC18: Agent Detail: system prompt editável, histórico de execuções, métricas

### Auditoria

- [x] AC19: Audit Log view com tabela paginada, filtros (agente, ação, data), busca textual
- [x] AC20: Log imutável registrando: quem (agente/humano), o quê, quando, entrada/saída

### Design System

- [x] AC21: Paleta amber (primary = #F59E0B, OKLCH), light mode first
- [x] AC22: Tokens de gate: --gate-waiting, --gate-available, --gate-approved, --gate-blocked
- [x] AC23: Animações: pulse-gate-waiting, pulse-gate-urgent, stage-enter, agent-thinking

### Estados e Tratamento de Erro

- [x] AC24: Toda view tem 4 estados: loading (skeleton), empty (action-oriented), normal, error (retry)
- [x] AC25: Empty states informativos: "Crie seu primeiro workspace", "Nenhum item no board"
- [x] AC26: Error states com botão Retry e mensagem descritiva

## Design References

- Sidebar: Linear.app
- Dashboard pipeline: GitHub Projects
- Kanban: Notion / Linear
- Gates: OpenAI Platform (approval flows)
- Agentes: Vercel dashboard (deploy runs)

## Entity Model

Ver `.letra/decisions/product-rebrand-architecture.md` seção 8.
