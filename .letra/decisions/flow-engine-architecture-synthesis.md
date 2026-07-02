# Flow Engine Architecture Synthesis — Workspace, SDLC Flow, Métricas

**Date**: 2026-06-21
**Status**: Draft (proposal para discussão)
**Merges**: architecture-agnostic · harness-composition-model · write-sync-single-source-of-truth · ux-redesign-ai-memory-hub

---

## Context

O Letra cresceu de um experimento de formatação de contexto para agentes de IA em um framework SDD com CLI, web UI, 6 adapters de ferramentas, sistema de diagnose e validação, e SSE real-time. Esse crescimento expôs 4 gaps arquiteturais que precisam ser resolvidos juntos — não isoladamente:

### Gap 1 — Flow Engine É Dado, Não Comportamento

Hoje `workflow.json` contém só dados: `stages[]`, `items[]`, `specLinks{}`. Não há:
- Definição de validações entre estágios (gates)
- Transições configuráveis (quem pode mover para onde)
- Métricas atreladas a transições de estágio
- Contexto de harness adaptado por estágio
- Capacidade de exportar/importar fluxo como **template reutilizável**

`flow export` e `flow import` existem (ITEM-14, Done) mas copiam só o JSON bruto — não exportam *comportamento*.

### Gap 2 — Flow é Máquina de Estados, Não Pipeline Linear

O Code Review de verdade não é um estágio único com gate humano. É um **sub-fluxo**:

```
Code → Auto Review (agente encontra issues) → Code Fix (agente corrige)
  → Re-Review (agente verifica) → Relatório Final → Human Review (humano decide)
                                                      │          │
                                              Aprova → Done     ↓
                                                    Rejeita → Code Fix (loop)
```

Cada estágio pode conter **fases internas** com transições próprias, gates automáticos e humanos, produção de artefatos (relatórios, findings), e regeneração de harness contextual. O flow engine precisa suportar **estados aninhados**, não só uma lista linear de estágios.

### Gap 3 — SDLC Flow É o Primeiro Caso de Uso Real

O flow atual (Backlog → Design → Code → Review → Done) é genérico e não reflete o ciclo real de desenvolvimento de software que queremos otimizar:

```
Backlog → Spec Draft → Spec Review (humano) → Code → Code Review (humano) → Security → PR/Push → Done
```

Este fluxo tem **gates humanos** (spec review, code review) onde o valor é medido:
- Quanto tempo o item espera por revisão?
- Quantas vezes a spec muda depois de aprovada?
- Quantos issues de segurança são pegos antes do merge?

Sem métricas, não provamos que o Letra adiciona valor. Sem um flow engine que suporte gates, não conseguimos modelar o ciclo real.

### Gap 3 — Workspace Precisa Ser Separado dos Projetos

Hoje `.letra/` vive dentro do diretório do projeto. Isso quebra em 3 cenários:
- Feature que atravessa múltiplos microsserviços
- Projetos não-software (campanha, pesquisa) que não querem `.letra/` no diretório
- Usuário que coordena múltiplos projects com um workspace

A spec `architecture-agnostic` (ITEM-40, Backlog) já define workspace isolado + targets. O schema `workspace.schema.json` já existe. Mas **falta o UX journey** — como o usuário configura isso na prática.

### Gap 4 — Harness Precisa Ser Contextual por Estágio

Hoje o harness (adapter files) é igual em todo estágio. Num fluxo SDLC:
- No **Spec Review**: o adapter deve guiar o revisor humano (perguntar "a spec define ACs mensuráveis?")
- No **Code Review**: o adapter deve guiar o revisor de código (perguntar "segue a spec? testes passam?")
- No **Security**: o adapter deve mencionar ferramentas de segurança

Cada estágio precisa de **instruções diferentes no adapter**, não o mesmo template L1-L4.

---

## Síntese: Os Quatro Pilares

```
┌──────────────────────────────────────────────────────────────────┐
│                      LETRA ARCHITECTURE v2                        │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────────┐                                         │
│  │  1. FLOW ENGINE      │  Pluggable, template-driven,           │
│  │     ABSTRACTION      │  exportável/importável,                │
│  │                      │  com gates + métricas                  │
│  └──────────┬──────────┘                                         │
│             │                                                     │
│  ┌──────────▼──────────┐                                         │
│  │  2. SDLC FLOW        │  Primeiro template built-in:           │
│  │     TEMPLATE         │  backlog → spec → review → code →      │
│  │                      │  code review → security → PR → done    │
│  └──────────┬──────────┘                                         │
│             │                                                     │
│  ┌──────────▼──────────┐                                         │
│  │  3. WORKSPACE MODEL  │  Isolado dos targets,                  │
│  │                      │  mono ou multi-repo,                   │
│  │                      │  descoberta por --workspace/env/.letra │
│  └──────────┬──────────┘                                         │
│             │                                                     │
│  ┌──────────▼──────────┐                                         │
│  │  4. UX JOURNEY       │  init wizard, web UI onboarding,       │
│  │     & ONBOARDING     │  flow template selection,              │
│  │                      │  configuração de targets + tools       │
│  └─────────────────────┘                                         │
│                                                                   │
│  ┌────────────────────────────────────────────────────────┐      │
│  │  CROSS-CUTTING: MÉTRICAS + SKILL + HARNESS CONTEXTUAL  │      │
│  └────────────────────────────────────────────────────────┘      │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

Cada pilar é detalhado abaixo.

---

## Pilar 1 — Flow Engine Abstraction

### Conceito

Flow é um **template** com comportamento, não só dados. O workflow.json referencia um flow template e o instancia com items, targets, e configurações.

### Fluxo de Dados

```
flow-templates/                    (built-in + usuário pode criar)
├── sdlc.json                      → Backlog→Spec→Review→Code→CR→Security→PR→Done
├── simple.json                    → Backlog→Doing→Done
├── marketing.json                 → Ideação→Pesquisa→Criação→Revisão→Publicação
└── custom/                        → usuário define seus estágios

letra init --template sdlc
       │
       ▼
workflow.json referenceia o template + instancia items, targets, config
       │
       ▼
Flow Engine lê template + instância e:
  ├── Valida gates nas transições
  ├── Coleta métricas
  ├── Gera harness contextual (adapter específico por estágio)
  └── Exporta/importa template completo (comportamento + dados?)
```

### Schema do Flow Template

```typescript
interface FlowTemplate {
  id: string;                    // "sdlc"
  name: string;                  // "Software Development Lifecycle"
  version: string;               // "1.0"
  description: string;
  
  stages: StageDef[];
  
  // Métricas que este template coleta automaticamente
  metrics: MetricDef[];
  
  // Adaptadores de harness: qual contexto gerar em cada estágio
  harness?: {
    // Instruções específicas por estágio (substitui/seções L4 padrão)
    stageInstructions?: Record<string, {
      agentPrompt?: string[];     // instruções extras para o agente
      humanGuidance?: string[];   // instruções para humano (ex: revisor)
      showLayers?: string[];      // quais camadas L1-L4 incluir
    }>;
  };
}

interface StageDef {
  id: string;
  name: string;
  type: StageType;               // backlog | planning | design | review | 
                                  // code | quality | security | deploy | done | custom
  zone: "todo" | "doing" | "done" | "custom";
  color: string;
  icon?: string;                  // ícone SVG ou emoji
  
  // Quem pode mover itens para cá
  allow: {
    from: string[];               // stage IDs que podem mover para cá
    forward?: boolean;            // permite avanço normal
    backward?: boolean;           // permite retorno
    skip?: boolean;               // permite pular este estágio
  };
  
  // Gates: validações executadas antes de permitir a transição
  validate?: {
    onEnter?: string[];           // gate IDs para entrar
    onExit?: string[];            // gate IDs para sair
  };
  
  // Métricas coletadas neste estágio
  metrics?: {
    onEntry?: string[];           // metric IDs para coletar ao entrar
    onExit?: string[];            // metric IDs para coletar ao sair
    continuous?: string[];        // metric IDs coletadas enquanto aqui
  };
}

type StageType = 
  | "backlog" | "planning" | "design" 
  | "review" | "code" | "quality" 
  | "security" | "deploy" | "done" 
  | "custom";
```

### Fluxo de Exportação/Importação

**Export flow template** (comportamento + se desejado, dados anônimos):
```bash
letra flow export --template          # exporta só o template (stages, gates, metrics)
letra flow export --template --items  # exporta template + items (anônimos opcional)
```

**Import flow template**:
```bash
letra flow import sdlc.json           # importa template e cria workflow
letra flow import --merge sdlc.json   # mescla com workflow existente (add stages não existentes)
```

### Caminho de Templates

```
.letra/templates/                     # templates do usuário (se workspace isolado)
├── sdlc.json                         # built-in copiado no init
├── meu-flow-custom.json              # usuário criou exportando

~/.letra/templates/                   # templates globais do usuário
└── sdlc.json                         # versão preferida do usuário
```

### Impacto nos Comandos Existentes

| Comando | Hoje | Amanhã |
|---------|------|--------|
| `letra flow export` | Exporta workflow JSON bruto | Exporta template + opcionalmente items |
| `letra flow import` | Importa JSON, valida estrutura | Importa template, cria workflow, valida gates compatíveis |
| `letra flow move` | Move item, regenera adapter | Valida gate onExit do estágio atual + onEnter do destino |
| `letra init` | Cria workflow default | Pergunta template → cria workflow com stages/gates/metrics do template |
| `letra flow board` | Lista stages e items | Mostra métricas por stage, destaca bottlenecks |

### Pacotes Novos

```
packages/core/flows/
├── templates/
│   ├── sdlc.ts          → SDLC template definition
│   ├── simple.ts        → Simple 3-stage template
│   └── registry.ts      → Template registry (built-in + user)
├── engine.ts            → Flow engine: valida gates, executa transições
├── metrics.ts           → Metrics collector and aggregator
├── schema.ts            → FlowDefinition, StageDef, MetricDef types
└── serialize.ts         → Export/import flow templates

packages/cli/src/commands/
├── flow-export.ts       → Updated: exporta template + opções
└── flow-import.ts       → Updated: importa template, valida, cria workflow
```

---

## Pilar 1b — Flow Phases: Máquina de Estados Aninhada

### Motivação

O Code Review real não é um estágio único — é um **sub-fluxo** composto de ciclos de revisão autônoma, correção, re-verificação, e só então decisão humana:

```
Code Review Stage (entrada)
  │
  ├── Fase: Auto Review
  │   └── Agente revisa código vs spec, gera findings.md
  │   └── Se sem findings → vai direto para Human Review
  │   └── Se com findings → vai para Code Fix
  │
  ├── Fase: Code Fix
  │   └── Agente corrige issues listados em findings.md
  │   └── Vai para Re-Review
  │
  ├── Fase: Re-Review
  │   └── Agente verifica correções, gera relatório final
  │   └── Vai para Human Review
  │
  └── Fase: Human Review
      └── Humano vê findings + relatório + código
      ├── Aprova → exit stage (para Security)
      └── Rejeita → volta para Code Fix
```

Cada estágio pode conter **fases internas** com transições próprias, gates automáticos e humanos, produção de artefatos, e regeneração de harness contextual.

### Conceito: Stage + Phases

```
Stage (ex: "Code Review")
  ├── phase: "auto-review"     (tipo: auto)
  │     action: agent-prompt → gera .letra/specs/{id}/review-findings.md
  │     transition: se findings vazio → "human-review"
  │                  se findings não vazio → "code-fix"
  │
  ├── phase: "code-fix"        (tipo: auto)
  │     action: agent-prompt → modifica código
  │     transition: sempre → "re-review"
  │
  ├── phase: "re-review"       (tipo: auto)
  │     action: agent-prompt + generate-report → .letra/specs/{id}/review-report.md
  │     transition: sempre → "human-review"
  │
  └── phase: "human-review"    (tipo: human)
        action: notify-human + wait-human
        transition: approved → exit stage (completa o stage)
                     rejected → "code-fix"
```

### Schema

```typescript
interface StageDef {
  id: string;
  name: string;
  type: StageType;
  zone: "todo" | "doing" | "done" | "custom";
  color: string;
  icon?: string;
  
  // Transições entre estágios (movimento no board)
  allow: {
    from: string[];
    forward?: boolean;
    backward?: boolean;
    skip?: boolean;
  };
  
  // Gates de validação na entrada/saída do estágio
  validate?: {
    onEnter?: string[];
    onExit?: string[];
  };
  
  // Métricas
  metrics?: {
    onEntry?: string[];
    onExit?: string[];
    continuous?: string[];
  };
  
  // ─── NOVO: Fases internas do estágio ───
  phases?: {
    initialState: PhaseId;          // fase inicial ao entrar no estágio
    states: Record<PhaseId, PhaseDef>;
  };
  
  // Artefatos produzidos neste estágio (relatórios, logs)
  artifacts?: ArtifactDef[];
}

type PhaseId = string;  // ex: "auto-review", "code-fix", "re-review", "human-review"

interface PhaseDef {
  name: string;           // ex: "Auto Review", "Code Fix"
  type: "auto" | "human" | "gate";
  
  // Ações executadas ao entrar nesta fase
  actions?: PhaseAction[];
  
  // Transições para outras fases (ou para saída do estágio)
  transitions: PhaseTransition[];
  
  // Artefatos gerados nesta fase
  produces?: ArtifactDef[];
}

interface PhaseAction {
  type: "agent-prompt" | "command" | "generate-report" | "notify-human" | "wait-human";
  
  // Prompt injetado no harness do agente (se type === "agent-prompt")
  prompt?: string;
  
  // Comando a executar (se type === "command")
  command?: string;
  
  // Template do relatório (se type === "generate-report")
  reportTemplate?: string;
  
  // Output esperado
  output?: string;          // path para arquivo gerado
}

interface PhaseTransition {
  to: PhaseId | "__completed__" | "__failed__";
  condition: TransitionCondition;
  
  // Ação executada durante a transição
  onTransition?: PhaseAction[];
}

type TransitionCondition =
  | { type: "always" }
  | { type: "gate"; gateId: string }
  | { type: "expression"; expr: string }     // ex: "findings.not-empty"
  | { type: "human-decision"; options: string[] };  // ex: ["approved", "rejected"]
```

### Ações por Tipo

| Tipo | Descrição | Quem Executa | Artefato |
|------|-----------|-------------|----------|
| `agent-prompt` | Instrui o agente a fazer algo | Agente via harness | findings.md, código modificado |
| `command` | Executa um comando no target | CLI | stdout/stderr |
| `generate-report` | Gera relatório de uma template | CLI | review-report.md |
| `notify-human` | Notifica humano para agir | CLI/Web UI | notificação |
| `wait-human` | Bloqueia até humano decidir | CLI/Web UI | decisão (approve/reject) |

### Exemplo Completo: Code Review com Phases

```json
{
  "id": "code-review",
  "name": "Code Review",
  "type": "review",
  "zone": "doing",
  "color": "#eab308",
  
  "allow": { "from": ["code"], "forward": true, "backward": true },
  
  "phases": {
    "initialState": "auto-review",
    "states": {
      "auto-review": {
        "name": "Autonomous Review",
        "type": "auto",
        "actions": [{
          "type": "agent-prompt",
          "prompt": "Review the code in this target against the spec at .letra/specs/{item.spec}/spec.md. List all issues found with file:line references. If no issues, write 'No issues found.'",
          "output": ".letra/specs/{item.spec}/review-findings.md"
        }],
        "transitions": [
          { "to": "human-review", "condition": { "type": "expression", "expr": "findings.empty" }},
          { "to": "code-fix",     "condition": { "type": "expression", "expr": "findings.not-empty" }}
        ],
        "produces": [{ "id": "review-findings", "path": ".letra/specs/{item.spec}/review-findings.md" }]
      },
      
      "code-fix": {
        "name": "Code Fix",
        "type": "auto",
        "actions": [{
          "type": "agent-prompt",
          "prompt": "Fix all issues listed in .letra/specs/{item.spec}/review-findings.md. Do not modify code outside the scope of these issues."
        }],
        "transitions": [
          { "to": "re-review", "condition": { "type": "always" }}
        ]
      },
      
      "re-review": {
        "name": "Re-Review",
        "type": "auto",
        "actions": [
          {
            "type": "agent-prompt",
            "prompt": "Verify each issue in .letra/specs/{item.spec}/review-findings.md was fixed. For each: [x] if fixed, [ ] if not. Add notes if needed."
          },
          {
            "type": "generate-report",
            "reportTemplate": "code-review-summary",
            "output": ".letra/specs/{item.spec}/review-report.md"
          }
        ],
        "transitions": [
          { "to": "human-review", "condition": { "type": "always" }}
        ],
        "produces": [{ "id": "review-report", "path": ".letra/specs/{item.spec}/review-report.md" }]
      },
      
      "human-review": {
        "name": "Human Review",
        "type": "human",
        "actions": [
          {
            "type": "notify-human",
            "prompt": "Code review complete for {item.id}. See findings: .letra/specs/{item.spec}/review-findings.md\nReport: .letra/specs/{item.spec}/review-report.md"
          },
          {
            "type": "wait-human",
            "prompt": "Run `letra review approve {item.id}` to approve, or `letra review reject {item.id}` to send back for fixes."
          }
        ],
        "transitions": [
          { "to": "__completed__", "condition": { "type": "human-decision", "options": ["approved"] }},
          { "to": "code-fix",      "condition": { "type": "human-decision", "options": ["rejected"] }}
        ]
      }
    }
  }
}
```

### Regeneração de Harness por Fase

Cada fase dentro de um estágio pode gerar **instruções diferentes** no adapter do agente:

| Fase | Harness L4 Injetado |
|------|---------------------|
| `auto-review` | "Seu papel agora é **revisor de código**. Analise o código contra a spec. Documente cada issue com arquivo:linha." |
| `code-fix` | "Seu papel agora é **desenvolvedor**. Corrija os issues listados em review-findings.md." |
| `re-review` | "Seu papel agora é **QA**. Verifique se cada issue foi endereçado. Gere o relatório final." |
| `human-review` | "Aguardando decisão humana. Não modifique o código até instrução." |

O adapter file é **regenerado a cada transição de fase**, não só a cada transição de estágio. Isso garante que o agente sempre saiba exatamente o que fazer no estado atual.

### Recursão: Fases Dentro de Fases

Teoricamente, qualquer fase pode conter sub-fases. Exemplo: a fase `security-audit` pode ter:

```
Security Stage
  └── phase: "audit"          (auto)
        └── phase: "npm-audit"       (command: npm audit)
        └── phase: "snyk-scan"       (command: snyk test)
        └── decision: merge results
  └── phase: "fix-critical"  (auto, se critical found)
  └── phase: "human-review"  (human)
```

**Por simplicidade na v1**, limitamos a 1 nível de aninhamento (estágio → fases). Futuras versões podem permitir N níveis.

### Implicações para o State do Item

Cada item no `workflow.json` ganha um campo `phase` para rastrear onde está dentro do estágio:

```json
{
  "id": "ITEM-45",
  "description": "Implementar login OAuth",
  "stage": "code-review",
  "phase": "auto-review",         // NOVO
  "phaseData": {                  // NOVO: estado interno da fase
    "findingsPath": ".letra/specs/login-oauth/review-findings.md",
    "findingsCount": 3,
    "autoReviewAttempts": 1
  },
  "status": "active"
}
```

### Comandos de Fase

```bash
# Avança para a próxima fase do estágio atual (quando automático)
letra flow next-phase            # avança para próxima fase automática

# Aprova/rejeita fase human-review
letra review approve <id>        # marca human decision = approved
letra review reject <id>         # marca human decision = rejected

# Ver estado da fase atual
letra flow phase <id>            # mostra fase atual, ações pendentes, artefatos
```

---

## Pilar 2 — SDLC Flow Template (Primeiro Caso de Uso)

### Estágios

```
BACKLOG → SPEC_DRAFT → SPEC_REVIEW → CODE → CODE_REVIEW → SECURITY → READY_TO_PR → DONE
```

| Stage | Type | Zone | Entrada | Saída (Gate) | Propósito |
|-------|------|------|---------|-------------|-----------|
| Backlog | backlog | todo | — | — | Itens não refinados, issues importados |
| Spec Draft | planning | doing | backlog → | `has-spec-file` | Agente escreve spec.md |
| Spec Review | review | doing | spec-draft → | `human-approved-spec` | HUMANO aprova spec |
| Code | code | doing | spec-review → | `all-acs-passing` | Implementação contra spec |
| Code Review | review | doing | code → | *(phases internas)* → `human-approved-code` | Revisão autônoma + humana |
| Security | quality | doing | code-review → | `security-clear` | Varredura automática |
| Ready to PR | quality | doing | security → | — | Última checagem, push |
| Done | done | done | ready-to-pr → | — | Concluído |

> **Nota**: Code Review usa **phases internas** (auto-review → code-fix → re-review → human-review). Security pode futuramente usar phases similares (audit → fix → re-audit).

### Gates

```typescript
interface GateDef {
  id: string;                    // "has-spec-file"
  name: string;                  // "Spec file must exist"
  type: "check" | "human" | "auto";
  
  // Se type === "check": validação automática
  check?: (item: Item, root: string) => Promise<GateResult>;
  
  // Se type === "human": requer ação humana
  humanApproval?: {
    prompt: string;              // O que perguntar ao humano
    requiredBy: string[];        // Quem pode aprovar (roles)
  };
  
  // Se type === "auto": validação por ferramenta externa
  auto?: {
    command: string;             // Comando a executar
    expectedExitCode: number;
    parseOutput: (stdout: string) => GateResult;
  };
}

interface GateResult {
  passed: boolean;
  message: string;
  details?: string;
}
```

### Gates do SDLC Flow

1. **`has-spec-file`** (check): Verifica se `specs/<id>/spec.md` existe e tem `## Acceptance Criteria`
2. **`human-approved-spec`** (human): HUMANO marca spec como aprovada (via `letra spec approve <id>` ou web UI)
3. **`all-acs-passing`** (check): Verifica se todos ACs estão marcados `[x]` na spec
4. **`human-approved-code`** (human): HUMANO aprova o code review (via `letra review approve <id>` ou web UI)
5. **`security-clear`** (auto): Executa comando de segurança configurado (ex: `npm audit`, `snyk test`)

### Instruções de Harness por Estágio

O adapter gerado para o agente deve ser diferente em cada estágio:

**Spec Draft:**
```
## Instruções (estágio: Spec Draft)
- Seu objetivo é transformar o item do backlog em uma spec formal
- Crie o arquivo .letra/specs/<id>/spec.md com:
  - Outcome claro
  - Acceptance Criteria mensuráveis (formato checklist)
  - Constraints e exclusions
- Após criar a spec, mova o item com `letra flow move <id> --to spec-review`
```

**Spec Review:**
```
## Instruções (estágio: Spec Review — AGUARDANDO HUMANO)
- A spec foi escrita e está aguardando revisão humana
- Não inicie implementação até que o humano aprove
- Se o humano pedir alterações, ajuste a spec e mova de volta
```

**Code:**
```
## Instruções (estágio: Code)
- Implementação contra spec aprovada
- Siga os ACs rigorosamente
- Execute `letra validate` para verificar conformidade
- Ao completar todos ACs, mova com `letra flow move <id> --to code-review`
```

**Code Review (fase: auto-review):**
```
## Instruções (estágio: Code Review · fase: Auto Review)
- Seu papel agora é REVISOR DE CÓDIGO
- Revise o código implementado contra a spec .letra/specs/<id>/spec.md
- Para cada AC, verifique se a implementação atende ao requisito
- Documente cada issue encontrado em .letra/specs/<id>/review-findings.md
- Formato: `- [ ] descrição do issue (arquivo:linha)`
- Se nenhum issue encontrado: escreva "No issues found."
- O flow avançará automaticamente baseado no resultado
```

**Code Review (fase: code-fix):**
```
## Instruções (estágio: Code Review · fase: Code Fix)
- Seu papel agora é DESENVOLVEDOR
- Corrija cada issue listado em .letra/specs/<id>/review-findings.md
- Não modifique código fora do escopo dos issues
- Após corrigir, o flow avançará para re-verificação automática
```

**Code Review (fase: re-review):**
```
## Instruções (estágio: Code Review · fase: Re-Review)
- Seu papel agora é QA / VERIFICADOR
- Para cada issue em review-findings.md, confirme se foi corrigido
- Marque [x] se corrigido, [ ] se ainda pendente, com notas
- Gere o relatório final de code review
```

**Code Review (fase: human-review):**
```
## Instruções (estágio: Code Review · fase: Aguardando Humano)
- Review autônomo concluído. Relatório gerado.
- Não modifique o código até decisão humana
- Se humano aprovar: movido para próximo estágio
- Se humano rejeitar: retorna para code-fix com feedback
```

---

## Pilar 3 — Métricas + Skill

### Métricas do SDLC Flow

Cada métrica tem: **o que mede, como coleta, quem vê, objetivo.**

| Métrica | Tipo | Coleta | Gatilho | Objetivo |
|---------|------|--------|---------|----------|
| **Cycle Time** | duration | session-log | Item move to Done | < 3 dias |
| **Spec Review Wait** | duration | session-log | Item enters Spec Review to leaves | < 4h |
| **Code Review Wait** | duration | session-log | Item enters Code Review to leaves | < 4h |
| **Spec Churn Rate** | ratio | git diff | Spec changes after Spec Review exit | < 20% |
| **Review Rejection Rate** | ratio | session-log | Item moved back vs forward in review | < 30% |
| **Security Issues Caught** | count | security gate | Security scan output | > 0 (antes do merge) |
| **Throughput** | count | session-log | Items done per week | > 5/semana |
| **WIP** | count | workflow.json | Snapshot contínuo | < 3 por dev |
| **PR Merge Time** | duration | git/gh CLI | PR open to merge | < 1h (após approval) |
| **Spec Coverage** | ratio | workflow.json | Items with spec / total items | > 80% |

**Métricas de Fase (por fase dentro do estágio):**

| Métrica | Tipo | Coleta | Gatilho | Objetivo |
|---------|------|--------|---------|----------|
| **Auto Review Time** | duration | session-log | Phase enter → exit (auto-review) | < 5min |
| **Findings per Review** | count | phase artifact | review-findings.md parsed | > 0 (acha issues) |
| **Fix Cycle Count** | count | session-log | Nº de loops fix → re-review | < 3 |
| **Fix Success Rate** | ratio | session-log | Re-reviews that pass / total | > 80% |
| **Auto-Review Accuracy** | ratio | human decision | Findings confirmed by human / total findings | > 70% |

### Schema de Métrica

```typescript
interface MetricDef {
  id: string;                    // "cycle-time"
  name: string;                  // "Cycle Time"
  description: string;
  type: "duration" | "count" | "ratio" | "boolean";
  
  // Coleta
  collectAt: "stage-enter" | "stage-exit" | "continuous" | "manual";
  source: "session-log" | "git" | "cli-output" | "gate-result";
  
  // Agregação
  aggregation: "avg" | "median" | "sum" | "count" | "latest" | "min" | "max";
  window?: "day" | "week" | "month" | "all";
  
  // Alvo
  target?: {                     // null = apenas informacional
    value: number;
    direction: "lt" | "gt" | "eq";  // less than, greater than, equal to
  };
  
  // Visualização
  visualization: "number" | "bar" | "trend" | "gauge";
}
```

### Skill: flow-metrics-advisor

Skill do OpenCode para ajudar a identificar métricas relevantes para qualquer fluxo.

**Propósito**: Guia interativo que pergunta sobre o fluxo do usuário e sugere métricas com base nas características dele.

**Estrutura** (`.opencode/skills/flow-metrics-advisor/SKILL.md`):

```markdown
# Flow Metrics Advisor Skill

## Quando usar
- Você está configurando um novo flow template
- Você quer adicionar métricas a um flow existente
- Você quer identificar bottlenecks no processo

## Workflow
1. Identifique o tipo de fluxo (SDLC, marketing, pesquisa, etc.)
2. Para cada estágio, pergunte:
   - O que significa "sucesso" neste estágio?
   - Quanto tempo é aceitável?
   - O que pode dar errado?
3. Mapeie riscos para métricas
4. Defina targets e alertas
5. Configure coletores (session-log, git, CLI)

## Sugestões por Tipo de Fluxo

### SDLC (Software)
- Cycle time, lead time, review wait, spec churn, WIP
- Gate: human approval time

### Marketing Campaign
- Time to brief, approval cycle, stakeholder feedback count
- Gate: budget approval, legal review

### Research
- Hypothesis validation rate, time to first result, paper review cycle
- Gate: ethics approval, methodology review

## Output
- Lista de métricas recomendadas com justificativa
- Configuração YAML para o flow template
- Alertas sugeridos (ex: cycle time > 5 dias = alert)
```

**Implementação**: Este skill seria um documento markdown em `.opencode/skills/` que guia o agente a perguntar e recomendar métricas. Pode evoluir para um comando `letra metrics suggest` que implementa a lógica.

### Dashboard de Métricas

```
letra metrics                       → Overview geral
letra metrics --flow sdlc           → Métricas do SDLC flow
letra metrics --item ITEM-42        → Métricas de um item específico
letra metrics --window week         → Última semana
letra metrics --alert               → Alertas de métricas fora do target

Saída exemplo:
╔══════════════════════════════════════════════════════════╗
║  MÉTRICAS · SDLC Flow · Últimos 7 dias                  ║
╠══════════════════════════════════════════════════════════╣
║  Cycle Time        ●  2.3d  (target: < 3d)   ✅        ║
║  Spec Review Wait  ⚠  6.1h  (target: < 4h)   ⚠ ALERT  ║
║  Code Review Wait  ●  2.5h  (target: < 4h)   ✅        ║
║  Spec Churn Rate   ● 12%    (target: < 20%)   ✅        ║
║  Throughput        ●  7/sem (target: > 5)     ✅        ║
║  WIP               ●  2.4   (target: < 3)     ✅        ║
╚══════════════════════════════════════════════════════════╝
```

---

## Pilar 4 — Workspace Model Evolution

### Como o Workspace Funciona

Tomando a spec `architecture-agnostic` como base e refinando:

```
Ordem de descoberta do workspace:
1. --workspace /caminho/absoluto       ← flag explícita
2. $LETRA_WORKSPACE                     ← variável de ambiente
3. .letra/ no cwd                       ← compat retroativa
4. Erro: "Nenhum workspace encontrado"
```

### Estrutura do Workspace (Isolado)

```
~/.letra/workspaces/minha-feature/
├── letra.json                          ← identifica workspace ({"version": "1", "type": "workspace"})
├── workflow.json                       ← flow template reference + items + targets + config
├── flow-template.json                  ← cópia do template (para referência, não source of truth)
├── specs/
│   ├── feature-auth/spec.md
│   ├── feature-payment/spec.md
│   └── session-log.json
├── metrics/
│   └── history.ndjson                  ← série temporal de métricas (append-only)
├── decisions/
├── backups/
└── templates/                          ← templates customizados do workspace
    └── meu-flow.json
```

### Estrutura do Workspace (Compat Retroativa — .letra/ no cwd)

```
meu-projeto/
├── .letra/
│   ├── workflow.json                    ← + targets: [{id: "self", path: "..", projectType: "software"}]
│   ├── specs/
│   ├── flow-template.json
│   ├── metrics/
│   └── ...
├── package.json
└── src/
```

O `.letra/` continua funcionando. A diferença: `workflow.json` ganha `targets[0] = {id: "self", path: ".."}` apontando para o pai.

### Multi-Repo Workspace

```
~/.letra/workspaces/minha-feature-multi/
├── letra.json
├── workflow.json
│   ├── targets:
│   │   ├── {id: "auth", path: "~/dev/service-auth", projectType: "software"}
│   │   ├── {id: "payment", path: "~/dev/service-payment", projectType: "software"}
│   │   └── {id: "docs", path: "~/dev/docs", projectType: "general"}
│   └── controlPlane: { repo: "git@github.com:org/control-plane.git", path: "." }
├── specs/
├── metrics/
├── decisions/
└── ...
```

O `controlPlane` define onde specs, decisões e métricas são versionadas. Pode ser o próprio workspace dir (se versionado) ou um repo separado.

### Impacto no Harness (Adapter Output)

Os adapters são escritos nos targets, não no workspace. `letra push` escreve os arquivos:

| Target | Adapter Output |
|--------|---------------|
| `auth` (software) | `~/dev/service-auth/AGENTS.md`, `.cursorrules` |
| `payment` (software) | `~/dev/service-payment/AGENTS.md`, `.cursorrules` |
| `docs` (general) | `~/dev/docs/instructions.md` |

O harness gerado tem escopo: mostra só o que é relevante para aquele target, mas referencia o workspace central para specs e contexto completo.

---

## Pilar 4b — UX Journey

### Fluxo `letra init` (Wizard Interativo)

```
$ letra init

╭──────────────────────────────────────────────────────╮
│              🚀  Bem-vindo ao Letra                   │
│                                                       │
│  Vamos configurar seu workspace em 4 passos.          │
│                                                       │
│  Pressione Enter para continuar...                    │
╰──────────────────────────────────────────────────────╯

? Nome do workspace: minha-feature

? Tipo de workspace:
  ● Monorepo (um diretório de projeto)
  ○ Multi-repo (múltiplos diretórios)
  ○ Diretório isolado (workspace separado dos projetos)

[Se Monorepo]
? Caminho do projeto: (./meu-projeto)

[Se Multi-repo]
? Quantos targets (projetos)? 3
? Target 1 caminho: ~/dev/service-auth
? Target 1 stack: ● software ○ general
? Target 2 caminho: ~/dev/service-payment
? Target 2 stack: ● software ○ general
? Target 3 caminho: ~/dev/notificacoes
? Target 3 stack: ● software ○ general

? Template de fluxo de trabalho:
  ● Software Development (SDLC) ← recomendado para projetos de software
  ○ Simples (Backlog → Doing → Done)
  ○ Campanha de Marketing
  ○ Customizado (você define os estágios)

? Gate de revisão humana:
  ● Spec Review: Humano aprova spec antes de codificar
  ● Code Review: Humano aprova código antes do merge
  ● Ambos os gates
  ○ Nenhum (fluxo livre)

? Quais ferramentas de IA usar?
  ✓ Cursor
  ✓ Claude Code
  ○ Windsurf
  ✓ VS Code Copilot
  ○ OpenCode
  ○ Hermes Agent
  ○ Adicionar custom...

? Ferramentas de segurança (opcional):
  ○ npm audit
  ○ Snyk
  ○ SonarQube
  ○ Custom...

╭──────────────────────────────────────────────────────╮
│  Resumo                                               │
│                                                       │
│  Workspace:  minha-feature                            │
│  Local:      ~/.letra/workspaces/minha-feature/       │
│  Targets:    3 projetos                               │
│  Flow:       SDLC com gates: spec review + code review│
│  Adaptadores: cursor, claude-code, vscode              │
│  Segurança:  npm audit                                │
│                                                       │
│  ✓ Confirmar   ○ Voltar   ○ Cancelar                  │
╰──────────────────────────────────────────────────────╯

✓ Workspace criado!
  ~/.letra/workspaces/minha-feature/
  
  Próximos passos:
  • `letra pulse`                → ver overview
  • `letra --workspace . serve`  → abrir web UI
  • `cd ~/dev/service-auth && letra pulse` → pulse sem flag (compat)
```

### UX Web UI — Setup Inline

Baseado na spec `ux-redesign-ai-memory-hub`, o primeiro-run na web UI:

1. Welcome screen com "Configurar workspace" ou "Abrir existente"
2. Seletor de workspace (lista `~/.letra/workspaces/`)
3. Upload de `workspace.schema.json` via drag-and-drop
4. Template selector visual (cards com ícones, descrição)
5. Configuração de targets com file browser
6. Revisão e confirmação

### Comandos de Atalho (Power Users)

```bash
# Setup rápido (non-interactive)
letra init --name minha-feature --template sdlc --mono --target ./meu-projeto

# Setup multi-repo flag-based
letra init --multi \
  --target auth:~/dev/service-auth:software \
  --target payment:~/dev/service-payment:software

# Setup com gates
letra init --template sdlc --gate spec-review --gate code-review

# Setup com segurança
letra init --template sdlc --security npm-audit --security snyk
```

---

## Integração com a Arquitetura Existente

### Merge com Decisões Anteriores

| Decisão | Como é Incorporada |
|---------|-------------------|
| **Write-Sync** (writeWorkflow gateway) | Flow engine usa `writeWorkflow()` para todas as mutações. Gates adicionam hooks: `writeWorkflow(root, { gates: [validateGate] })` |
| **Harness Composition Model** (L1-L4) | L4 (regras) vira dinâmico por estágio. Builder aceita `stageId` para personalizar. |
| **Architecture Agnostic** (workspace + targets) | Base do Pilar 4. Flow templates são agnósticos (SDLC template define stage types, não nomes fixos). |
| **UX Redesign** (AI Memory Hub) | Home dashboard inclui métricas. Flow view vira pipe+kanban com indicadores de gate. Spec view integra review flow. |
| **Adapter Hermes** | Hermes ganha instruções contextuais por estágio (igual outros adapters). |

### Mapa de Módulos

```
packages/
├── core/                                    ← NOVO (extraído do CLI)
│   ├── flows/
│   │   ├── templates/sdlc.ts
│   │   ├── templates/simple.ts
│   │   ├── registry.ts
│   │   ├── engine.ts                       ← Flow engine com gates
│   │   ├── metrics.ts                      ← Coletor + agregador
│   │   └── schema.ts
│   ├── workspace/
│   │   ├── discover.ts                     ← --workspace flag > env > .letra/ cwd
│   │   ├── targets.ts                      ← Target resolution, path normalization
│   │   └── config.ts                       ← workspace.json read/write
│   └── harness/
│       ├── builder.ts                      ← + stageId param para L4 contextual
│       ├── ac-counter.ts
│       └── focus-sync.ts
│
├── cli/
│   ├── commands/
│   │   ├── flow-export.ts                  ← Updated: exporta template
│   │   ├── flow-import.ts                  ← Updated: importa template
│   │   ├── flow-move.ts                    ← + valida gates
│   │   ├── init.ts                         ← + wizard de 4 passos
│   │   ├── metrics.ts                      ← NOVO: letra metrics
│   │   ├── spec-approve.ts                 ← NOVO: letra spec approve
│   │   ├── review-approve.ts               ← NOVO: letra review approve
│   │   └── push.ts                         ← NOVO: letra push (adapter output para targets)
│   └── adapters/
│       ├── generate.ts
│       └── formatters/
│           ├── cursor.ts
│           ├── text.ts
│           ├── windsurf.ts
│           └── hermes.ts
│
├── client/                                 ← Web UI
│   ├── src/
│   │   ├── views/
│   │   │   ├── Home.tsx                    ← + métricas, health, bottlenecks
│   │   │   ├── Specs.tsx                   ← + review flow, approve button
│   │   │   ├── Flow.tsx                    ← + gate indicators, metrics per stage
│   │   │   └── Context.tsx
│   │   ├── components/
│   │   │   ├── MetricsDashboard.tsx         ← NOVO
│   │   │   ├── GateIndicator.tsx           ← NOVO
│   │   │   ├── ReviewPanel.tsx             ← NOVO
│   │   │   └── WorkspaceSetup.tsx          ← NOVO (wizard inline)
│   │   └── lib/
│   │       └── metrics.ts                  ← NOVO: fetch + aggregate metrics
│   └── ...
│
└── types/
    └── src/
        ├── flow.ts                         ← NOVO: FlowDefinition, StageDef, GateDef, MetricDef
        ├── workspace.ts                    ← NOVO: WorkspaceConfig, TargetConfig
        └── workflow.ts                     ← Updated: stages permitem referência a flow template
```

### Diagrama de Dependências

```
CLI commands (thin, ≤100 linhas)
    │
    ▼
core/flows/engine.ts          ← valida gates, executa transições
    │
    ├──► core/workspace/      ← descobre workspace, resolve targets
    │
    ├──► core/harness/        ← gera adapters com L4 contextual
    │       │
    │       └──► adapters/formatters/*.ts
    │
    ├──► core/flows/metrics.ts ← coleta métricas nas transições
    │       │
    │       └──► metrics/history.ndjson  (append)
    │
    └──► writeWorkflow()      ← gateway único de escrita
```

---

## Estratégia de Implementação

### Fase 0 — Fundação (workspace + tipos)

Pré-requisito: ITEM-40 (architecture-agnostic) implementado.

```
AC1: core/workspace/ — módulo de descoberta de workspace (--workspace, env, .letra/ fallback)
AC2: core/flows/schema.ts — tipos FlowDefinition, StageDef, GateDef, MetricDef
AC3: flow-export atualizado para exportar template
AC4: flow-import atualizado para importar template + validar
AC5: workflow.json version bump para 2.0 (compat retroativa)
```

### Fase 1 — SDLC Template + Gates Engine

```
AC6: core/flows/templates/sdlc.ts — SDLC template com 8 estágios e 5 gates
AC7: core/flows/templates/simple.ts — Simple 3-stage template
AC8: core/flows/engine.ts — valida gates onEnter/onExit nas transições
AC9: flow-move executa validação de gate antes de mover
AC10: CLI: `letra spec approve <id>` — marca gate human-approved-spec
AC11: CLI: `letra review approve <id>` — marca gate human-approved-code
AC12: Web UI: GateIndicator nos cards do kanban
AC13: Web UI: ReviewPanel para spec review + code review
```

### Fase 1b — Flow Phases Engine (estágios com sub-máquina de estados)

```
AC14: StageDef ganha `phases: { initialState, states: Record<PhaseId, PhaseDef> }`
AC15: core/flows/phase-engine.ts — executa fases: actions, transitions, conditions
AC16: Item ganha `phase` e `phaseData` no session-log
AC17: flow advance-phase — CLI para avançar fase automática
AC18: CLI: `letra review approve/reject <id>` — decisão humana em fase human-review
AC19: core/flows/artifacts.ts — rastreamento de artefatos por fase (findings.md, report.md)
AC20: Web UI: PhaseIndicator — mostra fase atual do item dentro do estágio
```

### Fase 2 — Métricas

```
AC21: core/flows/metrics.ts — coleta metrics em transições de estágio e fase
AC22: Metrics history: metrics/history.ndjson (append-only, rotate)
AC23: CLI: `letra metrics` — overview com targets e alertas
AC24: Web UI: MetricsDashboard — gráficos, trends, bottlenecks
AC25: Skill: flow-metrics-advisor — documento guia
```

### Fase 3 — Harness Contextual + UX Journey

```
AC26: builder.ts aceita stageId + phaseId → gera L4 específico do estágio+fase
AC27: Init wizard interativo (4 passos: workspace, targets, template, tools)
AC28: Web UI: WorkspaceSetup inline (first-run wizard)
AC29: CLI: `letra push` — escreve adapters nos targets
AC30: Multi-repo: controle de versão do workspace (controlPlane)
AC31: harness é regenerado a cada transição de fase, não só de estágio
```

---

## Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|:---:|:---:|-----------|
| Workflow schema v2 quebra projetos existentes | Média | Alto | Compat retroativa: projetos sem `flowTemplate` usam default simple. Leitor v2 aceita v1. |
| Complexidade do engine de gates vira overengineering | Média | Médio | Gates são hooks opcionais. Flow sem gates = comportamento atual. Default SDLC template define gates, mas usuário pode remover. |
| Métricas adicionam latência em flow move | Baixa | Médio | Coleta é async + append-only. Se falhar, não bloqueia transição. Métricas são eventualmente consistentes. |
| Workspace isolado confunde usuários existentes | Alta | Alto | `.letra/` no cwd continua funcionando (fallback). Init pergunta se quer migrar. |
| Multi-repo adiciona complexidade de path resolution | Média | Médio | Paths são sempre absolutos normalizados. Erro claro se target não existe. |
| UX do wizard fica complexa demais | Média | Alto | 4 passos máximos. Cada passo tem default inteligente. Skip flags para power users. |

---

## Decisões Tomadas

1. **Flow é template + instância**. workflow.json referencia um template e adiciona items, targets, config. O template é copiado para o workspace (não linkado) para versionamento independente.

2. **Gates são hooks opcionais**. Flow sem gates = comportamento atual. Gates adicionam validação sem quebrar nada.

3. **Métricas são coletadas nas transições de estágio**. O session-log é expandido para incluir eventos de métrica. Métricas são append-only, nunca alteradas retroativamente.

4. **L4 do harness é contextual por estágio**. Cada estágio pode definir instruções diferentes para o agente. Se não definido, usa L4 padrão.

5. **Workspace discovery por precedência**: `--workspace` > `$LETRA_WORKSPACE` > `.letra/` no cwd. Sem quebra retroativa.

6. **Init wizard é interativo + flag-based**. Flag-based (`--template sdlc --mono`) é equivalente funcional ao modo interativo.

7. **Skill flow-metrics-advisor é um documento markdown** no diretório de skills do OpenCode. Pode evoluir para comando `letra metrics suggest`.

8. **SDLC é o primeiro template built-in** (não o único). Simple, marketing, pesquisa virão depois.

9. **`writeWorkflow()` gateway (write-sync decision) continua sendo o único ponto de escrita**. Gates adicionam hooks de pré-validação.

10. **Multi-repo é feature separada** da fundação do workspace. Fase 0 implementa workspace isolado mono-target. Multi-repo vem na Fase 3.

---

## Próximos Passos

1. Discutir e validar esta síntese arquitetural
2. Atualizar ITEM-40 (architecture-agnostic) com as novas ACs ou criar novo item
3. Criar spec para Flow Engine (`packages/core/flows/`)
4. Criar spec para SDLC Template + Gates
5. Implementar Fase 0: Fundação de workspace
6. Implementar Fase 1: SDLC Template
7. Implementar Skill flow-metrics-advisor
8. Evoluir web UI para suportar métricas e gates

---

## Referências

- `.letra/specs/architecture-agnostic/spec.md` — Workspace isolado + targets
- `.letra/specs/harness-layer/spec.md` — Harness composition model L1-L4
- `.letra/specs/flow-export-import/spec.md` — Export/import atual
- `.letra/decisions/harness-composition-model.md` — Decisão de composição do harness
- `.letra/decisions/write-sync-single-source-of-truth.md` — Gateway de escrita
- `.letra/decisions/ux-redesign-ai-memory-hub.md` — UX redesign
- `.letra/decisions/adapter-hermes-architecture.md` — Adapter extensível
- `.letra/workspace.schema.json` — Schema de workspace multi-repo
- `.letra/constitution.md` — Regras arquiteturais do projeto
- `.letra/glossary.md` — Definições de domínio
