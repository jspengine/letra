## Acceptance Criteria

- [ ] **Schema**: Workflow ganha campo `webhooks: WebhookConfig[]` com `{ id, url, events: string[], label?, lastStatus?, lastSentAt? }`
- [ ] **Eventos**: `item.moved` — disparado via PATCH /api/items/:id quando stage muda
- [ ] **Trigger**: flow-serve envia POST para cada webhook configurado com payload `{ event, workflow, item, sourceStage, targetStage, timestamp }`
- [ ] **Fire-and-forget**: webhook falhou? item foi movido de qualquer forma. Erro logado no lastStatus.
- [ ] **UI**: FlowView ganha botão "Webhooks" ao lado de "Manage Stages" — inline editor com lista de webhooks (url, label, eventos), botão de teste, indicador de status (✅ / ❌)
- [ ] **Teste**: Botão "Test" envia payload de teste e mostra resultado
- [ ] **Persistência**: webhooks salvos via PATCH /api/workflow
