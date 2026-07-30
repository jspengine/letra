# MCP como Visão Read-Otimizada do Harness

Expor a estrutura do harness (templates, gates, roles) como resources e tools MCP, eliminando a necessidade de o agente ler YAMLs diretamente e enriquecendo transições com dados de gate.

## Contexto

O MCP server atual expõe 3 leituras (`get_direction`, `get_active_spec`, `get_health`) e 3 mutações (`validate`, `complete_ac`, `request_transition`). O harness real — templates, gates, roles, policies — fica invisível por MCP. O agente precisa abrir arquivos YAML em `.letra/harness/` para saber quais gates existem, quais roles estão disponíveis ou qual a estrutura de um template.

Isso gera:
- Agente sem visão estruturada do harness sem leitura de arquivos.
- Transições sem dados de gate — `request_transition` retorna sucesso/fracasso, mas não diz *por que* foi bloqueada nem *o que falta*.
- Resources de harness que poderiam ser consultados via MCP precisam de acesso a disco.

## Objetivo

Tornar o harness visível e consultável via MCP sem leitura de arquivos, com:
- resources read-only do harness (`letra://harness/templates/<flowId>`, etc.);
- tools read-only (`list_gates`, `list_roles`);
- transições enriquecidas com dados de gate (proibições, estágios permitidos, evidência requerida);
- CLI e MCP semanticamente idênticos (sem drift).

## Escopo

- Apenas resources e tools MCP + enriquecimento de `request_transition`.
- Não modificar harness YAMLs — MCP é leitura + operações controladas, não gateway de escrita.
- Não adicionar tools de mutação de harness (`update_gate`, `update_flow`).

## Fora do Escopo

- Mutação de harness YAML por MCP (gates, roles, templates são versionados, não editáveis por workspace).
- Correções de infraestrutura HTTP/UI (pertencem a itens separados).
- Multi-workspace dentro de uma conexão MCP.

## Premissas

- Harness versionado continua em `.letra/harness/<version>/`.
- `workflow.json` continua como instância operacional.
- `resolveActiveFlow` é o resolvedor canônico de flow definition.

## Restrições

- Nenhuma mutação de harness YAML por MCP.
- Todo tool mutante retorna `beforeRevision`, `afterRevision`, `auditId`, `nextDirection` e `reasonCode`.
- Resources e tools usam `resolveActiveFlow` e `loadHarness` existentes — sem duplicar lógica.

## Critérios de Aceitação

- [x] **AC1 — Resources do Harness via MCP**: `letra://harness/templates/<flowId>` retorna template com stages, gates, roles e policies. `flowId` omitido retorna lista de templates.
- [x] **AC2 — Tools de leitura de Harness**: `list_gates()` retorna `[{ id, name, type, blocking, policyRef, description, decisions? }]`. `list_roles()` retorna `[{ id, label, description, allowedStages, capabilities }]`. Ambas com `readOnlyHint: true`.
- [x] **AC3 — Transições enriquecidas com dados de gate**: `request_transition` para stage com gate humano retorna `outcome: approval-required`, `reasonCode: HUMAN_APPROVAL_REQUIRED`, `nextDirection` com `prohibitions`, `allowedStageIds`, `requiredEvidence`. Gate não bloqueante retorna `outcome: accepted`.
- [x] **AC4 — Sem drift entre CLI e MCP**: CLI e MCP produzem resultados semanticamente idênticos para operações compartilhadas (`validate`, `direction`).
- [x] **AC5 — Auditoria preservada**: Toda tool MCP gera entrada auditável no session-log. Leituras deduplicadas por revisão.

## Riscos

| Risco | Mitigação |
|---|---|
| Resources expõem dados sensíveis do harness | Apenas dados estruturais; policies referenciam arquivos, não os incluem. |
| Drift entre resource e YAML real | Resources lêem do disco a cada requisição — sempre atual. |

## Decisões

- **MCP é leitura + operações, não escrita de harness.** Gates, roles e templates são versionados em YAML — mutá-los por MCP quebraria rastreabilidade.
- **`requestTransitionOperation` existente é enriquecido**, não reescrito.
- **CLI continua existindo** como fallback, mas implementado sobre o mesmo `domain-operations`.

## Dependências

- `packages/cli/src/mcp/server.ts`
- `packages/cli/src/domain-operations/service.ts`
- `packages/cli/src/agent-direction/service.ts`
- `packages/types/src/index.ts`

## Tarefas

1. Adicionar resources MCP: `letra://harness/templates/<flowId>`, `letra://harness/gates`, `letra://harness/roles`.
2. Adicionar tools MCP read-only: `list_gates`, `list_roles`.
3. Enriquecer retorno de `request_transition` com `prohibitions`, `allowedStageIds`, `requiredEvidence` quando bloqueado.
4. Adicionar teste de contrato MCP ↔ CLI para cada operação compartilhada.
5. Registrar `agent_harness_read` no session-log para resources do harness.
