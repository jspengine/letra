## Acceptance Criteria

### Fase 0 — Workspace isolado
- [x] **AC1**: `--workspace` flag + `LETRA_WORKSPACE` env implementados no CLI. `loadWorkflow()` busca no workspace.
- [x] **AC2**: Targets configuráveis em `workflow.json` (array `{id, path, projectType, buildCommand?, testCommand?}`).
- [x] **AC3**: Specs e session-log salvos no workspace, não nos targets. Nada criado nos targets sem `letra push`.
- [x] **AC4**: Backward compat: `.letra/` no cwd continua funcionando (fallback).

### Fase 1 — Comandos e detectores agnósticos
- [x] **AC5**: `buildCommand`/`testCommand` no schema (default null). `pulse`/`sitrep` skipam quando null.
- [x] **AC6**: `pulse`/`sitrep` rodam no `target[].path`, não no cwd.
- [x] **AC7**: `file-search` busca nos targets. Se `projectType === "general"`, retorna false.
- [x] **AC8**: Detectores code-only (`ac-false-pos`, `ac-stale`, `spec-code-drift`) rodam só se `projectType === "software"`.

### Fase 2 — Templates e adapters
- [x] **AC9**: Templates não-dev em `.letra/templates/`. Templates built-in: `campanha-marketing`, `pesquisa`, `evento`.
- [x] **AC10**: Adapter system extensível (`adapters[]` per target). Adapter output via `letra push`.
- [x] **AC11**: Setup wizard pergunta targets, ferramentas, templates.

### Fase 3 — Purge de viés
- [x] **AC12**: Stage naming neutro — nenhum código hardcode "code". Usar `s.zone` ou lookup por ID.
- [x] **AC13**: "ADR" → "Registro de Decisão". Mensagens neutras nos formatters. Termos no UI/CLI.
