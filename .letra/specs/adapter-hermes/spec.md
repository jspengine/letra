# Spec: adapter-hermes

> Updated: 2026-06-22

## Outcome

O Hermes Agent (desktop GUI app) consome o contexto do Letra via arquivo de instruções gerado automaticamente a cada `flow move`, `focus` ou `init`. O adapter produz um arquivo `.hermes/instructions.md` (ou similar) que o Hermes injeta no system prompt do agente, garantindo que o LLM tenha: workflow atual, item ativo, ACs pendentes, alertas de saúde, e comandos disponíveis — sem configuração manual.

## Constraints

- **Zero dependência de npm/Node no projeto alvo** — o Hermes roda como desktop app, o adapter só escreve arquivo Markdown
- **Formato compatível com Hermes** — seguir o padrão de `AGENTS.md` (text format) que o Hermes já entende
- **Regeneração atômica** — mesmo hook dos outros adapters: `init`, `flow-move`, `focus`
- **Domain-agnostic** — não assume stack do projeto alvo (C#, Python, Go, Rust, etc.)
- **Mutation testing obrigatório** — todo código novo deve passar `npm run test:mutants` (Stryker) com threshold ≥80%
- **Property-based testing** — detectores e builders usam `fast-check` para invariantes

## Exclusions

- **UI do Hermes** — não está no escopo; o Hermes lê o arquivo, não o Letra
- **Protocolo ACP** — se o Hermes adotar ACP no futuro, será spec separada
- **Múltiplos formatos** — apenas `text` (como `AGENTS.md`, `CLAUDE.md`)

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

## Context

Este adapter fecha o gap para usuários do **Hermes Agent** (app desktop da Nous Research) que querem usar o Letra como memory framework. O Hermes já consome `AGENTS.md`/`CLAUDE.md`; o adapter Hermes usa o mesmo formato `text` e estrutura, mas em caminho dedicado `.hermes/instructions.md` para evitar colisão com outros agentes.

**ADR**: `.letra/decisions/adapter-hermes-architecture.md` — captura Context → Decision → Consequences completo, incluindo alternativas rejeitadas e trade-offs.

Decisões de design baseadas em análise profunda dos adapters existentes:
- `builder.ts` já constrói `HarnessSnapshot` completo — reutilizamos 100%
- `formatters.ts` já formata L1, L5, Kickoff, Commands, Completion, Rules — reutilizamos 100%
- `generate.ts` já itera `TOOL_TARGETS` e escreve arquivos — adicionamos 1 entrada
- `flow-move.ts` já chama `generateAdapters` com `workflow.tools` — zero mudança no command
- `health-record.ts` já fornece alertas — já integrado no snapshot

**Mutation testing rule**: Adotamos Stryker (`@stryker-mutator/core`, `@stryker-mutator/vitest-runner`) como gate de qualidade. CI falha se mutation score < 80%. Property-based tests com `fast-check` cobrem edge cases que unit tests exemplares não pegam.
