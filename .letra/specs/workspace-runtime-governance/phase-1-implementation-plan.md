# Phase 1 Implementation Plan — workspace-runtime-governance

**Spec**: `workspace-runtime-governance`  
**Phase**: `Fase 1 — Política de escrita e projeção`  
**Date**: 2026-06-28  
**Status**: Draft

---

## Objetivo da fase

Implementar a base técnica mínima que separa com clareza:

- escrita canônica
- projeção derivada
- evidência
- auditoria
- refresh de contexto

Sem essa separação, a introdução de `PGlite`, contexto ativo e governança de IA tende a aumentar o drift já existente no produto.

---

## Situação atual observada no código

Os principais pontos de extensão reais do repositório hoje são:

### Escrita de workflow

- `packages/cli/src/commands/flow-init.ts`
  - `loadWorkflow()`
  - `saveWorkflow()`
  - `writeWorkflow()`

### Resolução de workspace

- `packages/cli/src/workspace/resolver.ts`
  - `resolveWorkspaceRoot()`
  - paths derivados de `workflow.json`, `session-log.json` e `health-record.json`

### Efeitos colaterais atuais

- `packages/cli/src/adapters/generate.ts`
- `packages/cli/src/session-log.ts`
- `packages/cli/src/health-record.ts`
- `packages/cli/src/commands/sitrep.ts`
- `packages/cli/src/diagnostics/engine.ts`

### Superfícies com escrita distribuída

- `packages/cli/src/commands/flow-backlog.ts`
- `packages/cli/src/commands/flow-move.ts`
- `packages/cli/src/commands/flow-edit-diff.ts`
- `packages/cli/src/commands/flow-import-issues.ts`
- `packages/cli/src/commands/focus.ts`
- `packages/cli/src/commands/spec.ts`
- `packages/cli/src/commands/flow-serve.ts`
- `packages/cli/src/commands/flow-autopilot.ts`
- `packages/cli/src/commands/flow-phases.ts`
- `packages/cli/src/commands/flow-phase-run.ts`

Isso confirma que a primeira fase deve começar pelo núcleo de escrita, não pela UI.

---

## Resultado esperado da fase

Ao final da Fase 1, o sistema deve possuir:

1. uma classificação explícita por tipo de artefato
2. um gateway de escrita mais organizado e extensível
3. um mecanismo inicial de auditoria estruturada por mutação
4. um contrato para projeções derivadas, mesmo antes de `PGlite` completo
5. integração segura com `writeWorkflow()` sem big-bang refactor

---

## Estratégia geral

Em vez de substituir `writeWorkflow()` imediatamente, a fase deve:

1. preservar `writeWorkflow()` como gateway especializado vigente
2. extrair serviços internos de responsabilidade única
3. criar um contrato mais amplo de escrita de domínio
4. adaptar `writeWorkflow()` para consumir gradualmente esse contrato

Isso minimiza risco e permite rollout incremental.

---

## Módulos propostos

### 1. `packages/cli/src/domain-write/types.ts`

Responsabilidade:

- definir tipos centrais de intenção, resultado, classificação de artefatos e efeitos

Deve conter:

- `WriteArtifactKind`
- `WriteSubjectType`
- `WriteIntent`
- `WriteResult`
- `ProjectionRequest`
- `AuditEntryInput`

### 2. `packages/cli/src/domain-write/classification.ts`

Responsabilidade:

- classificar quais artefatos são:
  - canônicos
  - derivados
  - evidências
  - rollback

Uso:

- evitar que cada comando ou serviço decida isso localmente

### 3. `packages/cli/src/domain-write/context.ts`

Responsabilidade:

- resolver paths e metadados mínimos de escrita para o workspace ativo

Deve integrar com:

- `resolveWorkspaceRoot()`
- futuros paths de projeção local

### 4. `packages/cli/src/domain-write/audit.ts`

Responsabilidade:

- registrar auditoria estruturada de mutações

Primeira entrega recomendada:

- gravação em arquivo append-only simples
- formato estável para futura projeção em `PGlite`

### 5. `packages/cli/src/domain-write/projection.ts`

Responsabilidade:

- formalizar interface de projeção derivada

Primeira entrega recomendada:

- stub operacional com no-op ou file-backed checkpoint
- contrato explícito para fase seguinte

### 6. `packages/cli/src/domain-write/gateway.ts`

Responsabilidade:

- coordenar validação, persistência canônica, auditoria, projeção e refresh de contexto

Este módulo ainda não substitui todos os caminhos existentes. Ele nasce como núcleo reutilizável.

### 7. `packages/cli/src/workspace/store.ts`

Responsabilidade:

- encapsular leitura/escrita de `workspace.json`

Motivação:

- hoje o acesso a `workspace.json` ainda está disperso em `workspace/index.ts` e `flow-serve/workspace.ts`

---

## Interfaces iniciais recomendadas

### Tipos centrais

```ts
export type WriteArtifactKind =
  | "canonical"
  | "derived"
  | "evidence"
  | "rollback";

export type WriteSubjectType =
  | "workspace"
  | "workflow"
  | "target"
  | "scope"
  | "agent"
  | "team"
  | "assignment"
  | "flow-run"
  | "run-item"
  | "run-event";
```

### Intenção de escrita

```ts
export interface WriteIntent<TPayload = unknown> {
  workspaceId: string;
  subjectType: WriteSubjectType;
  subjectId?: string;
  action: string;
  payload: TPayload;
  actor: {
    type: "human" | "agent" | "system";
    id?: string;
  };
  expectedSourceVersion?: string;
  requestedEffects?: Array<
    "audit" | "evidence" | "reproject" | "refresh-context" | "broadcast"
  >;
  reason?: string;
}
```

### Resultado

```ts
export interface WriteResult {
  ok: boolean;
  workspaceId: string;
  subjectType: WriteSubjectType;
  subjectId?: string;
  canonicalWrites: string[];
  derivedWrites: string[];
  evidenceWrites: string[];
  auditIds: string[];
  projectionJobs: string[];
  contextRefresh: "none" | "scheduled" | "completed";
  broadcastEvents: string[];
  newSourceVersion?: string;
  error?: string;
}
```

### Porta de projeção

```ts
export interface ProjectionPort {
  schedule(request: ProjectionRequest): Promise<string[]>;
}

export interface ProjectionRequest {
  workspaceId: string;
  subjectType: WriteSubjectType;
  subjectId?: string;
  sourceVersion: string;
  mode: "incremental" | "full" | "targeted";
  targets?: string[];
}
```

### Porta de auditoria

```ts
export interface AuditPort {
  append(entry: AuditEntryInput): Promise<string>;
}

export interface AuditEntryInput {
  workspaceId: string;
  subjectType: WriteSubjectType;
  subjectId?: string;
  action: string;
  actorType: "human" | "agent" | "system";
  actorId?: string;
  before?: unknown;
  after?: unknown;
  evidenceRefs?: string[];
  occurredAt: string;
}
```

---

## Plano de execução por passo

### Passo 1 — Extrair tipos e classificação

Arquivos:

- `packages/cli/src/domain-write/types.ts`
- `packages/cli/src/domain-write/classification.ts`

Objetivo:

- congelar a linguagem da escrita antes de tocar comportamento

Risco:

- baixo

### Passo 2 — Encapsular store de workspace

Arquivos:

- `packages/cli/src/workspace/store.ts`

Objetivo:

- padronizar leitura/escrita de `workspace.json`

Risco:

- baixo

### Passo 3 — Extrair audit trail estruturado

Arquivos:

- `packages/cli/src/domain-write/audit.ts`
- arquivo de persistência correspondente em workspace state

Objetivo:

- parar de depender apenas de `session-log` para toda rastreabilidade estrutural

Risco:

- médio, pois exige definir formato sem conflitar com logs existentes

### Passo 4 — Introduzir `ProjectionPort`

Arquivos:

- `packages/cli/src/domain-write/projection.ts`

Objetivo:

- preparar o sistema para `PGlite` sem acoplá-lo imediatamente

Primeira implementação:

- checkpoint em arquivo simples
- fila local mínima ou chamada síncrona stub

Risco:

- baixo

### Passo 5 — Criar `DomainWriteGateway`

Arquivos:

- `packages/cli/src/domain-write/gateway.ts`

Objetivo:

- centralizar:
  - validação
  - persistência canônica
  - auditoria
  - solicitação de projeção
  - refresh de contexto

Risco:

- médio

### Passo 6 — Adaptar `writeWorkflow()`

Arquivos:

- `packages/cli/src/commands/flow-init.ts`

Objetivo:

- fazer `writeWorkflow()` delegar internamente partes do fluxo ao novo gateway

Abordagem:

- manter a assinatura pública atual
- substituir implementação interna por pipeline mais estruturado

Risco:

- médio

### Passo 7 — Normalizar chamadores prioritários

Chamadores prioritários:

- `flow-backlog.ts`
- `flow-move.ts`
- `flow-edit-diff.ts`
- `flow-import-issues.ts`
- `flow-serve.ts`

Objetivo:

- garantir que os fluxos mais usados passem pelo mesmo núcleo

Risco:

- médio

---

## Ordem recomendada de arquivos a tocar

1. `packages/cli/src/domain-write/types.ts`
2. `packages/cli/src/domain-write/classification.ts`
3. `packages/cli/src/workspace/store.ts`
4. `packages/cli/src/domain-write/audit.ts`
5. `packages/cli/src/domain-write/projection.ts`
6. `packages/cli/src/domain-write/gateway.ts`
7. `packages/cli/src/commands/flow-init.ts`
8. `packages/cli/src/commands/flow-backlog.ts`
9. `packages/cli/src/commands/flow-move.ts`
10. `packages/cli/src/commands/flow-edit-diff.ts`
11. `packages/cli/src/commands/flow-import-issues.ts`
12. `packages/cli/src/commands/flow-serve.ts`

---

## Testes mínimos da fase

### Testes unitários

- classificação de artefatos
- leitura/escrita de `workspace.json`
- geração de entrada de auditoria
- criação de `ProjectionRequest`
- comportamento base do gateway em sucesso e falha

### Testes de integração

- `writeWorkflow()` continua atualizando `workflow.json`
- auditoria é registrada em mutações de workflow
- falha de projeção não invalida persistência canônica
- `flow-serve` continua funcionando com os caminhos adaptados

### Testes de regressão prioritários

- `flow-move`
- `flow-backlog add`
- `flow-edit`
- `flow-import`
- `focus` quando afetar refresh de contexto

---

## Critérios de pronto da Fase 1

- existe um módulo explícito para tipagem e classificação de escrita
- `workspace.json` possui store encapsulado
- existe auditoria estruturada separada de log operacional bruto
- o gateway já coordena ao menos uma mutação canônica real
- `writeWorkflow()` permanece compatível, mas internamente mais modular
- o sistema já consegue sinalizar intenção de reprojeção sem depender ainda do `PGlite` final

---

## O que não entra nesta fase

- implementação completa do schema `PGlite`
- busca textual funcional
- resolução completa de contexto ativo
- CRUD completo de agentes, times e scopes
- redesign de UI para governança

---

## Riscos da implementação

### Risco 1 — mexer cedo demais em `flow-serve.ts`

Mitigação:

- adaptar primeiro o núcleo e só depois migrar chamadas

### Risco 2 — auditoria duplicar responsabilidade do `session-log`

Mitigação:

- deixar claro que `session-log` continua sendo trilha operacional ampla
- auditoria estruturada cobre mutações de domínio com formato mais rígido

### Risco 3 — gateway virar novo monólito

Mitigação:

- extrair `audit`, `projection`, `classification` e `store` como serviços separados

---

## Recomendações para a primeira PR

Escopo recomendado da primeira PR desta frente:

1. criar `domain-write/types.ts`
2. criar `domain-write/classification.ts`
3. criar `workspace/store.ts`
4. adicionar testes unitários desses módulos
5. sem alterar ainda o comportamento externo dos comandos

Motivo:

- abre a fundação com risco baixo
- reduz chance de conflito com `flow-serve`
- facilita revisão arquitetural antes da mudança comportamental
