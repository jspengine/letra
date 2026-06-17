# Spec: Web Health Alerts — Alertas de Saúde na Web UI

> Updated: 2026-06-16

## Outcome

O usuário vê os alertas do health record diretamente no dashboard da web app, sem precisar abrir o terminal. Os cards de alerta mostram severidade, título, fonte, e ações (acknowledge/dismiss). O header também mostra um badge com contagem de alertas não lidos.

## Constraints

- Dados vindos dos endpoints existentes `GET /api/health` e `GET /api/health/alerts`
- Respeita o mesmo schema do health-record.json (novo, ciente, descartado, resolvido)
- Ações de ack/dismiss chamam `POST /api/health/ack` e `POST /api/health/dismiss` existentes
- Não duplica o DiagnosticsIndicator (que mostra sugestões do diagnostic engine)
- Design consistente com o sistema de design existente (OKLCH tokens, Tailwind v4)

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Header                                                 │
│  [logo]  Home  Specs  Flow  Context  🔔(3)  [avatar]   │
│                                       ↑                 │
│                              Badge de alertas não lidos  │
└─────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────┐
│  Home Dashboard                                         │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                   │
│  │Specs │ │Drift │ │Focus │ │Saúde │← card novo        │
│  │  12  │ │   3  │ │  ok  │ │ 3 al │                   │
│  └──────┘ └──────┘ └──────┘ └──────┘                   │
│                                                         │
│  ┌─ Alertas ──────────────────────────────────────────┐ │
│  │ 🔴 alta   AC "flow diff v1.0 v1.1" não encontrado │ │
│  │ 🟡 média  AC "spec new" não encontrado             │ │
│  │           [ack] [dismiss]  ─── desde 15/06         │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Fluxo de dados

```
Web App                    flow-serve                File System
  │                            │                        │
  │── GET /api/health/alerts ──→── read health-record.json
  │←── { entries[] } ──────────│                        │
  │                            │                        │
  │── POST /api/health/ack ───→── write health-record.json
  │←── { ok } ────────────────│                        │
```

### Componentes

- **HealthBadge** — ícone 🔔 no header com contagem de alertas novos. Dropdown com preview dos 3 primeiros.
- **HealthCard** — 4º card métrico na Home com contagem total de alertas ativos + breakdown por severidade.
- **AlertList** — Lista expandida de alertas com:
  - Ícone de severidade (🔴 alta, 🟡 média, 🔵 info)
  - Título + descrição
  - Fonte + data de detecção
  - Botões Acknowledge / Dismiss
  - Filtro: "Novos" / "Em acompanhamento" / "Todos"
- **AlertService** — Hook/função para chamar os endpoints e manter estado

## Acceptance Criteria

- [ ] **HealthBadge**: Header mostra 🔔 com contagem de alertas `status === "novo"`
- [ ] **HealthBadge dropdown**: Ao clicar, mostra preview dos 3 primeiros alertas + link "Ver todos"
- [ ] **HealthCard**: Home Dashboard mostra 4º card "Saúde" com total de alertas ativos
- [ ] **AlertList**: Página/expansão com lista completa, filtrável por status
- [ ] **Ack**: Botão "ack" altera status de "novo" para "ciente" via `POST /api/health/ack`
- [ ] **Dismiss**: Botão "dismiss" altera status para "descartado" via `POST /api/health/dismiss`
- [ ] **SSE**: Ao receber `diagnostics-updated`, re-fetch alerts automaticamente
- [ ] **Empty state**: Sem alertas, mostra "✅ Nenhum alerta" no card e badge oculto
- [ ] **Estilo**: Usa cores do design system (severity: alta → red, média → amber, info → blue)
- [ ] **Testes**: Componentes testados com Vitest + React Testing Library
- [ ] **Nada quebrado**: DiagnosticsIndicator existente continua funcionando normalmente

## Exclusions

- Edição/criação de alertas (só leitura e ack/dismiss)
- Webhook notifications ou email
- Histórico de alertas resolvidos/descartados (API já retorna, UI começa só com novos)
- Versão mobile responsiva (futuro)

## Context

O health record (`health-record.json`) é gerado pelo `letra health scan` e `letra diagnose`, mas atualmente não tem visualização na web app. Os endpoints HTTP já existem no `flow-serve.ts`. Esta spec implementa a camada de UI para tornar esses alertas visíveis e acionáveis no navegador.
