# Spec: Diagnostics Adapter — Diagnóstico nos Adaptadores

> Updated: 2026-06-15

## Outcome

AGENTS.md, .cursorrules, CLAUDE.md e demais adaptadores incluem uma seção opcional de "Pendências Detectadas" quando o DiagnosticState tem entradas "new". O agente (seja opencode, cursor, claude-code) vê as pendências ativas assim que lê o arquivo — sem precisar chamar `POST /api/diagnostics/scan`.

## Constraints

- Nova L5 (diagnostics section) é condicional: só aparece se houver entradas "new"
- Formato compatível com at/text (mesmo padrão de L1-L4)
- Diagnóstico não polui adaptadores de projetos sem problemas (0 entradas "new" = sem L5)
- Não cria dependência circular: adapter gera L5, detector não valida adapter (seria meta-recurssão)
- L5 é gerada por `generateAdapters()` — não requer nova chamada de API

## Architecture

```
generateAdapters(root, tools, options)
    ↓
buildHarnessSnapshot(root, options)
    ↓
formatAdapterContent(snapshot, format, meta)
    ├── title
    ├── L1: context references
    ├── L2: workflow/items
    ├── L3: work signals
    ├── L4: rules
    └── L5: diagnostics (NOVO) — só se snapshot.diagnostics?.newEntries?.length > 0
    ↓
write header + content to adapter file

DiagnosticState lido em buildHarnessSnapshot:
    ├── Se .letra/diagnostics-state.json existe → carrega e conta "new"
    └── Se não existe → L5 vazio (sem seção)
```

### Formato L5 (text format — opencode, claude-code, vscode):

```markdown
## Pendências Detectadas

⚠ {N} pendência(s) precisam de revisão:
- {id}: {title} ({type}) — use `letra diagnostics ack {id}` ao revisar
```

### Formato L5 (at format — cursor, windsurf):

```
@Pendências Detectadas
⚠ {N} pendência(s) precisam de revisão:
@ {id}: {title}
```

## Acceptance Criteria

- [ ] **L5 condicional**: Seção não aparece quando `snapshot.diagnostics` é vazio ou não tem "new"
- [ ] **Formato text**: bullet list com ID, título, tipo e instrução de ack
- [ ] **Formato at**: `@` prefix com ID e título
- [ ] **Integração builder**: `buildHarnessSnapshot` aceita `diagnostics?: DiagnosticState` opcional
- [ ] **Integração formatters**: `formatAdapterContent` chama `formatDiagnostics()` se houver dados
- [ ] **Integração flow-move**: `flowMove()` carrega DiagnosticState e passa para generateAdapters
- [ ] **Fallback silencioso**: Sem diagnostics-state.json, gera adaptador normal sem L5
- [ ] **Testes**: L5 aparece com 1 entrada "new", não aparece com 0 entradas, formato at vs text
- [ ] **Limite**: Máximo 5 entradas "new" no L5 (para não poluir o adapter); excedente vira "... e mais N"

## Exclusions

- Detector que valida se L5 está presente (seria meta-recurssão — o meta-test já valida o harness)
- Modificação no `init.ts` — init gera adaptadores sem diagnóstico (não há engine rodando)
- Suporte a agendamento de ack via CLI (apenas marcação manual via `letra diagnostics ack`)

## Context

Atualmente o agente só descobre pendências se chamar a API manualmente. Como o primeiro contato do agente com o projeto é via AGENTS.md (ou equivalente), incluir pendências ali reduz o atrito. O agente vê o que precisa fazer antes mesmo de começar a codificar.
