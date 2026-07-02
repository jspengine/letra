# Spec: harness-centralized

> Updated: 2026-06-24

## Outcome

Usuário do Letra com workspaces multi-repositório consegue manter o harness `.letra/` centralizado no diretório de trabalho, enquanto cada pasta alvo referência este harness via `.letra-link`. Ferramentas agênticas (OpenCode, Cursor, Claude Code, etc.) nos diretórios alvo "enxergam" o contexto completo do workspace.

## Constraints

1. Nenhuma alteração em ferramentas agênticas de terceiros — a referência deve ser do lado do Letra
2. `.letra-link` deve ser um arquivo texto simples, sem dependências binárias
3. O resolvedor deve funcionar em Windows e Unix sem diferença de comportamento
4. A WEB UI (flow-serve) deve refletir o workspace correto independente de qual diretório o servidor foi iniciado
5. Setup flow (WorkspaceSetupFlow) deve persistir workspaces no `~/.letra/workspaces/` do CLI, não em localStorage

## Exclusions

- Suporte a harness versionado (L1-L4) fora do escopo imediato
- Editor visual de `.letra-link` (criação apenas via setup flow)
- Migração automática de workspaces existentes

## Acceptance Criteria

- [x] **AC1**: CLI `resolveWorkspaceRoot(cwd)` busca em 3 níveis: (1) `cwd/.letra/`, (2) `cwd/.letra-link` apontando para workDir, (3) `detectManifest(cwd)` 
- [x] **AC2**: `flow-serve.ts` usa `resolveWorkspaceRoot` em vez de `this.root` hardcoded — todos os endpoints resolvem o harness do workspace correto
- [x] **AC3**: Setup flow (WorkspaceSetupFlow) executa `initWorkspace()` do CLI e persiste em `~/.letra/workspaces/` — sem localStorage
- [x] **AC4**: Ao finalizar setup, para cada target folder é criado `{target}/.letra-link` contendo o caminho do workDir
- [x] **AC5**: Ao finalizar setup, para cada adapter selecionado, gera config de referência no target (ex: `.cursorrules` com `@include`, `CLAUDE.md` com referência)
- [x] **AC6**: Web UI "Meus Workspaces" lista workspaces de `~/.letra/workspaces/` via API `/api/workspaces`
- [x] **AC7**: Web UI "Meus Workspaces" permite criar workspace via setup flow que chama `/api/workflow/setup`
- [x] **AC8**: WorkspacesView remove dependência de localStorage, opera via API

## Context

Hoje o Letra assume `cwd/.letra/` como localização do harness. Para suportar múltiplos repositórios (pastas alvo) com um único harness centralizado, precisamos de:

1. **Resolvedor em cascata**: busca `.letra/` local → `.letra-link` → `letra.manifest.json` → fallback
2. **Referência leve**: arquivo `.letra-link` em cada target apontando para o workDir dono do harness
3. **CLI + Web alinhados**: setup flow web chama as mesmas funções do CLI (`initWorkspace`, `generateManifest`)
4. **Adapter configs injetados**: arquivos como `.cursorrules`, `CLAUDE.md`, `.windsurfrules` em cada target com referência ao harness central

A infraestrutura base já existe em `packages/cli/src/workspace/` (WorkspaceResolution, Manifest, initWorkspace, detectManifest) mas está desconectada do web server.
