# Spec: web-health-alerts

> Updated: 2026-06-22

## Outcome

O usuário vê os alertas do health record diretamente no dashboard da web app, sem precisar abrir o terminal. Os cards de alerta mostram severidade, título, fonte, e ações (acknowledge/dismiss). O header também mostra um badge com contagem de alertas não lidos.

## Constraints

- Dados vindos dos endpoints existentes `GET /api/health` e `GET /api/health/alerts`
- Respeita o mesmo schema do health-record.json (novo, ciente, descartado, resolvido)
- Ações de ack/dismiss chamam `POST /api/health/ack` e `POST /api/health/dismiss` existentes
- Não duplica o DiagnosticsIndicator (que mostra sugestões do diagnostic engine)
- Design consistente com o sistema de design existente (OKLCH tokens, Tailwind v4)

## Exclusions

- Edição/criação de alertas (só leitura e ack/dismiss)
- Webhook notifications ou email
- Histórico de alertas resolvidos/descartados (API já retorna, UI começa só com novos)
- Versão mobile responsiva (futuro)

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

## Context

O health record (`health-record.json`) é gerado pelo `letra health scan` e `letra diagnose`, mas atualmente não tem visualização na web app. Os endpoints HTTP já existem no `flow-serve.ts`. Esta spec implementa a camada de UI para tornar esses alertas visíveis e acionáveis no navegador.
