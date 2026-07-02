# Spec: item-7-automacoes

> Updated: 2026-06-22

## Outcome

Ao mover itens entre estágios no flow, webhooks configurados são disparados automaticamente. Usuário pode cadastrar URLs de webhook (Slack, Discord, ou qualquer endpoint HTTP) no FlowView, escolher quais eventos disparam (move item), e ver o status da última notificação.

## Constraints

- Zero dependências runtime externas — usar `fetch()` nativo Node 22+
- Webhooks armazenados no workflow.json — sem banco de dados
- Slack-compatible: payload compatível com Slack Incoming Webhook
- Falha de webhook não bloqueia o movimento do item (fire-and-forget)
- UI de configuração inline no FlowView (ao lado de Manage Stages)

## Exclusions

- Não implementar retry automático
- Não implementar rate limiting
- Não implementar automações condicionais (se X então Y) — será ITEM-7B
- Não implementar notificações in-app (apenas webhooks externos)

## Acceptance Criteria

- [ ] **Schema**: Workflow ganha campo `webhooks: WebhookConfig[]` com `{ id, url, events: string[], label?, lastStatus?, lastSentAt? }`
- [ ] **Eventos**: `item.moved` — disparado via PATCH /api/items/:id quando stage muda
- [ ] **Trigger**: flow-serve envia POST para cada webhook configurado com payload `{ event, workflow, item, sourceStage, targetStage, timestamp }`
- [ ] **Fire-and-forget**: webhook falhou? item foi movido de qualquer forma. Erro logado no lastStatus.
- [ ] **UI**: FlowView ganha botão "Webhooks" ao lado de "Manage Stages" — inline editor com lista de webhooks (url, label, eventos), botão de teste, indicador de status (✅ / ❌)
- [ ] **Teste**: Botão "Test" envia payload de teste e mostra resultado
- [ ] **Persistência**: webhooks salvos via PATCH /api/workflow

## Context

A automação mais simples e de maior valor é notificar times externos quando items mudam de estágio. Slack webhooks são o padrão de facto, mas qualquer endpoint HTTP JSON serve. O fire-and-forget mantém o movimento de items rápido — o webhook é apenas um efeito colateral.
