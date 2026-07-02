# Acceptance Criteria — Product Rebrand

## Navegação e Layout
- [ ] AC1: Sidebar collapsible com 3 grupos (Workspace, Execução, Governança) e ícones
- [ ] AC2: TopBar com workspace selector, notification bell com badge, user avatar
- [ ] AC3: Tema light como padrão, dark como override

## Dashboard
- [ ] AC4: Pipeline visual com 9 stages (Discovery → Design → Spec → Human Rev → Code → AI Rev → Human Rev2 → PR → Done)
- [ ] AC5: Cada stage exibe status com cor e ícone
- [ ] AC6: Metric Cards (Agents, Tasks, PRs, Health)
- [ ] AC7: Gate Pending List com cards de aprovação e ações diretas

## Gates Humanos
- [ ] AC8: Gate Card component reutilizável
- [ ] AC9: 6 estados de gate (waiting, available, approved, changes-requested, rejected, expired)
- [ ] AC10: Request Changes reabre agente; Reject move ao backlog com motivo

## Execution View
- [ ] AC11: Tela de execução com pipeline vertical e ações nos gates
- [ ] AC12: Indicador "agente pensando" (shimmer)
- [ ] AC13: Estados loading/empty/running/done/failed

## Quadro (Kanban)
- [ ] AC14: 9 colunas em 2 linhas
- [ ] AC15: Cards de gate inline nas colunas HumanRev
- [ ] AC16: Activity Timeline ao lado do board

## Agent Management
- [ ] AC17: Agent List com cards (nome, modelo, status, taxa de sucesso)
- [ ] AC18: Agent Detail com prompt editor e run history

## Auditoria
- [ ] AC19: Audit Log view com tabela paginada e filtros
- [ ] AC20: Log imutável registrando quem, o quê, quando, entrada/saída

## Design System
- [ ] AC21: Paleta amber (primary = #F59E0B OKLCH), light mode first
- [ ] AC22: Tokens de gate (--gate-waiting, --gate-available, --gate-approved, --gate-blocked)
- [ ] AC23: Animações (pulse-gate-waiting, pulse-gate-urgent, stage-enter, agent-thinking)

## Estados
- [ ] AC24: Toda view tem 4 estados (loading/empty/normal/error)
- [ ] AC25: Empty states action-oriented
- [ ] AC26: Error states com botão Retry
