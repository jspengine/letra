# Relatório de Melhoria do Harness — Análise Arquitetural

> Data: 2026-06-15
> Versão: v1.0
> Contexto: ITEM-34 a ITEM-39 concluídos; análise do gap entre diagnóstico e ação.

---

## Sumário Executivo

O harness de diagnóstico do Letra evoluiu de **6 detectores (self-diagnosis-core)** para **10 detectores**, com 168 testes (antes 130) e ciclo fechado de meta-validação. No entanto, a arquitetura revela **3 problemas estruturais** que impedem o salto de nota 5.5 → 8.5:

1. **Diagnóstico sem estado persistente** — sugestões são efêmeras, sem ciclo de vida (new → seen → acknowledged → dismissed)
2. **Duplicação de lógica de validação** em 3 sistemas paralelos (`lint.ts`, `validate.ts`, `detectores`) que não compartilham módulos
3. **Adaptadores sem consciência do diagnóstico** — AGENTS.md e correlatos não refletem pendências ativas

Este relatório detalha a arquitetura atual, as duplicações, a complexidade ciclomática, e propõe um plano de refatoração em **3 camadas** com impacto mínimo no código existente.

---

## 1. Arquitetura Atual — Mapeamento Completo

### 1.1 Três Sistemas de Validação Paralelos

```
                    ┌──────────────────┐
                    │   CLI Commands   │
                    │  (index.ts)      │
                    └────┬──┬──┬──┬───┘
                         │  │  │  │
              ┌──────────┘  │  │  └──────────────┐
              ▼             ▼  ▼                  ▼
       ┌──────────┐  ┌──────────┐  ┌─────────────────┐
       │ lint.ts  │  │validate  │  │  diagnose.ts    │
       │ (90 ln)  │  │ (956 ln) │  │  (59 ln)        │
       │          │  │          │  │                 │
       │seções    │  │heurísti- │  │ DiagnosticEngine│
       │tam.     │  │cas de    │  │ → 10 detectores │
       │checklist│  │conteúdo  │  │ → auto-fix      │
       └──────────┘  └──────────┘  └────────┬────────┘
                                            │
                    ┌───────────────────────┼───────────┐
                    ▼                       ▼           ▼
            ┌──────────────┐      ┌──────────────┐ ┌────────┐
            │  flow-serve  │      │   detectores │ │snap-   │
            │  (API)       │      │   (10 arqu.) │ │shots   │
            │              │      │              │ │        │
            │validação de  │      │ac-stale      │ │guarda  │
            │spec duplicada│      │ac-false-pos  │ │antes/  │
            │(igual lint)  │      │spec-code-drift│ │depois  │
            └──────────────┘      │...           │ └────────┘
                                  └──────────────┘
```

### 1.2 Duplicações Identificadas

| Código duplicado | Ocorre em | Linhas | Custo de manutenção |
|---|---|---|---|
| `searchInSource()` + `walkDir()` | `ac-stale.ts`, `ac-false-pos.ts`, `spec-code-drift.ts` | ~30 linhas × 3 = 90 linhas | ALTO — qualquer mudança no algoritmo de busca precisa replicar em 3 lugares |
| Leitura de specs (readdir + readFile) | `lint.ts`, `validate.ts`, `ac-stale`, `ac-false-pos`, `spec-code-drift`, `cross-spec-dep`, `stage-drift`, `harness-meta-test` | ~5 linhas cada × 8 = 40+ linhas | MÉDIO — padrão repetitivo, mas simples |
| Checagem de seções obrigatórias | `lint.ts:45-48` e `flow-serve.ts:318-377` | ~30 linhas | MÉDIO — lógica idêntica, duas implementações |
| Detecção de conflitos entre specs | `validate.ts:checkConflicts()` e `cross-spec-dep.ts` | ~50 linhas vs 108 linhas | BAIXO — abordagens diferentes (heuristic vs detector) |
| `escapeRegex()` | `ac-stale.ts:119-121` | 3 linhas | BAIXO — função trivial, mas deveria ser shared utility |

### 1.3 Complexidade Ciclomática (McCabe)

| Arquivo | Complexidade | Risco | Observação |
|---|---|---|---|
| `flow-serve.ts:handleRequest` | **~52** | Crítico | Um único método com ~30 branchs (if/else if por endpoint). Cada endpoint é simples, mas o routing linear é frágil. |
| `validate.ts:checkSpecContent` | **18** | Alto | Heurísticas aninhadas: min chars, terminologia, tom, drift temporal, cada uma com sub-checks. |
| `validate.ts:checkConflicts` | **12** | Moderado | Loop sobre specs × specs (O(n²)) com matching por label/conteúdo. |
| `engine.ts:runAll` | **14** | Moderado | Loop de detectores + branch de certainty/autoFix + try/catch triplo. |
| `snapshot-bloat.ts:run` | **6** | Baixo | Sequencial: load → serialize → check → warn/fix. |
| `harness-meta-test.ts:run` | **10** | Moderado | 3 verificações independentes (engine, snapshot, detectores), mas cada uma com sub-branchs. |
| `ac-stale.ts:run` | **4** | Baixo | Loop simples sobre specs + regex + searchInSource. |
| `formatters.ts:formatAdapterContent` | **7** | Moderado | 4 layers condicionais com formatos at/text diferentes. |
| `snapshot.ts:save` | **6** | Baixo | Sequencial com duplicate check. |

**Total estimado do sistema de diagnóstico: ~65 pontos de complexidade ciclomática.**

> Benchark: McCabe recomenda ≤ 10 por função. `handleRequest` (52) é o maior candidato a refatoração.

---

## 2. Análise Crítica: Problemas Estruturais

### 2.1 Diagnóstico sem Estado (P1 — Crítico)

**Problema:** Cada `runAll()` começa do zero. Não há memória entre sessões sobre:
- Quais sugestões o agente já viu
- Quais foram ignoradas/dismissadas
- Qual foi a decisão tomada

**Impacto:** As mesmas 15 sugestões aparecem a cada scan. O agente não sabe o que é novo vs. já analisado. Leva à fadiga e ignorância do diagnóstico.

**Evidência no código:**
```typescript
// engine.ts:118 — appliedFixes é resetado a cada runAll()
this.appliedFixes = newApplied;  // substitui, não acumula
```

### 2.2 Duplicação de Lógica de Busca (P2 — Moderado)

**Problema:** Três detectores (ac-stale, ac-false-pos, spec-code-drift) implementam `searchInSource()` + `walkDir()` idênticos. Qualquer bug ou melhoria (ex: incluir `dist/`, adicionar `.js` extension) precisa ser replicada.

**Evidência no código:**
```typescript
// ac-stale.ts:81-97
function searchInSource(rootDir: string, terms: string[]): boolean { ... }
function walkDir(dir: string): string[] { ... }

// ac-false-pos.ts:61-77 — idêntico
function searchInSource(rootDir: string, terms: string[]): boolean { ... }
function walkDir(dir: string): string[] { ... }

// spec-code-drift.ts:82-116 — idêntico
function searchInSource(rootDir: string, terms: string[]): boolean { ... }
function walkDir(dir: string): string[] { ... }
```

### 2.3 Adaptadores sem Diagnóstico (P3 — Moderado)

**Problema:** O AGENTS.md e demais adaptadores contêm contexto estático (workflow, ACs, foco) mas **nunca** incluem o estado atual do diagnóstico. O agente precisa saber que há pendências.

**Evidência no código:**
```typescript
// formatters.ts:106-126 — gera 4 layers, nenhuma de diagnóstico
function formatAdapterContent(snapshot, format, meta): string {
    return title + L1 + L2 + L3 + rules;
    // L1: context references
    // L2: workflow/items
    // L3: signals (AC count, tasks)
    // rules: standard instructions
}
```

### 2.4 flow-serve.ts com Routing Monolítico (P4 — Moderado)

**Problema:** `handleRequest()` é um único método com ~30 endpoints em cadeia if/else if. Viola o Princípio da Responsabilidade Única (SRP).

**Evidência no código:**
```typescript
// flow-serve.ts:141 — início do handleRequest
async handleRequest(req, res): Promise<void> {
    const { pathname } = new URL(req.url!, `http://${req.headers.host}`);
    if (pathname === "/events") { ... }
    else if (pathname === "/api/workflow" && req.method === "GET") { ... }
    else if (pathname === "/api/specs" && req.method === "GET") { ... }
    // ... ~27 mais else ifs ...
}
```

---

## 3. Proposta Arquitetural: Refatoração em 3 Camadas

### 3.1 Camada 1: Shared Utilities (Imediato)

Extrair código duplicado para módulos compartilhados:

```
packages/cli/src/
├── diagnostics/
│   ├── detectors/          ← mantém detectores, mas usando shared utils
│   └── shared/
│       ├── file-search.ts  ← searchInSource + walkDir (extraído de 3 detectores)
│       ├── spec-reader.ts  ← loadSpecs(), parseACs(), countACs()
│       └── state.ts        ← DiagnosticState persistence (novo)
├── adapters/
│   └── formatters.ts       ← + L5: diagnostics section
├── validation/             ← NOVO módulo
│   ├── structure.ts        ← required sections check (extraído de lint.ts)
│   ├── content.ts          ← heuristic checks (extraído de validate.ts)
│   └── index.ts
└── commands/
    ├── lint.ts             ← thin wrapper sobre validation/structure.ts
    ├── validate.ts         ← thin wrapper sobre validation/content.ts
    ├── flow-serve.ts       ← usa validation/structure.ts ao invés de duplicar
    └── diagnostics.ts      ← NOVO: família de subcomandos (scan, state, summary)
```

**Impacto:** Reduz duplicação, zero mudança de comportamento.

### 3.2 Camada 2: Diagnostic State (Curto Prazo)

Adicionar `DiagnosticState` persistente:

```typescript
// diagnostics/shared/state.ts

interface DiagnosticStateEntry {
    id: string;                    // diagnostic result ID
    firstSeenAt: string;           // ISO timestamp
    lastSeenAt: string;
    status: "new" | "seen" | "acknowledged" | "dismissed" | "resolved";
    dismissedReason?: string;
    autoFixApplied?: boolean;
    snapshotId?: string;
}

interface DiagnosticState {
    schemaVersion: 1;
    lastScanAt: string;
    entries: DiagnosticStateEntry[];
}
```

**Novas APIs REST:**
```
POST /api/diagnostics/state/ack/:id     → { status: "acknowledged" }
POST /api/diagnostics/state/dismiss/:id → { status: "dismissed", reason }
GET  /api/diagnostics/state             → DiagnosticState (novos vs. históricos)
```

**Integração com adaptadores:**

```typescript
// Adapter L5 — adicionado em formatters.ts
function formatDiagnostics(diagState: DiagnosticState): string {
    const newItems = diagState.entries.filter(e => e.status === "new");
    if (newItems.length === 0) return "";
    return [
        "## Pendências Detectadas",
        ...newItems.map(e => `- ${e.id}: pendente — use \`letra diagnostics ack ${e.id}\` ao revisar`),
    ].join("\n");
}
```

### 3.3 Camada 3: Routing Refactor (Médio Prazo)

Refatorar `flow-serve.ts:handleRequest` usando Router pattern:

```typescript
// flow-serve.ts
type RouteHandler = (req: IncomingMessage, res: ServerResponse, params: Record<string, string>) => Promise<void>;

const routes = new Map<string, RouteHandler>();
routes.set("GET /events", handleSSE);
routes.set("GET /api/workflow", handleGetWorkflow);
routes.set("GET /api/diagnostics", handleGetDiagnostics);
routes.set("POST /api/diagnostics/scan", handleDiagnosticsScan);
routes.set("POST /api/diagnostics/undo/:id", handleDiagnosticsUndo);
// ...

async handleRequest(req, res): Promise<void> {
    const { pathname } = new URL(req.url!, `http://${req.headers.host}`);
    const key = `${req.method} ${pathname}`;
    const handler = routes.get(key) || matchPattern(routes, key);
    if (handler) return handler(req, res, {});
    return this.serveClient(req, res);
}
```

**Impacto:** Complexidade ciclomática de 52 → 4 no handleRequest.

---

## 4. Consolidação: diagnose vs. doctor vs. diagnostics

**Decisão arquitetural:** Não criar um comando `doctor` separado. Unificar sob `letra diagnostics`.

| Subcomando | Função | Origem | Prioridade |
|---|---|---|---|
| `letra diagnostics scan` | Executa `runAll()` e imprime resultados | `diagnose.ts` existente | Imediato |
| `letra diagnostics state` | Mostra estado persistente (novo/acknowledged/dismissed) | Novo | Curto prazo |
| `letra diagnostics ack <id>` | Marca sugestão como reconhecida | Novo | Curto prazo |
| `letra diagnostics dismiss <id>` | Marca como ignorada com motivo | Novo | Curto prazo |
| `letra diagnostics summary` | Resumo formatado para injetar em adapters | Novo | Curto prazo |

**`letra diagnose`** continua como alias de `letra diagnostics scan` para backward compatibility.

**Por que não "doctor"?** Porque o conceito de "doctor" (diagnosticar + tratar + acompanhar) já é exatamente o que a família `diagnostics` faz, mas falta o "acompanhar" (state). Adicionar state completa o ciclo sem criar overlapping semântico.

---

## 5. Impacto da Melhoria

| Métrica | Atual | Após Camada 1 | Após Camada 2 | Após Camada 3 |
|---|---|---|---|---|
| Linhas duplicadas | ~160 | ~30 | ~30 | ~30 |
| Complexidade handleRequest | 52 | 52 | 52 | 4 |
| Detector code sharing | 0% | 100% | 100% | 100% |
| Sugestões persistentes | ❌ | ❌ | ✅ | ✅ |
| Adaptators com diagnóstico | ❌ | ❌ | ✅ | ✅ |
| Auto-clean focus.md | ❌ | ❌ | ✅ (via state) | ✅ |
| Manutenibilidade (MI) | ~65 | ~75 | ~80 | ~90 |

> MI = Maintainability Index estimado (escala 0-100). Cálculo baseado na redução de duplicação e complexidade ciclomática.

---

## 6. Especificações Propostas

### 6.1 Spec: `diagnostics-state` — Estado Persistente do Diagnóstico

**Outcome:** Sugestões de diagnóstico têm ciclo de vida (new → seen → acknowledged → dismissed). O agente e o usuário sabem o que já foi analisado e o que é novo.

**Acceptance Criteria:**
```
- [ ] DiagnosticState persiste em .letra/diagnostics-state.json
- [ ] engine.runAll() mergeia resultados com estado existente (novos vs. repetidos)
- [ ] POST /api/diagnostics/state/ack/:id marca sugestão como acknowledged
- [ ] POST /api/diagnostics/state/dismiss/:id marca como dismissed com reason
- [ ] GET /api/diagnostics/state retorna estado completo com metadados
- [ ] Sugestões "new" aparecem primeiro no output; "acknowledged" são ocultas por padrão
- [ ] Auto-fixes bem-sucedidos marcam entrada como "resolved"
```

**Certeza:** 1.0 — operações determinísticas de arquivo.

### 6.2 Spec: `diagnostics-adapter` — Diagnóstico nos Adaptadores

**Outcome:** AGENTS.md, .cursorrules etc. incluem seção de pendências ativas do diagnóstico.

**Acceptance Criteria:**
```
- [ ] Adapter L5 exibe {N} sugestões novas se houver pendências
- [ ] L5 incluído apenas quando há entradas "new" no DiagnosticState
- [ ] Formato compatível com at/text (mesmo padrão de L1-L4)
- [ ] Gerado via `generateAdapters()` sem nova dependência circular
- [ ] foco.md também recebe seção de diagnóstico se houver pendências críticas
```

**Certeza:** 1.0 — template string determinística.

### 6.3 Spec: `context-sync` — Sincronização Automática do Contexto

**Outcome:** `context.md` reflete o estado real do projeto sem edição manual.

**Acceptance Criteria:**
```
- [ ] letra context sync computa: contagem de testes (vitest run --reporter=json)
- [ ] letra context sync atualiza: estágio atual, data, itens correntes
- [ ] letra context sync NÃO sobrescreve seções manuais (Intent, Domínio, Porquês)
- [ ] Comando falha silenciosamente se vitest não estiver disponível
- [ ] Meta-test alerta se context.md desatualizado > 7 dias se não houver sync recente
```

**Certeza:** 0.9 — contagem de testes pode falhar em ambientes sem build.

### 6.4 Spec: `validation-consolidation` — Unificação da Validação

**Outcome:** `lint.ts`, `validate.ts`, e os detectores de diagnóstico compartilham módulos de validação comuns.

**Acceptance Criteria:**
```
- [ ] validation/structure.ts exporta checkRequiredSections(), checkSpecLength(), checkChecklist()
- [ ] lint.ts é thin wrapper sobre validation/structure.ts (mesmo output, menos código)
- [ ] flow-serve.ts:validateSpec usa validation/structure.ts ao invés de lógica inline
- [ ] validation/content.ts exporta checkSpecContent(), checkConflicts()
- [ ] validate.ts é thin wrapper sobre validation/content.ts
- [ ] diagnostics/shared/file-search.ts exporta searchInSource(), walkDir()
- [ ] ac-stale.ts, ac-false-pos.ts, spec-code-drift.ts importam de file-search.ts
- [ ] Zero mudança de comportamento em lint/validate CLI output
- [ ] Testes existentes continuam passando sem modificação
```

**Certeza:** 1.0 — refatoração puramente mecânica (extrair e importar).

---

## 7. Plano de Implementação

| Fase | Spec | Depende de | Esforço estimado | Risco |
|---|---|---|---|---|
| 1 | validation-consolidation | Nenhuma | 4h | Baixo — extração mecânica |
| 2 | diagnostics-state | Nenhuma | 3h | Baixo — novo arquivo, sem modificar engine |
| 3 | diagnostics-adapter | diagnostics-state | 2h | Médio — integration com adapter pipeline |
| 4 | context-sync | Nenhuma | 2h | Baixo — comando autônomo |
| 5 | Routing refactor (flow-serve) | Nenhuma | 3h | Alto — mexe em handleRequest, core do servidor |

**Ordem recomendada:** 1 → 2 → 3 → 4 → 5

---

## 8. Manutenção do Código Limpo

### 8.1 Padrões a Seguir

- **Módulos shared** em `diagnostics/shared/` e `validation/` — exportam funções puras, sem estado
- **Detectores** mantêm responsabilidade única: cada detector faz UMA coisa
- **Commands** são thin wrappers (< 100 linhas) que orquestram, não implementam lógica
- **Adapters** continuam template-driven (formatters.ts gera strings, sem lógica de negócio)

### 8.2 Anti-padrões a Eliminar

| Anti-padrão | Onde | Solução |
|---|---|---|
| Duplicação de searchInSource/walkDir | 3 detectores | Extrair para shared/file-search.ts |
| Routing monolítico | flow-serve.ts:handleRequest | Router Map pattern |
| Validação inline duplicada | flow-serve.ts (spec validation) | Usar validation/structure.ts |
| Lógica de AC counting espalhada | ac-counter.ts + ac-stale + ac-false-pos + stage-drift | Centralizar em shared/spec-reader.ts |

### 8.3 Guia de Complexidade

- Funções com cyclo > 10: **devem ser refatoradas**
- Arquivos com cyclo total > 30: **candidatos a splitting**
- Novos detectores: máximo 80 linhas, cyclo < 6
- Commands CLI: máximo 100 linhas (thin wrapper pattern)
- Shared modules: funções puras, sem efeito colateral, testáveis isoladamente

---

## 9. Conclusão

O harness atual tem **boa cobertura de detecção** mas **falta pipeline de ação**. A refatoração proposta não muda o modelo existente — ela adiciona camadas sobre ele:

1. **Shared utilities** reduzem duplicação e melhoram manutenibilidade
2. **Diagnostic state** fecha o ciclo do diagnóstico: detectar → persistir → agir → acompanhar
3. **Adapter integration** empurra o diagnóstico para onde o agente já olha (AGENTS.md)
4. **Routing refactor** reduz complexidade do servidor

O impacto no código existente é **mínimo**: nenhum detector precisa ser reescrito, nenhum comando muda de comportamento. As mudanças são aditivas (novos módulos, novos endpoints) e extrativas (mover código duplicado para shared modules).

**Nota do harness após refatoração: 5.5 → 8.5**
