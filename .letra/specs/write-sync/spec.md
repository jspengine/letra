# Spec: write-sync

> Updated: 2026-06-22

## Outcome

Toda mutação de `workflow.json` passa por um único gateway `writeWorkflow()` que garante side-effects consistentes: persiste o arquivo, regenera adapters (sem L2/L3), atualiza context.md (opcional), e registra no session log. O agente IA sempre recebe contexto consistente porque os arquivos derivados (AGENTS.md, context.md) são regenerados atomicamente a partir da fonte única.

## Constraints

- `writeWorkflow()` é o ÚNICO gateway de escrita de workflow.json — nenhum `writeFileSync` direto, nenhum `saveWorkflow()` bypassado
- `stage-drift` autoFix DEVE usar `writeWorkflow()` em vez de `writeFileSync` direto
- Adapter files (AGENTS.md, .cursorrules, etc.) NÃO contêm mais L2 (lista de itens) nem L3 (sinais de trabalho)
- Focus.md e health.ts continuam chamando `generateAdapters()` diretamente (não escrevem workflow)
- `letra sync` command permite reconciliação manual full
- Compatibilidade total com workflow.json existente — sem quebra de schema
- Performance: sitrep update é opcional (`skipSitrep`) porque roda testes; default é `skipSitrep: true` para mutações rápidas

## Exclusions

- Refatoração do `health-record.ts` — estado separado, fora do gateway
- Integração com watcher de arquivo (`fs.watch`) — futuro
- Migração do `focus.ts` e `health.ts` para o gateway — eles não escrevem workflow
- Mudanças no schema do `workflow.json`
- Mudanças na Web UI (`packages/client/`)
- Mudanças no sistema de detectores (exceto `stage-drift`)

## Acceptance Criteria

### AC1: Gateway writeWorkflow()

- [x] **`writeWorkflow()` existe** em `flow-init.ts` como função exportada
- [x] **Persiste** workflow.json com backup (mesmo comportamento de `saveWorkflow()` atual)
- [x] **Regenera adapters** chamando `generateAdapters()` internamente
- [x] **Atualiza context.md** via sitrep (apenas se `skipSitrep: false`)
- [x] **Registra no session log** via `logEntry()`
- [x] **Valida schema** do workflow antes de persistir (rejeita workflow sem `items` ou `stages`)
- [x] **Retorna** `{ ok, filesUpdated[] }` com paths dos arquivos gerados/regenerados
- [x] **Argumento `source`** obrigatório identifica quem chamou (para audit trail)

### AC2: Comandos migrados

- [x] `flow backlog add` → chama `writeWorkflow()` (não `saveWorkflow()`)
- [x] `flow move` → chama `writeWorkflow()` (não `saveWorkflow()` + `generateAdapters()`)
- [x] `flow edit` → chama `writeWorkflow()`
- [x] `flow import` (GitHub + Linear) → chama `writeWorkflow()`
- [x] `flow init` → chama `writeWorkflow()`
- [x] Nenhum comando acima chama `saveWorkflow()` diretamente

### AC3: stage-drift autoFix

- [x] `stage-drift` detector autoFix NÃO usa `writeFileSync` direto no workflow.json
- [x] `stage-drift` autoFix usa `writeWorkflow()` para mover para done
- [x] `stage-drift` permanece puro (autoFix retorna ação, engine executa) OU detector importa `writeWorkflow()` (decidir na implementação)

### AC4: Adapter sem L2/L3

- [x] AGENTS.md gerado NÃO contém "### Itens neste estagio"
- [x] AGENTS.md gerado NÃO contém "## Sinais de trabalho"
- [x] AGENTS.md gerado contém L1, L5, kickoff, command menu, completion checklist
- [x] `formatL2()` removida de `formatters.ts`
- [x] `formatL3()` removida de `formatters.ts`
- [x] `formatL5()` mantida em `formatters.ts`
- [x] Builder não computa mais `acPending`/`acTotal` para adapter (só para pulse)

### AC5: letra sync command

- [x] `letra sync` lê workflow.json atual
- [x] `letra sync` regenera adapters via `generateAdapters()`
- [x] `letra sync` atualiza context.md via sitrep
- [x] `letra sync` valida focus.md contra workflow (warning se item não existe ou está em done)
- [x] `letra sync --dry-run` mostra diff sem escrever
- [x] `letra sync --fix` aplica reconciliação (alias do sync sem --dry-run)

### AC6: Nada quebrado

- [x] `letra pulse` continua funcionando (lê workflow.json, não depende de adapters)
- [x] `letra health scan` continua funcionando (chama `generateAdapters()` direto)
- [x] `letra focus` continua funcionando (chama `generateAdapters()` direto)
- [x] `letra diagnose` continua funcionando (não toca workflow)
- [x] Web UI (`flow serve`) continua funcionando (lê via HTTP API)
- [x] Testes existentes continuam passando (246 testes, sem regressão)
- [x] Build CLI e UI continuam limpos

## Context

O problema de múltiplas fontes de verdade foi identificado durante uma auditoria em 16/06/2026: AGENTS.md apontava ITEM-16, focus.md apontava ITEM-47, context.md apontava ITEM-33, e o workflow.json (via pulse) apontava ITEM-32. Quatro versões diferentes da realidade.

Este spec implementa a decisão do ADR `write-sync-single-source-of-truth.md`: um motor de sincronização que garante que toda mutação de workflow propague side-effects consistentemente, eliminando o drift entre fontes derivadas.

O nome "write-sync" reflete o padrão Write-Through Cache: o gateway escreve na fonte (workflow.json) e imediatamente atualiza todos os caches dependentes (adapters, context.md), em vez de esperar que outro processo o faça.
