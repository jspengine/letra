# Roadmap — Flow

> Organização do que entra agora vs futuras versões
> Baseado na discussão de discovery em 2026-06-06

## v0.2.0 — Flow MVP (AGORA)

**3 comandos, valor imediato, 1-2 dias cada**

| Prioridade | Feature | Esforço | Depende de |
|---|---|---|---|
| P0 | `flow init --quick` (wizard 3 perguntas) | 2 dias | — |
| P0 | `flow backlog add/list` | 1 dia | — |
| P0 | `flow move <id> --to <stage>` + adapter regenerate | 2 dias | backlog |
| P0 | `flow board` (tabela terminal) | 1 dia | backlog, move |
| P1 | `flow visualize` (Mermaid) | 1 dia | — |
| P1 | `flow export / import` | 1 dia | init |
| P1 | Versionamento (`flow edit`, `flow diff`) | 2 dias | init |

**Total estimado:** ~10 dias

## v0.3.0 — Flow Evolution (PRÓXIMO)

| Feature | Motivo |
|---|---|
| Import de issues (GitHub, Linear) | Reduz atrito inicial |
| Git auto-detection | Inferir workflow do repositório |
| Regras com severity reutilizando validate | Sem sistema novo |
| Ciclo completo: backlog → spec → code → review | Integração com specs existentes |
| Template marketplace (community registry) | Escalar adoção |

## v0.4.0+ — Flow Scale (FUTURO)

| Feature | Motivo |
|---|---|
| Automações leves (notify Slack/Webhook) | Time grande sente falta |
| Skills engine estruturada | Time avançado quer mais controle |
| Web UI (`letra flow ui`) | Não-devs precisam |
| Métricas de fluxo (tempo por estágio) | Otimizar processo |
| Agentes multi-projeto | Empresas com múltiplos times |
