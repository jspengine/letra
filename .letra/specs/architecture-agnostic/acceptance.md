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
