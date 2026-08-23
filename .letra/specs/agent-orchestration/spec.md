# Spec: agent-orchestration

> Updated: 2026-08-23
> Revisão v3: Implementation gaps documentados (AC15-AC17) — 8 gaps críticos a fechar

## Outcome

Letra se torna o orquestrador de um time de agentes e humanos. Agentes trabalham em estágios do workflow, passam o bastão entre si via handoff, e humanos decidem nos gates críticos. Qualquer ferramenta agêntica (OpenCode, Cursor, Claude Code, Windsurf, Codex, etc.) pode ser um executor — basta implementar uma interface mínima. O harness define as personas, seus papéis, habilidades e regras de handoff. O orchestrator (parte do Letra) gerencia o ciclo de vida: detecta handoffs, fornece contexto, claima itens, e notifica executores via múltiplos mecanismos (SSE, polling, file watch).

## Constraints

1. **Letra é o orquestrador** — define o quê, quando, para quem. Executores fazem o como.
2. **Humanos decidem nos gates** — nenhum gate `type: human` é pulado por agente.
3. **Handoff é atômico** — um item só pode ter um handoff pendente por vez.
4. **Executor é plugável** — qualquer ferramenta que implemente a interface mínima pode executar.
5. **Harness é versionado** — mudanças em roles/gates/flows são versionadas e auditáveis.
6. **Um agente por vez** — um item só pode ter um `claimedBy` simultâneo (com lock atômico).
7. **Evidências são obrigatórias** — todo handoff deve incluir evidências do trabalho feito.
8. **Constituição é não-negociável** — agentes seguem as 7 princípios constitucionais.
9. **Fallback é obrigatório** — toda operação deve ter um caminho de falha definido.
10. **Timeout é obrigatório** — nenhum item pode ficar bloqueado para sempre.

## Exclusions

- Troca de LLMs específicas (quem roda por trás do agente é decisão do executor)
- Gerenciamento de tokens ou custos de LLM
- Treinamento de modelos
- UI de configuração de agentes (futuro)
- Multi-tenancy (vários usuários ao mesmo tempo)
- Implementação de adapters específicos (cada adapter é um projeto separado)

## Acceptance Criteria

### AC1 — Roles do Harness ✅
- [x] Arquivos YAML em `harness/v0.2.0/roles/` definem: analyst, implementer, reviewer, security
- [x] Cada role tem: id, label, description, allowedStages, capabilities, handoff, constraints
- [x] Campo `prompt-template` é Opcional e aceita referência a arquivo (não inline YAML)
- [x] Loader de roles atualizado para ler handoff config
- [x] Tipo `AgentCapability` em `harness/types.ts` inclui campo `handoff`

### AC2 — Gates do Harness ✅
- [x] Gates definidos: spec-approved (human), code-reviewed (automated), security-clear (automated), human-approved (human)
- [x] Cada gate tem: id, name, type, blocking, decisions (approve/request-changes/reject)
- [x] GateChecker valida gates automáticos e bloqueia handoffs sem aprovação
- [x] Campo `blocksHandoff` permite definir se gate bloqueia handoff (não só avanço de estágio)

### AC3 — Flow com Orquestração ✅
- [x] Template `flow-main.yaml` v0.2.0 com 6 estágios (backlog, design, code, review, security, done)
- [x] Cada estágio declara `agents[]` (role IDs) e `gate`
- [x] Campo `preferredExecutor` por estágio (opcional, para composição)
- [x] Activity hints incluem comandos de handoff
- [x] Phases definem transições entre estados dentro do estágio

### AC4 — Protocolo de Handoff ✅
- [x] Interface `HandoffPayload` definida com: itemId, from, to, summary, evidence, context, timestamp
- [x] Campo `handoff` adicionado ao tipo `Item` em workflow.json
- [x] Comando `letra flow handoff --to <agent> --summary '<text>'` emite handoff
- [x] Handoff salvo no item e emitido via múltiplos mecanismos (SSE + polling)
- [x] Handoff é invalidado se gate do estágio não foi aprovado
- [x] Handoff tem TTL (time-to-live) — expira após 30 minutos sem claim

### AC5 — Orchestrator Service ✅
- [x] Classe `Orchestrator` registra executores
- [x] `detectPendingHandoff(agentId)` retorna handoff pendente com contexto
- [x] `emitHandoff(payload)` valida e salva handoff
- [x] `autoClaim(item, executor, agent)` claima item com lock atômico (CAS)
- [x] `buildContext(item, agent)` monta contexto enriquecido (snapshot + spec + diff + log)
- [x] `heartbeat(executorId)` registra que executor está vivo
- [x] `reclaimStaleItems()` libera itens sem heartbeat por > 60s

### AC6 — Executor Interface (Mínima) ✅
- [x] Interface `AgenticExecutor` definida em `@letra/protocol`
- [x] Interface mínima: `id`, `capabilities`, `status`, `execute(context)`
- [x] Interface estendida (opcional): `onHandoff`, `collectEvidences`, `getContext`
- [x] Validação de capabilities do executor vs role do estágio
- [x] Fallback: se executor não implementa método opcional, Letra usa comportamento padrão

### AC7 — Executor Registry ✅
- [x] Registro de executores em `executors/registry.yaml`
- [x] Suporta múltiplos executores com mesma capability
- [x] Estratégia de seleção: `preferred` (por estágio) > `round-robin` > `least-recently-used`
- [x] Fallback: se executor preferido offline, usa próximo disponível
- [x] Timeout: se executor não responde em 30s, marca como offline

### AC8 — Mecanismos de Notificação
- [ ] SSE (Server-Sent Events) para executores web
- [ ] Polling via `GET /api/handoff/pending?agent=<id>` para executores CLI/desktop
- [x] File watch: handoff salvo em `.letra/handoffs/<item-id>.json` para ferramentas que leem arquivos
- [ ] Executor pode escolher mecanismo preferido no registro

### AC9 — Concorrência e Race Conditions ✅
- [x] `autoClaim` usa Compare-And-Swap (CAS) para evitar race condition
- [x] Se dois executores claimam ao mesmo tempo, apenas um vence
- [x] Perdedor recebe mensagem de "item já claimado"
- [x] Lock expira após `maxExecutionTime` (configurável, padrão 30min)

### AC10 — Timeout e Recuperação ✅
- [x] Cada executor tem `heartbeatInterval` (padrão 30s) e `heartbeatTimeout` (padrão 60s)
- [x] Se executor não envia heartbeat por > timeout, item é liberado automaticamente
- [x] `reclaimStaleItems()` roda a cada 60s e libera itens órfãos
- [x] Handoff expira após TTL (padrão 30min) se não for claimado
- [x] Retry: se executor falha, handoff é re-emitido para próximo executor disponível

### AC11 — Rollback de Handoff ✅
- [x] Comando `letra flow handoff --rollback <item-id>` reverte último handoff
- [x] Rollback restaura `claimedBy` do agente anterior
- [x] Rollback registra no session-log com motivo
- [x] Rollback disponível apenas se novo agente não começou trabalho (sem diffs)

### AC12 — Session Log de Handoffs ✅
- [x] Cada handoff registrado no session-log com tipo `handoff`
- [x] Entrada inclui: from, to, summary, evidence, executor, timestamp
- [x] `letra pulse` mostra handoff atual e próximo agente
- [x] Histórico de handoffs acessível via `letra log --filter handoff`

### AC13 — Migração de Items Existentes ✅
- [x] Items sem campo `handoff` funcionam normalmente (handoff é opcional)
- [x] Items com `claimedBy` existente não são afetados
- [x] Script de migração não é necessário (backward compatible)

### AC14 — Testes
- [x] Testes unitários para Orchestrator (detect, emit, claim, context, heartbeat, reclaim)
- [x] Testes para GateChecker com novos gates e blocksHandoff
- [x] Testes para handoff protocol (validação, atomicidade, TTL, expiry)
- [ ] Testes de concorrência (dois claims simultâneos)
- [x] Testes de timeout (executor offline, item órfão)
- [ ] Teste de regressão: fluxo completo design->code->review->security->done
- [ ] Teste cross-adapter: handoff entre executores diferentes

## Context

### Problema

Hoje o Letra gerencia workflow (estágios, items, specs) mas não gerencia quem executa o trabalho. OpenCode executa ações de forma autônoma, sem um protocolo claro de:
- Quem deve fazer o que em cada estágio
- Quando passar o bastão para outro agente
- Como o próximo agente sabe o que fazer
- Quando parar para aprovação humana
- O que acontece quando o executor está offline
- Como recuperar de falhas

Isso cria um gap entre governança (Letra) e execução (executores).

### Solução: Letra como Orquestrador

Letra se torna o cérebro que define o fluxo de trabalho do time de agentes:

```
LETRA (Orquestrador)              EXECUTORES (Mãos)
─────────────────────              ──────────────────
Define QUEM faz o QUE              Fazem COMO
Detecta HANDOFFS                   Disparam sessões
Fornece CONTEXTO                   Coletam evidências
Valida GATES                       Claimam itens
Preserva ESTADO                    Executam comandos
Detecta FALHAS                     Reportam status
Recupera ITENS                     Envia heartbeat
```

### Time de Agentes

| Persona | Tipo | Estágios | Responsabilidade | Regras |
|---------|------|----------|------------------|--------|
| **Analyst** | Agente | Design | Analisa spec, cria ACs, define contexto | Nunca implementa código |
| **Implementer** | Agente | Code | Escreve código, implementa ACs | Nunca aprova próprio trabalho |
| **Reviewer** | Agente | Review | Revisa aderência, qualidade, regressão | Nunca implementa correções |
| **Security** | Agente | Security | Análise de segurança, vulnerabilidades | Nunca implementa correções |
| **Human** | Supervisor | Todos (gates) | Decisão final, aprovação | Único que move entre estágios com gate |

### Fluxo de Handoff

```
1. ANALYST (Design)
   ├─ Lê: constitution.md, glossary.md, context.md
   ├─ Cria: spec.md com Outcome + Constraints + ACs
   └─ HANDOFF → implementer
       "Spec criada. ACs definidos. Aguardando implementação."

2. IMPLEMENTER (Code)
   ├─ Lê: spec.md (ACs), código existente
   ├─ Implementa: AC por AC, marcando `letra ac done`
   ├─ Roda: `letra validate`
   └─ HANDOFF → reviewer
       "AC1-AC5 implementados. Validação OK."

3. REVIEWER (Review)
   ├─ Lê: spec.md, diff do código
   ├─ Verifica: aderência, testes, regressão
   ├─ SE aprovado:
   │   HANDOFF → security
   │   "Review aprovado. Enviando para security."
   └─ SE reprovado:
       HANDOFF → implementer
       "Review reprovado. Problemas: [lista]"

4. SECURITY (Security)
   ├─ Analisa: vulnerabilidades, secrets, dependências
   ├─ SE aprovado:
   │   HANDOFF → human
   │   "Segurança OK. Aguardando aprovação humana."
   └─ SE vulnerabilidade:
       HANDOFF → implementer
       "Vulnerabilidade: [desc]"

5. HUMAN (Gate)
   ├─ Decide: approve / request-changes / reject
   ├─ SE aprovado:
   │   Item avança para Done
   └─ SE rejeitado:
       Volta para Analyst ou Implementer
```

### Arquitetura: Harness v2

```
.hletra/harness/v0.2.0/
├── flows/
│   └── flow-main.yaml          ← fluxo de trabalho
├── roles/
│   ├── analyst.yaml
│   ├── implementer.yaml
│   ├── reviewer.yaml
│   └── security.yaml
├── gates/
│   ├── spec-approved.yaml
│   ├── code-reviewed.yaml
│   ├── security-clear.yaml
│   └── human-approved.yaml
├── policies/
│   └── default.yaml
└── executors/
    └── registry.yaml
```

### Arquitetura: Orchestrator

```
LETRA CORE (Governança + Orquestração)
├── Workflow engine        → quem está fazendo o quê
├── Harness                → quais roles existem
├── Agent direction        → o que cada agente deve fazer
├── Handoff protocol       → quando passar o bastão           [NOVO]
├── Executor registry      → quais ferramentas podem executar [NOVO]
├── Context management     → o que cada agente precisa ler    [NOVO]
├── Heartbeat monitor      → quem está vivo                   [NOVO]
├── Timeout reclaimer      → recupera itens órfãos            [NOVO]
├── Gate system            → quando parar para aprovação
└── Session log            → rastreabilidade

EXECUTOR LAYER (Plugável)
├── Interface: AgenticExecutor (mínima)
├── Interface: RichAgenticExecutor (estendida, opcional)
├── OpenCode Adapter
├── Cursor Adapter
├── Claude Code Adapter
├── Windsurf Adapter
└── Qualquer futuro executor
```

### Arquitetura: Executor Interface

```typescript
// Interface mínima (OBRIGATÓRIA para qualquer executor)
interface AgenticExecutor {
  id: string;
  label: string;
  capabilities: string[];
  status: "online" | "offline";
  
  // Obrigatório: executar trabalho
  execute(context: ExecutionContext): Promise<ExecutionResult>;
}

// Interface estendida (OPCIONAL — implementar para enriquecer)
interface RichAgenticExecutor extends AgenticExecutor {
  // Opcional: escutar handoffs (se suporta SSE/polling)
  onHandoff?(handoff: HandoffEvent): Promise<void>;
  
  // Opcional: coletar evidências (se tem acesso a diffs)
  collectEvidences?(item: Item): Promise<Evidence[]>;
  
  // Opcional: buscar contexto (se tem UI para mostrar)
  getContext?(item: Item): Promise<AgentContext>;
  
  // Opcional: enviar heartbeat (se suporta conexão persistente)
  heartbeat?(): Promise<void>;
}

// Contexto de execução (Letra monta, executor recebe)
interface ExecutionContext {
  itemId: string;
  item: Item;
  agent: string;
  stage: string;
  spec: string | null;
  diff: string | null;
  snapshot: AgentDirectionSnapshot;
  sessionLog: SessionEntry[];
  commands: string[];
  prohibitions: string[];
}

// Resultado de execução (executor retorna, Letra interpreta)
interface ExecutionResult {
  success: boolean;
  output: string;
  artifacts: string[];        // arquivos criados/modificados
  evidences: string[];        // evidências coletadas
  handoff?: HandoffEvent;     // se quer passar para próximo agente
  error?: string;             // se falhou
}
```

### Arquitetura: Executor Registry

```yaml
# executors/registry.yaml
executors:
  - id: opencode
    label: OpenCode
    capabilities: [code, review, design, security]
    notification: [sse, polling]    # mecanismos suportados
    heartbeat: true
    maxExecutionTime: 1800          # 30min
    priority: 1                     # prioridade para seleção

  - id: cursor
    label: Cursor
    capabilities: [code, review]
    notification: [file-watch]      # só file watch
    heartbeat: false
    maxExecutionTime: 3600          # 60min
    priority: 2

  - id: claude-code
    label: Claude Code
    capabilities: [code, review, design]
    notification: [polling]         # só polling
    heartbeat: false
    maxExecutionTime: 1800
    priority: 3

# Seleção de executor por estágio (opcional)
stageExecutorPreferences:
  design: [opencode, claude-code]
  code: [opencode, cursor, claude-code]
  review: [cursor, opencode]
  security: [opencode]
```

### Arquitetura: Handoff com Fallback

```
AGENTE A termina
    │
    ├─ 1. Emite handoff (comando ou API)
    │   { from, to, summary, evidence }
    │
    ├─ 2. Letra valida:
    │   - Handoff é válido (stage → role mapping)
    │   - Gate do estágio foi aprovado (se blocksHandoff: true)
    │   - Próximo agente tem capability
    │
    ├─ 3. Letra salva no item:
    │   item.handoff = { ..., expiresAt: now + 30min }
    │
    ├─ 4. Letra notifica (múltiplos mecanismos):
    │   ├─ SSE: { type: "handoff", item, to: "reviewer" }
    │   ├─ Polling: item disponível em GET /api/handoff/pending
    │   └─ File: .letra/handoffs/ITEM-78.json
    │
    └─ 5. Executor detecta:
        ├─ Claima item (CAS atômico)
        ├─ Lê contexto (spec, diff, snapshot)
        └─ Inicia execução

FALLBACK (se executor não claima em 30min):
    │
    ├─ 1. Handoff expira (expiresAt < now)
    ├─ 2. Letra busca próximo executor com mesma capability
    ├─ 3. Re-emite handoff para novo executor
    └─ 4. Registra no session-log: "Handoff re-emitido (fallback)"

FALLBACK (se executor está offline):
    │
    ├─ 1. Heartbeat timeout (> 60s sem heartbeat)
    ├─ 2. Executor marcado como offline
    ├─ 3. Itens claimed pelo executor são liberados
    └─ 4. Próximo heartbeat re-registra executor como online
```

### Arquitetura: Concorrência (CAS)

```
DOIS EXECUTORES tentam claimar ao mesmo tempo:

Executor A: CAS(itemId, null, "opencode")
  → Sucesso: claimedBy = "opencode"

Executor B: CAS(itemId, null, "cursor")
  → Falha: claimedBy já é "opencode"
  → Resposta: { error: "Item já claimado por outro executor" }
```

### Arquitetura: Timeout e Reclaim

```
HEARTBEAT MONITOR (roda a cada 60s):

1. Para cada executor registrado:
   ├─ Se heartbeatEnabled E último heartbeat > timeout:
   │   Executor marcado como offline
   │   Itens claimed liberados
   │   Handoffs re-emitidos para outros executores
   └─ Senão: nada a fazer

2. Para cada handoff pendente:
   ├─ Se expiresAt < now:
   │   Handoff expirado
   │   Re-emitido para próximo executor
   │   Registrado no session-log
   └─ Senão: nada a fazer

3. Para cada item claimed:
   ├─ Se claimedAt > maxExecutionTime:
   │   Item considerado órfão
   │   claimedBy removido
   │   Registrado no session-log
   └─ Senão: nada a fazer
```

### Separação de Responsabilidades

| Quem | Responsabilidade | Tecnologia |
|------|-----------------|------------|
| **Letra** | Detectar handoff válido | Server-side, workflow state |
| **Letra** | Salvar handoff no item | workflow.json |
| **Letra** | Notificar executor | SSE + Polling + File |
| **Letra** | Fornecer contexto ao agente | API `/api/agent/direction` |
| **Letra** | Validar gates antes de avançar | Gate checker |
| **Letra** | Monitorar heartbeats | Cron job a cada 60s |
| **Letra** | Reclaim de itens órfãos | Timeout reclaimer |
| **Letra** | Selecionar executor | Registry + preferências |
| **Executor** | Escutar handoffs | SSE / Polling / File |
| **Executor** | Disparar agente destino | Sessão com contexto |
| **Executor** | Claimar item | POST `/api/items/:id/claim` (CAS) |
| **Executor** | Coletar evidências | Diff, logs, testes (opcional) |
| **Executor** | Enviar heartbeat | Periodic heartbeat (opcional) |
| **Agente** | Executar trabalho | LLM + tools |
| **Agente** | Emitir handoff quando terminar | `letra flow handoff` |
| **Humano** | Decidir nos gates | UI ou CLI |

### Cross-Adapter: Como Funciona na Prática

```
CENÁRIO 1: Tudo no OpenCode
  Design → OpenCode (analyst)
  Code → OpenCode (implementer)
  Review → OpenCode (reviewer)
  Security → OpenCode (security)

CENÁRIO 2: Misto (OpenCode + Cursor)
  Design → OpenCode (analyst)
  Code → OpenCode (implementer)
  Review → Cursor (reviewer) ← Cursor tem melhor diff viewer
  Security → OpenCode (security)

CENÁRIO 3: Fallback (executor offline)
  Design → OpenCode (analyst)
  Code → OpenCode (implementer)
  Review → Cursor (offline) → Fallback para OpenCode
  Security → OpenCode (security)
```

### Vantagens desta Arquitetura

| Vantagem | Descrição |
|----------|-----------|
| **Agnóstico** | Letra não depende de nenhuma ferramenta específica |
| **Componível** | Pode trocar executor por estágio |
| **Resiliente** | Fallback, timeout, retry, heartbeat |
| **Rastreável** | Cada handoff tem evidência e timestamp |
| **Seguro** | Gates bloqueiam avanço sem aprovação |
| **Concorrente** | CAS previne race conditions |
| **Extensível** | Novas personas só exigem novo YAML |
| **Versionado** | Harness é versionado, mudanças são auditáveis |

## Implementation Gaps

A análise de código da implementação atual revelou **8 gaps críticos** que precisam ser fechados antes de fechar a spec.

### Gap 1 — GateChecker hardcoded, ignora HarnessManifest

**Problema**: `GateChecker` usa um `switch` hardcoded por `gateId` para definir comportamento. Gates definidos no `HarnessManifest.gates[]` são silenciosamente ignorados.

**Impacto**: Se usuário adiciona um gate customizado no YAML, o GateChecker passa direto — nunca bloqueia.

**Solução**: GateChecker deve ler `HarnessManifest.gates[]` e derivar comportamento dos campos `type`, `blocking`, e `decisions` do YAML. Nenhum switch hardcoded.

### Gap 2 — ExecutorRegistry descontinado do runtime

**Problema**: `HarnessManifest.executors[]` é carregado pelo loader mas **nunca consumido**. O Orchestrator não popula o registry a partir do manifest. Os 3 executores hardcoded (`opencode`, `cursor`, `claude-code`) são os únicos disponíveis.

**Impacto**: Novo executor adicionado no YAML não aparece no runtime.

**Solução**: Orchestrator deve popular `ExecutorRegistry` a partir de `HarnessManifest.executors[]` durante o bootstrap.

### Gap 3 — prompt-template carregado mas nunca consumido

**Problema**: Role YAML aceita `prompt-template` como campo opcional. O loader lê e armazena. Nenhum código depois consome esse valor — o agente nunca recebe o prompt template.

**Impacto**: Persona customizada via prompt template não funciona.

**Solução**: `ExecutionContext` deve incluir `promptTemplate: string | null`. Orchestrator preenche a partir do role YAML quando monta contexto.

### Gap 4 — flowInitQuick usa template errado

**Problema**: `flowInitQuick()` usa template ID `"sdlc"` mas o harness v0.2.0 só tem `"flow-main"`. Cai no fallback hardcoded com stages incorretos.

**Impacto**: Workflow inicializado com `letra init` não usa harness v0.2.0.

**Solução**: Corrigir para `"flow-main"` ou adicionar alias `sdlc → flow-main` no harness.

### Gap 5 — GateChecker busca gates no path errado

**Problema**: `loadGateStatus()` procura gates em `join(getLetraDir(root), "harness", "gates")` mas os default gates ficam em `packages/cli/src/harness/default/v0.2.0/gates/`.

**Impacto**: Em produção, gates default não são encontrados — status sempre vazio.

**Solução**: GateChecker deve aceitar caminho do harness como parâmetro ou buscar em múltiplos locais (externo + default).

### Gap 6 — autoClaim usa Map in-memory (não cross-process)

**Problema**: `Orchestrator.autoClaim()` usa `Map<string, {claimedBy, claimedAt}>` em memória. Se dois processos Letra rodando, cada um tem seu Map — CAS não funciona.

**Impacto**: Dois executores claimam o mesmo item simultaneamente sem conflito.

**Solução**: Usar file lock (`.letra/locks/<item-id>.lock`) ou SQLite para state compartilhado entre processos.

### Gap 7 — Handoff TTL hardcoded, ignora role YAML

**Problema**: TTL de handoff é hardcoded para 30 minutos em `flow-handoff.ts`. O campo `handoff.ttlMinutes` do role YAML é ignorado.

**Impacto**: Roles com TTL diferente (ex: security com 60min) não são respeitados.

**Solução**: Ler `ttlMinutes` do role YAML do executor destino. Fallback: 30min.

### Gap 8 — Gate YAML parsing frágil

**Problema**: GateChecker parseia campos booleanos por inclusion string (`line.includes("blocking: true")`). Quebra com strings quotes (`"true"`), uppercase (`True`), ou YAML condicional.

**Impacto**: Gate com `blocking: "true"` (string) ou `blocking: True` é tratado como não-bloqueante.

**Solução**: Usar parser YAML adequado (js-yaml) em vez de string matching. Gate YAML já é parseado pelo loader — reaproveitar.

## New Acceptance Criteria (Gaps)

### AC15 — GateChecker Data-Driven ✅

- [x] GateChecker lê `HarnessManifest.gates[]` como fonte de verdade
- [x] Nenhum switch hardcoded por `gateId` — comportamento derivado dos campos `type`, `blocking`, `decisions`
- [x] Gates customizados definidos no manifest são respeitados pelo GateChecker
- [x] GateChecker aceita caminho do harness como parâmetro (não hardcoded)
- [x] Gate YAML parsing usa js-yaml (não string inclusion)
- [x] Testes: gate customizado bloqueia handoff, gate com `blocking: "true"` (string) funciona

### AC16 — Runtime Wiring Completo ✅

- [x] Orchestrator popular `ExecutorRegistry` a partir de `HarnessManifest.executors[]` no bootstrap
- [x] `flowInitQuick()` usa template `"flow-main"` (ou alias `sdlc → flow-main`)
- [x] `ExecutionContext.promptTemplate` preenchido a partir do role YAML do executor
- [x] `loadGateStatus()` busca gates em caminhos corretos (externo + default fallback)
- [x] Testes: executor customizado do YAML aparece no registry, prompt template chega ao contexto

### AC17 — Lock e Config Hardening ✅

- [x] `autoClaim` usa file lock (`.letra/locks/<item-id>.lock`) em vez de Map in-memory
- [x] Lock é liberado em `finally` block (não só no happy path)
- [x] Handoff TTL lê `ttlMinutes` do role YAML (fallback: 30min)
- [x] `maxExecutionTime` lê do executor registry (fallback: 30min)
- [x] Testes: concorrência cross-process (dois processos claimam mesmo item)