## Acceptance Criteria

### AC1: Arquivo gerado em `.hermes/instructions.md` (text format)
- [x] `generate.ts` inclui `hermes` em `TOOL_TARGETS` com `path: ".hermes/instructions.md"`, `format: "text"`, `displayName: "Hermes Agent"`
- [x] Diretório `.hermes/` criado automaticamente se não existir
- [x] Header: `# Gerado por letra flow move. Nao edite manualmente.`

### AC2: Conteúdo do adapter inclui seções obrigatórias
- [x] **Contexto (L1)**: `.letra/context.md`, `.letra/constitution.md`, `.letra/glossary.md`, `.letra/constraints.md`, `.letra/focus.md` (se existir)
- [x] **Checklist de Início**: pulso, alertas, contexto, item ativo, mão na massa
- [x] **Comandos Disponíveis**: leitura, escrita, setup (mesmo conjunto dos outros adapters)
- [x] **Pendências Detectadas**: alertas `novo` do health-record (até 5 + contador)
- [x] **Checklist de Encerramento**: CONTINUE / BLOCKED / ALL_DONE
- [x] **Regras**: specs first, validate, constitution, flow move

### AC3: Integração no fluxo de regeneração
- [x] `flow-move.ts` chama `generateAdapters` com `tools` incluindo `"hermes"` quando presente no `workflow.tools`
- [x] `flow-claim.ts` / `flow-release.ts` também regeneram (já chamam `writeWorkflow` que trigga adapters)
- [x] `init.ts` inclui `"hermes"` nos tools padrão se detectado Hermes (opcional: auto-detect via `.hermes/` existence)

### AC4: Workflow tools array
- [x] `workflow.json` aceita `"hermes"` no array `tools`
- [x] `flow init --quick` pergunta "Quais agentes? (cursor, claude-code, opencode, vscode, windsurf, hermes)" e salva no workflow

### AC5: Testes — Mutation Testing + Property-Based Testing
- [x] **Unit tests**: `packages/cli/src/adapters/hermes.test.ts` — cobre `buildHarnessSnapshot` + `formatAdapterContent` para Hermes
- [x] **Property tests**: `packages/cli/src/adapters/hermes.property.test.ts` — `fast-check` para invariantes:
  - Snapshot sempre tem `workflowName` se `hasWorkflow`
  - `primaryItemId` sempre pertence a `items` do stage ativo
  - Alertas só incluem status `novo`
  - Header correto por source (`init` | `flow-move` | `focus`)
- [ ] **Mutation testing**: `npm run test:mutants` roda Stryker nos arquivos do adapter Hermes; threshold **≥80% mutation score** (Stryker não configurado no projeto — postergado)
- [ ] **Integration test**: `packages/cli/src/commands/flow-move.integration.test.ts` — `flow move` em repo temp gera `.hermes/instructions.md` com conteúdo esperado (postergado — semanda de testes de integração)

### AC6: Documentação
- [x] `AGENTS.md` do Letra (este repo) inclui `hermes` na lista de tools suportadas
- [ ] `README.md` ou docs do projeto mencionam Hermes Agent como target suportado (postergado — README será atualizado em item separado)
