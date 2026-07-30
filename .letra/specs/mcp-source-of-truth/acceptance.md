# Acceptance Criteria — MCP como Visão Read-Otimizada do Harness

## ✅ AC1 — Resources do Harness via MCP
- [x] Recurso: `letra://harness/templates/<flowId>` retorna objeto completo do template com stages, gates, roles e policies resolvidos.
- [x] Quando `flowId` é omitido, retorna lista de IDs de templates disponíveis.
- [x] Recurso: `letra://harness/gates` retorna todos os gates do template ativo.
- [x] Recurso: `letra://harness/roles` retorna todos os roles do template ativo.

## ✅ AC2 — Tools de leitura de Harness
- [x] Tool: `list_gates`
  - Retorna: `[{ id, name, type, blocking, policyRef, description, decisions? }]`
  - Sem argumentos obrigatórios.
  - `readOnlyHint: true`
- [x] Tool: `list_roles`
  - Retorna: `[{ id, label, description, allowedStages, capabilities }]`
  - `readOnlyHint: true`

## ✅ AC3 — Transições enriquecidas
- [x] `request_transition` para stage com gate humano:
  - `outcome: "approval-required"`
  - `reasonCode: "HUMAN_APPROVAL_REQUIRED"`
  - `nextDirection.prohibitions` contém `mustNotDo` do hint do gate
  - `nextDirection.allowedStageIds` derivado dos roles do stage destino
  - `nextDirection.requiredEvidence` contém `evidence` do gate hint no destino
- [x] `request_transition` sem bloqueio:
  - `outcome: "accepted"`
  - `nextDirection` atualizado (já existente)

## ✅ AC4 — Sem drift CLI↔MCP
- [x] `letra direction --json` ≡ `mcp get_direction` (mesmos campos, mesmo resolvedor)
- [x] `letra validate` ≡ `mcp validate` (mesmo `runValidationOperation`)

## ✅ AC5 — Auditoria preservada
- [x] Tools mutantes geram `agent_operation` no session-log com `adapter: "mcp:<name>"`, `outcome`, `reasonCode`.
- [x] Resources geram `agent_harness_read` no session-log, deduplicado por revisão.
