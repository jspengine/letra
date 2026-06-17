# Design: Arquitetura Agnóstica de Domínio

> Status: Draft · 2026-06-16
> Estágio: Design (decisão arquitetural antes de implementar ITEM-39)

## Princípio

Letra é um framework de **Specification-Driven Development (SDD)** agnóstico.
Agnóstico significa:

1. **Não assume linguagem de programação** — o usuário pode usar C#, Python, Rust, Go, ou nenhuma
2. **Não assume projeto de software** — o usuário pode planejar uma reforma, uma campanha de marketing, um roteiro de viagem, uma pesquisa acadêmica
3. **Não assume ferramenta específica** — adaptadores funcionam para qualquer assistente AI (ChatGPT, Claude web, Gemini), não só agentes de código
4. **Toda suposição técnica deve ser abstraída ou configurável** — nada hardcoded

## Problema Atual

21 pontos identificados onde o framework vaza suposições de software.
3 camadas de impacto:

```
                    SUPOSIÇÃO TÉCNICA
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
         QUEBRA       VIES         RUÍDO
    (C#, Python,   (stage name   (termos como
     reforma,       "code",       "ADR",
     campanha)      templates     "adapters",
                    só código)    "npm")
```

### Categoria 1: Comandos (quebra)

Build e test são `execSync("npm run build")` hardcoded em `pulse.ts`, `sitrep.ts`, `validate.ts`.
Para C#, Python, Go, ou não-código: falha silenciosa ou crash.

### Categoria 2: Busca em código (quebra)

`file-search.ts` busca só `.ts/.tsx` em `packages/*/src`. Três detectores dependem disso:
`ac-false-pos`, `ac-stale`, `spec-code-drift`. Em projeto não-TS: todos retornam falso negativo.

### Categoria 3: Stage naming (viés)

Stage "code" hardcoded em `focus.ts`, `pulse.ts`, `stage-drift.ts`, `spec-code-drift.ts`.
Default templates sempre incluem "Code". Para domínios não-dev, não faz sentido.

### Categoria 4: Templates (viés)

Spec templates: só `web-api`, `cli-tool`, `mobile-feature`.
Setup wizard: só agentes de código (Cursor, Claude Code, OpenCode, Windsurf, VS Code).
Constitution gerado: menciona TypeScript, npm, ESLint.

### Categoria 5: Adaptadores (viés + ruído)

Sistema de adapters hardcoded para 5 ferramentas de código.
Nenhum adapter para ChatGPT web, Claude web, ou ferramentas não-AI.
Termo "adapter" no UI pressupõe agente de código.

### Categoria 6: Tipos restritivos (ruído)

`WorkflowItem.source` aceita só `"github" | "linear"`.
`decision.ts` chama de "Architecture Decision Record" — termo de software.

### Categoria 7: Intrusão no workspace do usuário (quebra)

O letra hoje vive DENTRO do diretório do projeto (`.letra/`). Isso quebra quando:

- A feature atravessa **múltiplos microserviços** em diretórios distintos
- O usuário **não quer lixo oculto** no diretório do projeto
- O workspace do letra **não é o projeto** — pode ser uma campanha de marketing, uma reforma de casa, uma pesquisa

```
Problema real do usuário:
  ~/projetos/
  ├── service-auth/          ← parte da feature X
  ├── service-payment/       ← parte da feature X
  └── service-notification/  ← parte da feature X

  Onde colocar .letra/?
  ├── service-auth/.letra/   ← errado: só vê um serviço
  ├── service-payment/.letra/← errado: duplicado
  └── service-notification/.letra/ ← errado: sem coordenação
```

## Arquitetura Proposta

```
┌─────────────────────────────────────────────────────┐
│                   workflow.json                      │
│  name, stages[], items[], buildCommand?, testCommand?│
│  projectType?: "software" | "general"               │
└──────────────────┬──────────────────────────────────┘
                   │
    ┌──────────────┼──────────────┐
    ▼              ▼              ▼
┌────────┐  ┌────────────┐  ┌──────────┐
│ Pulse  │  │ Detectors  │  │ Adapters │
│────────│  │────────────│  │──────────│
│ usa    │  │ universais │  │ tool-    │
│ build  │  │ │─ stage   │  │ agnostic │
│Command │  │ │─ missing │  │ config.  │
│ se     │  │ │─ cross   │  │ format   │
│ setado │  │────────────│  │──────────│
│ senão  │  │ code-only  │  │ targets  │
│ skip   │  │ (opt-in)   │  │ extens.  │
└────────┘  └────────────┘  └──────────┘
```

### 1. Build/Test configurável

```
// workflow.json
{
  "buildCommand": "npm run build",       // null se não aplicável
  "testCommand": "npm run test",         // null se não aplicável
  "projectType": "software" | "general"  // default: "general"
}
```

- `pulse.ts`: se `buildCommand` é null, skip (não falha)
- `sitrep.ts`: mesma lógica
- `validate.ts`: heurísticas npm/tsc/vitest só se `projectType === "software"`
- `letra flow init` pergunta com auto-detect: `package.json` → npm, `*.csproj` → dotnet, `Cargo.toml` → cargo, senão deixa null

### 2. File search domain-aware

```
interface SearchConfig {
  extensions?: string[];     // [".ts", ".tsx"] para software, [] para general
  directories?: string[];    // ["packages/*/src"] para monorepo, [] para general
}
```

- `projectType === "general"` → `searchInSource()` retorna `false` (sem busca em código)
- Detectores `ac-false-pos`, `ac-stale`, `spec-code-drift` viram **opt-in** com warning:
  "Este detector busca no código-fonte. Projetos não-software podem ignorá-lo."
- `file-search.ts` aceita configuração externa (extensões, diretórios) em vez de hardcoded

### 3. Stage naming flexível

- Nenhum código hardcode o nome "code" como stage — usar sempre `s.zone === "doing"` ou lookup por ID
- `focus.ts`: fallback para primeiro stage, não para "code"
- `stage-drift.ts`: mensagem usa `s.name` do stage encontrado, não string "code" hardcoded
- `spec-code-drift.ts`: `ACTIVE_STAGES` lê do workflow, não hardcoded
- Trigger de migração: detectar stages legacy e sugerir renomeação via diagnose

### 4. Templates extensíveis

Spec templates passam a aceitar plugins/usuário adiciona os seus:

```
.letra/templates/
├── web-api.md          # built-in
├── cli-tool.md         # built-in
├── mobile-feature.md   # built-in
├── campanha-marketing.md  # usuário cria
└── research-paper.md      # usuário cria
```

Novos templates built-in não-dev (MVP inicial):
- `campanha-marketing`: objetivos, público, canais, timeline, KPI
- `pesquisa`: hipótese, método, amostra, resultados esperados
- `evento`: data, local, público, grade, orçamento

### 5. Adapter system extensível

```
// workflow.json
{
  "adapters": [
    { "id": "opencode",  "path": "AGENTS.md",     "format": "markdown" },
    { "id": "cursor",    "path": ".cursorrules",  "format": "at" },
    { "id": "chatgpt",   "path": "GPT.md",        "format": "markdown" },
    { "id": "generic",   "path": "instructions.md","format": "markdown" }
  ]
}
```

- `TOOL_TARGETS` em `generate.ts` vira **sugestão inicial**, não lista fixa
- Usuário pode adicionar qualquer tool no setup wizard ou editando workflow.json
- `detectExistingTools()` em `flow-init.ts` busca arquivos conhecidos + permite adicionar custom
- Setup wizard pergunta "qual arquivo de instruções sua ferramenta usa?" em vez de só listar 5 opções

### 6. Tipos

- `WorkflowItem.source`: `string` (não enum) — qualquer origem: "github", "linear", "manual", "trello", "asana"
- `decision.ts`: "Registro de Decisão" em vez de "Architecture Decision Record" (termo neutro)
- UI: substituir "Código" por neutro quando `projectType !== "software"`

### 7. Workspace isolado + targets

O workspace do letra é um diretório **separado** dos projetos que ele coordena.
Projetos são referenciados por caminho (targets).

```
~/.letra/workspaces/sua-feature/    ← workspace (pode estar em qualquer lugar)
├── letra.json                       ← identifica que é um workspace letra
├── workflow.json                    ← stages, config, targets
├── specs/                           ← specs da feature (não polui projetos)
│   ├── feature-auth/
│   ├── feature-payment/
│   └── session-log.json

[targets] referencia:
  /home/user/projetos/service-auth/       ← não tem .letra/
  /home/user/projetos/service-payment/    ← não tem .letra/
  /home/user/projetos/notificacoes/       ← não tem .letra/
```

```
// workflow.json
{
  "name": "integração pagamento",
  "targets": [
    {
      "id": "auth",
      "path": "/home/user/projetos/service-auth",
      "projectType": "software",
      "buildCommand": "npm run build",
      "testCommand": "npm run test"
    },
    {
      "id": "payment",
      "path": "/home/user/projetos/service-payment",
      "projectType": "software",
      "buildCommand": "dotnet build",
      "testCommand": "dotnet test"
    },
    {
      "id": "notificacoes",
      "path": "/home/user/projetos/notificacoes",
      "projectType": "general"
    }
  ]
}
```

**Implicações em cada subsistema:**

| Subsistema | Hoje (cwd relativo) | Amanhã (workspace + targets) |
|---|---|---|
| CLI entry | `process.cwd()` | `--workspace` flag ou `LETRA_WORKSPACE` env |
| `loadWorkflow()` | `.letra/workflow.json` | `<workspace>/workflow.json` |
| `writeWorkflow()` | `.letra/...` | `<workspace>/...` |
| Specs | `.letra/specs/<id>/spec.md` | `<workspace>/specs/<id>/spec.md` |
| Session log | `.letra/session-log.json` | `<workspace>/session-log.json` |
| Pulse | roda no cwd | roda no target indicado (ou no primeiro) |
| Detectors | buscam `packages/*/src` | buscam em `target[].path` |
| Adapter output | `.cursorrules` no cwd | escreve no `target[].path/arquivo` |
| Web UI | serve de cwd | recebe workspace path no startup |
| Build | `npm run build` no cwd | roda `target[].buildCommand` no `target[].path` |
| Test | `npm run test` no cwd | roda `target[].testCommand` no `target[].path` |

**Como o CLI descobre o workspace:**

```
Ordem de precedência:
1. --workspace /caminho/absoluto      ← flag explícita
2. $LETRA_WORKSPACE                   ← variável de ambiente
3. .letra/ no cwd (compat retroativa) ← fallback para ninguém quebrar
4. Erro: "Nenhum workspace encontrado. Use --workspace ou letra init"
```

**`letra init` sem intrusão:**

```
$ letra init
? Nome do workspace: minha-feature
? Onde criar o workspace? (~/.letra/workspaces/minha-feature) [enter]
? Quantos targets (projetos) esse workspace coordena? 3
? Caminho do target 1: ~/projetos/service-auth
? Caminho do target 2: ~/projetos/service-payment
? Caminho do target 3: ~/projetos/notificacoes
✓ Workspace criado em ~/.letra/workspaces/minha-feature/
  workflow.json, specs/, session-log.json
✓ Nenhum arquivo criado dentro dos targets
```

**Efeito prático para o caso do usuário (feature cross-service):**

```bash
# setup único
letra init --workspace ~/minha-feature

# pulse em qualquer target
cd ~/projetos/service-auth
letra pulse                           # compat: acha .letra/ se houver

# OR de qualquer lugar
letra --workspace ~/minha-feature pulse

# mover item entre stages
letra --workspace ~/minha-feature flow move ITEM-42 --to review

# build/test em target específico
letra --workspace ~/minha-feature build --target auth
letra --workspace ~/minha-feature test --target payment

# web UI apontando para o workspace
letra --workspace ~/minha-feature flow serve

# web UI em outro terminal navegando o workspace
letra --workspace ~/campanha-marketing-2026 flow serve
```

**Regra de ouro:** O letra **NUNCA** cria arquivos dentro dos targets (`.letra/`, `.cursorrules`, `AGENTS.md`, etc.) sem permissão explícita do usuário via comando "push". O adapter output é um push voluntário.

## Estratégia de Implementação

Não precisa reescrever tudo de uma vez. A abordagem é **estratosférica**:

```
Fase 0: Fundação — Workspace isolado (agora — ITEM-39)
├── --workspace flag + LETRA_WORKSPACE env
├── Targets: array de {id, path, projectType, buildCommand?, testCommand?}
├── loadWorkflow() busca em workspace (não em .letra/ no cwd)
├── Specs/session-log no workspace, não nos targets
├── Nada é criado nos targets sem `letra push`
└── Backward compat: .letra/ no cwd continua funcionando

Fase 1: Comandos e detectores agnósticos (ITEM-39 extendido)
├── buildCommand/testCommand no schema (default: null)
├── pulse/sitrep: se null, skip silencioso
├── pulse/sitrep roda no target[].path, não no cwd
├── file-search: busca nos targets, se general retorna false
└── Detectors code-only: rodam só se projectType === "software"

Fase 2: Templates e adapters (próximo item)
├── Templates não-dev em .letra/templates/
├── Adapter system extensível (adapters[] per target)
├── Adapter output via `letra push` para os targets
└── Setup wizard pergunta targets, ferramentas, templates

Fase 3: Purge de viés (futuro)
├── Renomear "code" stage nos defaults → "doing"
├── Mensagens neutras nos formatters
├── Termos no UI e CLI
└── "ADR" → "Registro de Decisão"
```

## Riscos

- **Backward compatibility**: workflow.json existente não tem `buildCommand`. Default null → skip, que é safe.
- **Detectores code-only rodando em projetos general**: com a Fase 1, eles simplesmente não rodam. Zero falso positivo.
- **Usuário existente com "code" stage**: nenhuma mudança forçada. O stage continua existindo. Só novos projetos terão defaults diferentes quando implementarmos Fase 3.

## Acceptance Criteria

### Fase 0 — Workspace isolado
- [ ] **AC1**: `--workspace` flag + `LETRA_WORKSPACE` env implementados no CLI. `loadWorkflow()` busca no workspace.
- [ ] **AC2**: Targets configuráveis em `workflow.json` (array `{id, path, projectType, buildCommand?, testCommand?}`).
- [ ] **AC3**: Specs e session-log salvos no workspace, não nos targets. Nada criado nos targets sem `letra push`.
- [ ] **AC4**: Backward compat: `.letra/` no cwd continua funcionando (fallback).

### Fase 1 — Comandos e detectores agnósticos
- [ ] **AC5**: `buildCommand`/`testCommand` no schema (default null). `pulse`/`sitrep` skipam quando null.
- [ ] **AC6**: `pulse`/`sitrep` rodam no `target[].path`, não no cwd.
- [ ] **AC7**: `file-search` busca nos targets. Se `projectType === "general"`, retorna false.
- [ ] **AC8**: Detectores code-only (`ac-false-pos`, `ac-stale`, `spec-code-drift`) rodam só se `projectType === "software"`.

### Fase 2 — Templates e adapters
- [ ] **AC9**: Templates não-dev em `.letra/templates/`. Templates built-in: `campanha-marketing`, `pesquisa`, `evento`.
- [ ] **AC10**: Adapter system extensível (`adapters[]` per target). Adapter output via `letra push`.
- [ ] **AC11**: Setup wizard pergunta targets, ferramentas, templates.

### Fase 3 — Purge de viés
- [ ] **AC12**: Stage naming neutro — nenhum código hardcode "code". Usar `s.zone` ou lookup por ID.
- [ ] **AC13**: "ADR" → "Registro de Decisão". Mensagens neutras nos formatters. Termos no UI/CLI.

## Decisões

1. **`projectType` no workflow.json** → enum `"software" | "general"`, default `"general"`. O init auto-detecta: se tem `package.json`, `*.csproj`, `Cargo.toml` → `"software"`. Senão → `"general"`.
2. **`buildCommand`/`testCommand`** → string opcional. Init preenche com auto-detect ou deixa null.
3. **Detectores code-only** → ganham flag `codeOnly: true`. Engine só executa se `projectType === "software"`.
4. **SearchConfig** → cada detector declara o que busca. Engine injeta configuração baseada em `projectType`.
5. **Adapters** → schema do workflow.json ganha `adapters[]` como array configurável. O init preenche com auto-detect + pergunta interativa.
6. **Workspace isolado** → workspace é um diretório separado dos targets. Targets são referenciados por caminho absoluto. `--workspace` flag ou `LETRA_WORKSPACE` env. Nada é criado dentro dos targets sem permissão explícita (`letra push`).
