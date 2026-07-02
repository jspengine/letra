# Phase 0 Design — Autoridade Única do Flow

**Spec**: `architecture-convergence`  
**Item**: `ITEM-51`  
**Date**: 2026-06-27  
**Status**: Draft

---

## Politica de escrita

A classificacao e a responsabilidade de escrita dos artefatos usados nesta
convergencia estao definidas em `write-policy.md`. Toda evolucao desta fase deve
preservar a autoridade de `workflow.json`, tratar resolucoes e adapters como
derivados e registrar efeitos relevantes como evidencia observavel.

---

## Objetivo da fase

A Fase 0 existe para resolver o principal problema arquitetural do Letra hoje:

> a semântica do flow está duplicada entre harness, servidor, CLI e UI.

O resultado esperado desta fase não é “refatorar tudo”, e sim estabelecer uma regra simples e operacional:

> toda leitura de semântica do flow ativo deve passar por uma única resolução normalizada.

Isso cria a fundação para as próximas fases sem exigir um big-bang refactor.

---

## Problema atual

Hoje o produto tem múltiplas fontes semânticas para a mesma coisa:

### 1. Templates de flow no servidor

`packages/cli/src/commands/flow-serve.ts` mantém `TEMPLATES` locais e também lê templates do harness.

Isso cria duas autoridades:

- harness versionado
- fallback interno do servidor

### 2. SDLC hardcoded em comandos

`packages/cli/src/commands/flow-move.ts` faz gate enforcement com:

- `harness?.flows?.sdlc`

Ou seja: o comando não resolve o flow ativo do workspace; ele assume um flow específico.

### 3. Bootstrap implícito no init

`packages/cli/src/commands/flow-init.ts` usa `harness?.flows?.sdlc` no quick init e fallback local de stages.

Esse bootstrap é aceitável, mas hoje ele se mistura com autoridade definitiva.

### 4. UI com semântica própria

`packages/client/src/App.tsx` ainda define:

- tabs e vocabulário (`projects`)
- `execStageDefs`
- labels e agentes por stage

Mesmo antes da Fase 2, isso afeta a forma como o sistema pensa o flow.

### 5. Activity context com heurística local

Hoje o `activity-context` ainda interpreta review/gate com base em nomes de stages e phases. Isso não será resolvido completamente na Fase 0, mas a Fase 0 precisa abrir o caminho.

---

## Escopo da Fase 0

### Entra

- definição de um resolvedor único do flow ativo
- remoção de lookup direto em `harness.flows.sdlc` fora da camada de resolução
- separação entre:
  - bootstrap default
  - semântica do flow ativo
- preparação do contrato que fases seguintes usarão

### Não entra

- remover toda semântica hardcoded da UI
- modularizar todo o `flow-serve`
- tornar `activity-context` totalmente declarativo
- redesenhar schema do `workflow.json`

---

## Decisão de design

### Novo conceito: Active Flow Resolution

Precisamos de uma pequena camada interna que responda:

```ts
resolveActiveFlow(root, workflow, harness) => ResolvedFlowDefinition
```

Essa camada deve encapsular:

- qual flow está ativo no workspace
- quais stages existem de fato
- quais gates pertencem a esses stages
- quais labels e metadados mínimos o resto do sistema pode consumir
- qual fallback é aceitável para compatibilidade

Essa resolução deve ser a única dona da lógica:

- “qual flow está valendo?”
- “quais stages/gates pertencem a esse flow?”
- “qual comportamento default é permitido?”

---

## Regra de autoridade

### Fonte primária

1. `workflow.template` quando existir
2. harness correspondente ao template ativo
3. stages persistidos no `workflow.json` como instância transacional

### Fallback compatível

Quando não houver `workflow.template` ou flow correspondente:

- usar `workflow.stages` como base mínima da instância
- opcionalmente associar metadados de bootstrap default
- nunca assumir `sdlc` fora da camada de resolução

### Implicação

Nenhum módulo de domínio fora do resolvedor poderá fazer:

- `harness.flows.sdlc`
- leitura de template embutido como fonte definitiva
- inferência de gate baseada em “flow padrão do sistema”

---

## Proposta de contrato

### Tipo novo

```ts
interface ResolvedFlowDefinition {
  id: string | null;
  source: "workflow-template" | "workflow-instance" | "legacy-fallback";
  name: string;
  stages: Array<{
    id: string;
    name: string;
    order: number;
    zone?: "todo" | "doing" | "done";
    gate?: {
      id: string;
      name: string;
      type: "human" | "automated" | "external";
      blocking: boolean;
      policyRef?: string;
    } | null;
    agents?: string[];
  }>;
}
```

### API mínima

```ts
resolveActiveFlow(root: string): {
  workflow: Workflow | null;
  harness: HarnessManifest | null;
  flow: ResolvedFlowDefinition | null;
}
```

### Responsabilidades

- carregar workflow
- carregar harness
- identificar template ativo
- resolver stages/gates/agents
- aplicar fallback de compatibilidade
- esconder lookup específico de `sdlc`

---

## Localização sugerida

Criar um novo módulo em:

- `packages/cli/src/flow-definition/resolve.ts`

E opcionalmente:

- `packages/cli/src/flow-definition/types.ts`
- `packages/cli/src/flow-definition/resolve.test.ts`

Motivo:

- o termo “flow-definition” separa semântica do flow de comandos e da UI
- evita misturar responsabilidade com `flow-init.ts`
- prepara o caminho para a Fase 1 sem grande renomeação posterior

---

## Módulos que a Fase 0 deve tocar

### 1. Criar

- `packages/cli/src/flow-definition/types.ts`
- `packages/cli/src/flow-definition/resolve.ts`
- `packages/cli/src/flow-definition/resolve.test.ts`

### 2. Adaptar

- `packages/cli/src/commands/flow-move.ts`
- `packages/cli/src/commands/flow-init.ts`
- `packages/cli/src/commands/flow-serve.ts`

### 3. Não tocar ainda, exceto para preparar consumo futuro

- `packages/client/src/App.tsx`
- `packages/client/src/components/Home/HomeView.tsx`
- `packages/cli/src/activity-context/builder.ts`

Esses entram forte nas fases seguintes.

---

## Mudanças por módulo

### `flow-move.ts`

#### Hoje

- carrega harness
- assume `harness.flows.sdlc`
- resolve gate por stage a partir desse flow fixo

#### Depois da Fase 0

- chama `resolveActiveFlow(root)`
- localiza o stage de destino no `ResolvedFlowDefinition`
- aplica gate enforcement sem conhecimento de `sdlc`

#### Resultado

- gate enforcement deixa de depender do nome do flow

---

### `flow-init.ts`

#### Hoje

- `flowInitQuick()` usa `harness?.flows?.sdlc`
- fallback de stages internos

#### Depois da Fase 0

- bootstrap default continua permitido
- mas passa a ser explicitamente classificado como bootstrap
- `workflow.template = "sdlc"` deve ser setado quando quick init criar o flow SDLC

#### Resultado

- init deixa mais explícito qual flow foi instanciado
- compatibilidade melhora para resolução posterior

---

### `flow-serve.ts`

#### Hoje

- mantém `TEMPLATES`
- cria workflow a partir de harness ou fallback local
- carrega semântica parcialmente do servidor

#### Depois da Fase 0

- `TEMPLATES` deixam de ser autoridade primária
- o servidor pode manter apenas bootstrap compatível isolado, ou delegar criação a uma camada de bootstrap separada
- rotas que expõem template/flow passam a usar a mesma resolução semântica

#### Resultado

- o servidor deixa de carregar uma cópia paralela do modelo de flow

---

## Estratégia de fallback

Como há muitos workspaces legados, a Fase 0 precisa ser tolerante.

### Caso A — workflow tem `template`

Comportamento:

- resolver a partir do harness desse template
- mesclar com estado transacional do workflow

### Caso B — workflow não tem `template`, mas stages parecem SDLC conhecido

Comportamento:

- usar `workflow.stages` como instância
- marcar `source: "workflow-instance"` ou `legacy-fallback`
- não assumir implicitamente `sdlc` fora do resolvedor

### Caso C — harness indisponível

Comportamento:

- continuar funcionando com stages do workflow
- sem gates adicionais do harness
- manter o sistema operacional, mas com semântica reduzida

---

## Sequência de implementação recomendada

### Passo 1

Criar `ResolvedFlowDefinition` e `resolveActiveFlow()`.

### Passo 2

Cobrir cenários em teste:

- workflow com `template = sdlc`
- workflow sem template
- template inexistente no harness
- harness ausente
- stage com gate humano bloqueante

### Passo 3

Trocar `flow-move.ts` para usar a nova resolução.

### Passo 4

Trocar `flow-init.ts` para gravar `workflow.template` quando aplicável.

### Passo 5

Trocar `flow-serve.ts` para usar bootstrap/resolução sem manter semântica própria como fonte primária.

---

## Critérios de pronto da Fase 0

- nenhum módulo de domínio faz lookup direto em `harness.flows.sdlc`
- existe um resolvedor único do flow ativo
- `flow-move` usa essa resolução para gates
- `flow-init` grava o template ativo quando cria flow padrão
- `flow-serve` deixa de tratar templates locais como autoridade primária
- workspaces legados continuam operando

---

## Riscos

### Risco 1 — quebrar criação de workflow no setup web

Mitigação:

- separar bootstrap de template da resolução semântica
- manter fallback compatível enquanto o setup não migra totalmente

### Risco 2 — assumir que todo workflow terá `template`

Mitigação:

- tratar `workflow.stages` como instância legítima de legado

### Risco 3 — espalhar mais uma abstração parcial

Mitigação:

- usar a nova camada imediatamente em `flow-move`
- não criar resolvedor “paralelo” só para documentação

---

## Saída da fase

Ao final da Fase 0, Letra ainda não terá concluído a convergência arquitetural.

Mas terá algo decisivo:

> um único ponto de leitura do flow ativo, capaz de sustentar as próximas fases sem continuar espalhando semântica pelo sistema.
