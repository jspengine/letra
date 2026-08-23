# Acceptance Criteria — Agent Orchestration (ITEM-81)

> Updated: 2026-08-23 — AC15-AC17 added for implementation gap closure

## AC1 — Roles do Harness
- [x] Arquivos YAML em `harness/v0.2.0/roles/` definem: analyst, implementer, reviewer, security
- [x] Cada role tem: id, label, description, allowedStages, capabilities, handoff, constraints
- [x] Campo `prompt-template` é Opcional e aceita referência a arquivo (não inline YAML)
- [x] Loader de roles atualizado para ler handoff config
- [x] Tipo `AgentCapability` em `harness/types.ts` inclui campo `handoff`

## AC2 — Gates do Harness
- [x] Gates definidos: spec-approved (human), code-reviewed (automated), security-clear (automated), human-approved (human)
- [x] Cada gate tem: id, name, type, blocking, decisions (approve/request-changes/reject)
- [x] GateChecker valida gates automáticos e bloqueia handoffs sem aprovação
- [x] Campo `blocksHandoff` permite definir se gate bloqueia handoff (não só avanço de estágio)

## AC3 — Flow com Orquestração
- [x] Template `flow-main.yaml` v0.2.0 com 6 estágios (backlog, design, code, review, security, done)
- [x] Cada estágio declara `agents[]` (role IDs) e `gate`
- [x] Campo `preferredExecutor` por estágio (opcional, para composição)
- [x] Activity hints incluem comandos de handoff
- [x] Phases definem transições entre estados dentro do estágio

## AC4 — Protocolo de Handoff
- [x] Interface `HandoffPayload` definida com: itemId, from, to, summary, evidence, context, timestamp
- [x] Campo `handoff` adicionado ao tipo `Item` em workflow.json
- [x] Comando `letra flow handoff --to <agent> --summary '<text>'` emite handoff
- [x] Handoff salvo no item e emitido via múltiplos mecanismos (SSE + polling)
- [x] Handoff é invalidado se gate do estágio não foi aprovado
- [x] Handoff tem TTL (time-to-live) — expira após 30 minutos sem claim

## AC5 — Orchestrator Service
- [x] Classe `Orchestrator` registra executores
- [x] `detectPendingHandoff(agentId)` retorna handoff pendente com contexto
- [x] `emitHandoff(payload)` valida e salva handoff
- [x] `autoClaim(item, executor, agent)` claima item com lock atômico (CAS)
- [x] `buildContext(item, agent)` monta contexto enriquecido (snapshot + spec + diff + log)
- [x] `heartbeat(executorId)` registra que executor está vivo
- [x] `reclaimStaleItems()` libera itens sem heartbeat por > 60s

## AC6 — Executor Interface (Mínima)
- [x] Interface `AgenticExecutor` definida em `@letra/protocol`
- [x] Interface mínima: `id`, `capabilities`, `status`, `execute(context)`
- [x] Interface estendida (opcional): `onHandoff`, `collectEvidences`, `getContext`
- [x] Validação de capabilities do executor vs role do estágio
- [x] Fallback: se executor não implementa método opcional, Letra usa comportamento padrão

## AC7 — Executor Registry
- [x] Registro de executores em `executors/registry.yaml`
- [x] Suporta múltiplos executores com mesma capability
- [x] Estratégia de seleção: `preferred` (por estágio) > `round-robin` > `least-recently-used`
- [x] Fallback: se executor preferido offline, usa próximo disponível
- [x] Timeout: se executor não responde em 30s, marca como offline

## AC8 — Mecanismos de Notificação
- [x] SSE (Server-Sent Events) para executores web
- [x] Polling via `GET /api/handoff/pending?agent=<id>` para executores CLI/desktop
- [x] File watch: handoff salvo em `.letra/handoffs/<item-id>.json` para ferramentas que leem arquivos
- [x] Executor pode escolher mecanismo preferido no registro

## AC9 — Concorrência e Race Conditions
- [x] `autoClaim` usa Compare-And-Swap (CAS) para evitar race condition
- [x] Se dois executores claimam ao mesmo tempo, apenas um vence
- [x] Perdedor recebe mensagem de "item já claimado"
- [x] Lock expira após `maxExecutionTime` (configurável, padrão 30min)

## AC10 — Timeout e Recuperação
- [x] Cada executor tem `heartbeatInterval` (padrão 30s) e `heartbeatTimeout` (padrão 60s)
- [x] Se executor não envia heartbeat por > timeout, item é liberado automaticamente
- [x] `reclaimStaleItems()` roda a cada 60s e libera itens órfãos
- [x] Handoff expira após TTL (padrão 30min) se não for claimado
- [x] Retry: se executor falha, handoff é re-emitido para próximo executor disponível

## AC11 — Rollback de Handoff
- [x] Comando `letra flow handoff --rollback <item-id>` reverte último handoff
- [x] Rollback restaura `claimedBy` do agente anterior
- [x] Rollback registra no session-log com motivo
- [x] Rollback disponível apenas se novo agente não começou trabalho (sem diffs)

## AC12 — Session Log de Handoffs
- [x] Cada handoff registrado no session-log com tipo `handoff`
- [x] Entrada inclui: from, to, summary, evidence, executor, timestamp
- [x] `letra pulse` mostra handoff atual e próximo agente
- [x] Histórico de handoffs acessível via `letra log --filter handoff`

## AC13 — Migração de Items Existentes
- [x] Items sem campo `handoff` funcionam normalmente (handoff é opcional)
- [x] Items com `claimedBy` existente não são afetados
- [x] Script de migração não é necessário (backward compatible)

## AC15 — GateChecker Data-Driven
- [x] GateChecker lê `HarnessManifest.gates[]` como fonte de verdade
- [x] Nenhum switch hardcoded por `gateId` — comportamento derivado dos campos `type`, `blocking`, `decisions`
- [x] Gates customizados definidos no manifest são respeitados pelo GateChecker
- [x] GateChecker aceita caminho do harness como parâmetro (não hardcoded)
- [x] Gate YAML parsing usa js-yaml (não string inclusion)
- [x] Testes: gate customizado bloqueia handoff, gate com `blocking: "true"` (string) funciona

## AC16 — Runtime Wiring Completo
- [x] Orchestrator popular `ExecutorRegistry` a partir de `HarnessManifest.executors[]` no bootstrap
- [x] `flowInitQuick()` usa template `"flow-main"` (ou alias `sdlc → flow-main`)
- [x] `ExecutionContext.promptTemplate` preenchido a partir do role YAML do executor
- [x] `loadGateStatus()` busca gates em caminhos corretos (externo + default fallback)
- [x] Testes: executor customizado do YAML aparece no registry, prompt template chega ao contexto

## AC17 — Lock e Config Hardening
- [x] `autoClaim` usa file lock (`.letra/locks/<item-id>.lock`) em vez de Map in-memory
- [x] Lock é liberado em `finally` block (não só no happy path)
- [x] Handoff TTL lê `ttlMinutes` do role YAML (fallback: 30min)
- [x] `maxExecutionTime` lê do executor registry (fallback: 30min)
- [x] Testes: concorrência cross-process (dois processos claimam mesmo item)

## AC14 — Testes
- [x] Testes para harness v0.2.0 (roles com handoff, gates com blocksHandoff, executor registry)
- [x] Testes unitários para Orchestrator (detect, emit, claim, context, heartbeat, reclaim)
- [x] Testes para GateChecker com novos gates e blocksHandoff
- [x] Testes para handoff protocol (validação, atomicidade, TTL, expiry)
- [ ] Testes de concorrência (dois claims simultâneos — cross-process com file lock)
- [x] Testes de timeout (executor offline, item órfão)
- [ ] Teste de regressão: fluxo completo design->code->review->security->done
- [ ] Teste cross-adapter: handoff entre executores diferentes

## Progresso
- [x] AC1: 5/5 ✅
- [x] AC2: 4/4 ✅
- [x] AC3: 5/5 ✅
- [x] AC4: 6/6 ✅
- [x] AC5: 7/7 ✅
- [x] AC6: 5/5 ✅
- [x] AC7: 5/5 ✅
- [x] AC8: 4/4 ✅ (SSE + polling + file watch + registry choice)
- [x] AC9: 4/4 ✅
- [x] AC10: 5/5 ✅
- [x] AC11: 4/4 ✅
- [x] AC12: 4/4 ✅
- [x] AC13: 3/3 ✅
- [x] AC14: 4/8
- [x] AC15: 6/6 ✅ (Gap fixes)
- [x] AC16: 5/5 ✅ (Gap fixes)
- [x] AC17: 5/5 ✅ (Gap fixes)
- [ ] **Total: 82/84**
