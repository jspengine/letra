# Write-Sync: Motor de Sincronização e Fonte Única de Verdade

**Date**: 2026-06-16
**Status**: proposed

## Context

O Letra sofre de **inconsistência crônica entre fontes de estado**. Auditando o workspace em 16/06/2026, cada arquivo contava uma história diferente:

| Fonte | Afirmava | Real |
|---|---|---|
| `AGENTS.md` | ITEM-16 é o atual, estágio Backlog | ITEM-32 em Review, ITEM-16 não existe mais |
| `focus.md` | command-menu (ITEM-47) | ITEM-32 é o atual |
| `context.md` | "ITEM-33 (ruler header — revisão)" | ITEM-32 em Review |
| `pulse` (workflow.json) | ITEM-32 em Review, ITEM-22 no backlog | ✅ fonte da verdade |

6 comandos escrevem `workflow.json` de forma descentralizada. Cada um decide se regenera adapters, se atualiza context.md, se loga. Nenhum reconcilia os outros. O `stage-drift` detector tem um `autoFix` que faz `writeFileSync` direto no `workflow.json` — bypassando completamente `saveWorkflow()`, `generateAdapters()`, e `sitrep`.

O resultado: o agente (OpenCode, Cursor, etc.) recebe contexto inconsistente a cada sessão. A confiança no harness cai. O valor do produto — "contexto enriquecido para agentes" — degrada com o uso.

Este ADR propõe um **motor de sincronização (`writeWorkflow`)** que unifica toda mutação de workflow em um único gateway com side-effects garantidos.

## Architecture — C4 Diagrams

### Nível 1: Contexto do Sistema (HOJE)

```mermaid
C4Context
title System Context — Letra (Current)

Person(dev, "Desenvolvedor", "Usa CLI e edita specs")
Person(agent, "Agente IA", "OpenCode, Cursor, Claude Code")

System_Boundary(letra, "Letra SDD Framework") {
  System(cli, "CLI", "Commander · Node 22+")
  System(webui, "Web UI", "React 19 · Vite · Tailwind v4")
}

System_Ext(fs, "File System", ".letra/ diretório + raiz do projeto")

Rel(dev, cli, "letra flow move, letra focus, letra health...")
Rel(dev, fs, "Edita specs, context.md")
Rel(agent, fs, "Lê AGENTS.md, .cursorrules, .letra/")
Rel(cli, fs, "Lê e escreve workflow.json, adapters, context.md, health-record.json, snapshots, focus.md")
Rel(webui, fs, "Lê via CLI HTTP API (flow serve)")
UpdateLayoutConfig($c4ShapeInRow="3", $c4BoundaryInRow="1")
```

### Nível 2: Containers — HOJE

```mermaid
C4Container
title Container Diagram — Current Architecture (problematic)

Person(dev, "Desenvolvedor")

System_Boundary(cli, "CLI (packages/cli)") {
  Container(commands, "Commands", "TypeScript", "Commander-based. Orquestram lógica de negócio")
  Container(adapters, "Adapters", "TypeScript", "Builder + Formatters + Generate")
  Container(diagnostics, "Diagnostics", "TypeScript", "Engine + Detectors + SnapshotStore")
  Container(health, "Health Record", "TypeScript", "Persistent alert store")
  Container(log, "Session Log", "TypeScript", "session-log.ts")
}

System_Ext(workflow_json, "workflow.json", "Fonte da verdade — items, stages, tools")
System_Ext(focus_md, "focus.md", "Foco da sessão manual")
System_Ext(context_md, "context.md", "Contexto (parcialmente auto-gerado via sitrep)")
System_Ext(adapters_fs, "Adapter Files", "AGENTS.md, .cursorrules, CLAUDE.md...")
System_Ext(health_json, "health-record.json", "Alertas persistentes")
System_Ext(snapshots, "Snapshots", ".letra/snapshots/ — undo/redo")

Rel(dev, commands, "Invoca comandos")
Rel(commands, workflow_json, "6 comandos ESCREVEM: flow-backlog, flow-move, flow-edit, flow-import, flow-init, stage-drift(autoFix)")
Rel(commands, adapters, "3 comandos CHAMAM: flow-move, focus, health (outros 3 NÃO chamam)")
Rel(commands, context_md, "1 comando ATUALIZA: sitrep. Nenhum workflow mutation chama sitrep")
Rel(commands, health_json, "health scan, diagnose")
Rel(adapters, workflow_json, "LEITURA via builder.ts (read-only)")
Rel(adapters, focus_md, "LEITURA via builder.ts")
Rel(adapters, health_json, "LEITURA via builder.ts")
Rel(diagnostics, workflow_json, "stage-drift ESCREVE direto (backdoor)")
Rel(adapters, adapters_fs, "ESCREVE adapter files")
Rel(health, health_json, "LÊ e ESCREVE health-record.json")

Rel(workflow_json, context_md, "DERIVA via sitrep (manual)")
Rel(workflow_json, adapters_fs, "DERIVA via generateAdapters (parcial)")

UpdateLayoutConfig($c4ShapeInRow="2", $c4BoundaryInRow="1")
```

### Nível 3: Componentes Internos do CLI — HOJE

```mermaid
C4Component
title Component Diagram — CLI Commands + Data Flow (Current)

System_Boundary(commands, "Commands Layer") {
  Component(flow_backlog, "flow-backlog.ts", "TypeScript", "Add item, saveWorkflow. NÃO gera adapters")
  Component(flow_move, "flow-move.ts", "TypeScript", "Move item, saveWorkflow + generateAdapters")
  Component(flow_edit, "flow-edit-diff.ts", "TypeScript", "Edit metadata, saveWorkflow. NÃO gera adapters")
  Component(flow_import, "flow-import-issues.ts", "TypeScript", "Import issues, saveWorkflow. NÃO gera adapters")
  Component(flow_init, "flow-init.ts", "TypeScript", "Init workflow, saveWorkflow. NÃO gera adapters")
  Component(focus, "focus.ts", "TypeScript", "Define focus. generateAdapters. NÃO salva workflow")
  Component(health_cmd, "health.ts", "TypeScript", "scan/ack/dismiss. generateAdapters. NÃO salva workflow")
  Component(sitrep, "sitrep.ts", "TypeScript", "Update context.md. NÃO salva workflow, NÃO gera adapters")
  Component(diagnose, "diagnose.ts", "TypeScript", "Run diagnostics. NÃO toca workflow nem adapters")
}

System_Boundary(persistence, "Persistence Layer") {
  Component(save_wf, "saveWorkflow()", "flow-init.ts:133", "Escreve workflow.json com backup")
  Component(load_wf, "loadWorkflow()", "flow-init.ts:123", "Lê workflow.json")
  Component(gen_adapters, "generateAdapters()", "generate.ts:31", "Gera AGENTS.md, .cursorrules...")
  Component(sitrep_update, "sitrep update", "sitrep.ts:248", "Atualiza context.md com estado atual")
}

System_Ext(workflow_file, "workflow.json")
System_Ext(adapter_files, "AGENTS.md, .cursorrules...")
System_Ext(context_file, "context.md")

Rel(flow_backlog, save_wf, "saveWorkflow() → workflow.json", "verde")
Rel(flow_move, save_wf, "saveWorkflow()", "verde")
Rel(flow_move, gen_adapters, "generateAdapters()", "verde")
Rel(flow_edit, save_wf, "saveWorkflow()", "verde")
Rel(flow_import, save_wf, "saveWorkflow()", "verde")
Rel(flow_init, save_wf, "saveWorkflow()", "verde")
Rel(focus, gen_adapters, "generateAdapters()", "azul")
Rel(health_cmd, gen_adapters, "generateAdapters()", "azul")
Rel(save_wf, workflow_file, "write")
Rel(load_wf, workflow_file, "read")
Rel(gen_adapters, adapter_files, "write")
Rel(sitrep_update, context_file, "write")

UpdateLayoutConfig($c4ShapeInRow="3", $c4BoundaryInRow="2")
```

---

### Nível 1: Contexto do Sistema (PROPOSTO)

```mermaid
C4Context
title System Context — Letra (Proposed)

Person(dev, "Desenvolvedor", "Usa CLI e edita specs")
Person(agent, "Agente IA", "OpenCode, Cursor, Claude Code")

System_Boundary(letra, "Letra SDD Framework") {
  System(cli, "CLI", "Commander · Node 22+")
  System(webui, "Web UI", "React 19 · Vite · Tailwind v4")
}

System_Ext(fs, "File System", ".letra/ diretório + raiz do projeto")

Rel(dev, cli, "letra flow move, letra focus, letra health...")
Rel(agent, fs, "Lê AGENTS.md, .cursorrules, .letra/")
Rel(cli, fs, "writeWorkflow() é o ÚNICO gateway de escrita de workflow.json")
Rel(webui, fs, "Lê via CLI HTTP API (flow serve)")
UpdateLayoutConfig($c4ShapeInRow="3", $c4BoundaryInRow="1")
```

### Nível 2: Containers — PROPOSTO

```mermaid
C4Container
title Container Diagram — Proposed Architecture (writeWorkflow gateway)

Person(dev, "Desenvolvedor")

System_Boundary(cli, "CLI (packages/cli)") {
  Container(wf_gateway, "writeWorkflow()", "TypeScript", "GATEWAY ÚNICO de mutação. Garante side-effects")
  Container(commands, "Commands", "TypeScript", "Commander-based. Chamam writeWorkflow()")
  Container(adapters, "Adapters", "TypeScript", "Builder + Formatters + Generate")
  Container(diagnostics, "Diagnostics", "TypeScript", "Engine + Detectors + SnapshotStore")
  Container(health, "Health Record", "TypeScript", "Persistent alert store")
  Container(log, "Session Log", "TypeScript", "session-log.ts")
  Container(sync_cmd, "letra sync", "TypeScript", "Reconciliação manual: regenera tudo a partir do workflow.json")
}

System_Ext(workflow_json, "workflow.json", "SINGLE SOURCE OF TRUTH — items, stages, tools")
System_Ext(focus_md, "focus.md", "Foco validado contra workflow (warning se stale)")
System_Ext(context_md, "context.md", "Contexto auto-sincronizado via sitrep dentro do gateway")
System_Ext(adapters_fs, "Adapter Files", "AGENTS.md, .cursorrules, CLAUDE.md — SEM lista de itens")
System_Ext(health_json, "health-record.json", "Alertas persistentes (independente)")
System_Ext(snapshots, "Snapshots", ".letra/snapshots/ — undo/redo")

Rel(dev, commands, "Invoca comandos")
Rel(commands, wf_gateway, "5 comandos chamam writeWorkflow(): backlog, move, edit, import, init", "verde")
Rel(focus, adapters, "focus chama generateAdapters() diretamente (não escreve workflow)", "azul")
Rel(health_cmd, adapters, "health chama generateAdapters() diretamente (não escreve workflow)", "azul")
Rel(wf_gateway, workflow_json, "1. saveWorkflow() interno", "verde")
Rel(wf_gateway, adapters, "2. generateAdapters() auto", "verde")
Rel(wf_gateway, context_md, "3. sitrep update auto (opcional/async)", "verde")
Rel(wf_gateway, log, "4. logEntry() auto", "verde")
Rel(adapters, adapters_fs, "ESCREVE adapter files (sem L2/L3)")
Rel(adapters, workflow_json, "LEITURA via builder.ts (read-only)")
Rel(adapters, focus_md, "LEITURA via builder.ts (validado)")
Rel(adapters, health_json, "LEITURA via builder.ts")
Rel(diagnostics, workflow_json, "stage-drift autoFix chama writeWorkflow() — NÃO writeFileSync direto")
Rel(sync_cmd, wf_gateway, "Reconciliação: regenera tudo do workflow.json")
Rel(health, health_json, "LÊ e ESCREVE health-record.json")

UpdateLayoutConfig($c4ShapeInRow="2", $c4BoundaryInRow="1")
```

### Nível 3: Componentes Internos do CLI — PROPOSTO

```mermaid
C4Component
title Component Diagram — writeWorkflow() Gateway (Proposed)

System_Boundary(commands, "Commands Layer") {
  Component(flow_backlog, "flow-backlog.ts", "TypeScript", "Add item → writeWorkflow()")
  Component(flow_move, "flow-move.ts", "TypeScript", "Move item → writeWorkflow() (simplificado)")
  Component(flow_edit, "flow-edit-diff.ts", "TypeScript", "Edit metadata → writeWorkflow()")
  Component(flow_import, "flow-import-issues.ts", "TypeScript", "Import issues → writeWorkflow()")
  Component(flow_init, "flow-init.ts", "TypeScript", "Init workflow → writeWorkflow()")
  Component(focus, "focus.ts", "TypeScript", "Define/clear focus → generateAdapters() direto")
  Component(health_cmd, "health.ts", "TypeScript", "scan/ack/dismiss → generateAdapters() direto")
  Component(sitrep, "sitrep.ts", "TypeScript", "Update context.md (manual override)")
  Component(sync, "sync.ts", "TypeScript", "letra sync — reconciliação full")
}

System_Boundary(gateway, "Write Gateway — writeWorkflow()") {
  Component(write_wf, "writeWorkflow()", "flow-init.ts (novo)", "GATEWAY: valida, persiste, regenera, loga")
  Component(save_wf, "saveWorkflow()", "flow-init.ts (privado)", "Baixo nível: escreve workflow.json + backup")
  Component(gen_adapters, "generateAdapters()", "generate.ts", "Chamado automaticamente pelo gateway")
  Component(sitrep_update, "sitrep()", "sitrep.ts", "Chamado automaticamente (opcional)")
}

System_Ext(workflow_file, "workflow.json")
System_Ext(adapter_files, "AGENTS.md, .cursorrules...")
System_Ext(context_file, "context.md")

Rel(flow_backlog, write_wf, "writeWorkflow()", "verde")
Rel(flow_move, write_wf, "writeWorkflow()", "verde")
Rel(flow_edit, write_wf, "writeWorkflow()", "verde")
Rel(flow_import, write_wf, "writeWorkflow()", "verde")
Rel(flow_init, write_wf, "writeWorkflow()", "verde")
Rel(sync, write_wf, "writeWorkflow({ force: true })", "verde")
Rel(focus, gen_adapters, "generateAdapters() direto (exceção)", "azul")
Rel(health_cmd, gen_adapters, "generateAdapters() direto (exceção)", "azul")
Rel(write_wf, save_wf, "1. saveWorkflow()")
Rel(write_wf, gen_adapters, "2. generateAdapters()")
Rel(write_wf, sitrep_update, "3. sitrep() [opcional/async]")
Rel(save_wf, workflow_file, "write")
Rel(gen_adapters, adapter_files, "write (sem L2/L3)")
Rel(sitrep_update, context_file, "write")

UpdateLayoutConfig($c4ShapeInRow="3", $c4BoundaryInRow="2")
```

### Fluxo: writeWorkflow() — Sequência Interna

```mermaid
sequenceDiagram
    participant C as Command (flow-move, etc.)
    participant G as writeWorkflow()
    participant WF as workflow.json
    participant AD as generateAdapters()
    participant CT as sitrep()
    participant LG as logEntry()

    C->>G: writeWorkflow(root, workflow, options?)
    G->>G: validate(workflow) — schema check
    G->>WF: saveWorkflow() — write + backup
    G->>AD: generateAdapters() — update AGENTS.md etc.
    alt sitrep enabled (default: true)
        G->>CT: sitrep update — refresh context.md
    end
    G->>LG: logEntry() — audit trail
    G-->>C: return { ok, filesUpdated[] }
```

---

## Decision

Adotar o **Write-Sync Model**: toda mutação de `workflow.json` passa por um único gateway `writeWorkflow()` que garante side-effects consistentes.

### Contrato do Gateway

```typescript
interface WriteWorkflowOptions {
  workflow: Workflow;
  source: "flow-move" | "flow-backlog" | "flow-edit" | "flow-import" | "flow-init" | "stage-drift";
  skipAdapters?: boolean;    // default: false
  skipSitrep?: boolean;      // default: false (sitrep é caro — opcional)
  skipLog?: boolean;         // default: false
}

interface WriteWorkflowResult {
  ok: boolean;
  filesUpdated: string[];  // paths of generated/regenerated files
  error?: string;
}

function writeWorkflow(root: string, options: WriteWorkflowOptions): WriteWorkflowResult
```

### Regras de Side-Effect

| Side-effect | Quando | Skipável? |
|---|---|---|
| `saveWorkflow()` (write + backup) | Sempre | ❌ |
| `generateAdapters()` | Sempre | `skipAdapters: true` |
| `sitrep()` update context.md | Padrão: sim | `skipSitrep: true` |
| `logEntry()` | Sempre | `skipLog: true` |

### Adaptadores sem L2/L3

Remove-se do adapter (AGENTS.md, .cursorrules, etc.) as seções que duplicam estado mutável:

- **Remove L2** (`formatL2()` — lista de itens no estágio): o agente usa `letra pulse` para isso.
- **Remove L3** (`formatL3()` — sinais de trabalho): `letra pulse` também mostra.
- **Mantém L1** (referências a context.md, constitution.md, glossary.md, focus.md).
- **Mantém L5** (alertas do health record) — informação crítica que não tem outro canal.
- **Mantém** kickoff checklist, command menu, completion checklist, regras.

### Comandos afetados (antes → depois)

| Comando | Antes | Depois |
|---|---|---|
| `flow backlog add` | `saveWorkflow()` só | `writeWorkflow()` → adapters + sitrep |
| `flow move` | `saveWorkflow()` + `generateAdapters()` (manual) | `writeWorkflow()` → tudo automático |
| `flow edit` | `saveWorkflow()` só | `writeWorkflow()` → adapters + sitrep |
| `flow import` | `saveWorkflow()` só | `writeWorkflow()` → adapters + sitrep |
| `flow init` | `saveWorkflow()` só | `writeWorkflow()` → adapters + sitrep |
| `stage-drift autoFix` | `writeFileSync()` direto (backdoor) | `writeWorkflow()` via função importada |
| `focus` / `health` | `generateAdapters()` direto | Mantém `generateAdapters()` direto (não escrevem workflow) |

### Código morto após implementação

| Arquivo | Destino | Motivo |
|---|---|---|
| `formatters.ts:formatL2()` (~35 linhas) | Remover | Lista de itens removida do adapter |
| `formatters.ts:formatL3()` (~40 linhas) | Remover | Sinais de trabalho removidos do adapter |
| `builder.ts:51-85` (~35 linhas) | Simplificar/podar | Lógica de mapeamento de itens fica mais simples |
| `flow-move.ts:5` (import generateAdapters) | Remover | Substituído por `writeWorkflow()` |
| `stage-drift.ts:54-69` (autoFix writeFileSync) | Reescrever | Usar `writeWorkflow()` em vez de `writeFileSync` direto |
| `flow-backlog.ts:53`, `flow-edit.ts:85`, `flow-import.ts:129,239` | 1 linha cada | Trocar `saveWorkflow()` por `writeWorkflow()` |

**Total estimado de linhas removidas/simplificadas:** ~120 linhas.
**Total de novas linhas:** `writeWorkflow()` ~50 linhas + `sync.ts` ~80 linhas = ~130 linhas.
**Saldo líquido:** aproximadamente neutro.

### O que NÃO muda

- `health-record.ts` — independente, não passa pelo gateway
- `diagnostics/engine.ts` — não toca workflow.json
- `diagnostics/detectors/*` — só `stage-drift` muda
- `diagnostics/snapshot.ts` — independente
- `validation/` — domínio separado
- `packages/client/` — lê via HTTP API, sem mudança
- `session-log.ts` — já é chamado individualmente

## Consequences

**Positivo:**

- **Consistência garantida**: toda mutação de workflow regenera adapters e (opcionalmente) context.md. Fim do drift entre AGENTS.md, context.md e workflow.json.
- **Audit trail completo**: `logEntry()` automático em toda mutação.
- **Código mais simples**: 5 comandos deixam de gerenciar side-effects manualmente.
- **Backdoor fechado**: `stage-drift` não consegue mais escrever direto no workflow.json.
- **Adapter mais leve**: sem L2/L3, fica ~30% menor e nunca stale.
- **`letra sync`** como "botão de pânico" para reconciliação manual.

**Negativo:**

- **Behavior change**: `flow backlog add`, `flow edit`, `flow import` vão começar a regenerar adapters e atualizar context.md. Pode ser mais lento (especialmente sitrep que roda testes). Mitigação: `skipSitrep: true` como fallback, sitrep async.
- **`stage-drift` autoFix**: precisa de acesso a `writeWorkflow()`. Hoje o detector é puro (só recebe `rootDir`). Isso quebra a pureza — o detector vai precisar importar uma função de escrita. Alternativa: o autoFix retorna a ação como dados, e o engine executa.
- **Focus e Health** continuam chamando `generateAdapters()` diretamente — exceção no modelo. Se no futuro eles também precisarem escrever workflow, precisam migrar.
- **`letra sync`** adiciona outro comando ao cardápio. Risco baixo.

### Mitigações

| Risco | Mitigação |
|---|---|
| Sitrep lento (roda testes) | `skipSitrep: true` por padrão. Sincronização via `letra sync` manual ou async future |
| Detector perde pureza | `autoFix` retorna ação descritiva → engine executa. Mantém detector puro |
| Surpresa por comportamento novo | Documentar no --help de cada comando afetado |

## Alternativas rejeitadas

| Alternativa | Por que rejeitada |
|---|---|
| **Event bus / pub-sub interno** | Overengineering. 5 comandos é um número pequeno; gateway síncrono basta |
| **git hook pós-commit** | Fora do controle do .letra/. Usuário pode não usar git |
| **File watcher contínuo** | Complexidade alta. watch + debounce + race conditions. Gateway é mais simples |
| **Manter como está + docs** | Não resolve o problema. Drift vai continuar |
| **Fundir tudo em um comando "flow" monolítico** | Viola single-responsibility. Gateway não é orquestrador |

## Referências

- `.letra/decisions/harness-composition-model.md` — ADR anterior que definiu camadas do adapter
- `.letra/specs/context-sync/spec.md` — spec de sincronização de contexto
- `.letra/specs/write-sync/spec.md` — spec deste motor de sincronização
- `packages/cli/src/commands/flow-*.ts` — comandos afetados (6 arquivos)
- `packages/cli/src/diagnostics/detectors/stage-drift.ts:54-69` — backdoor do autoFix
- `packages/cli/src/adapters/formatters.ts:L2-L3` — seções a remover
