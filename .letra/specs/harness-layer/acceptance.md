# Acceptance Criteria — harness-layer

## Fase 1 — Composição (bloqueante)

- [x] **Módulo adapters/**: `packages/cli/src/adapters/` existe com `builder.ts`, `generate.ts` e pelo menos um formatter.
- [x] **init usa generate**: `letra init` chama `generateAdapters()` — não tem lógica inline de adapter.
- [x] **flow move usa generate**: `letra flow move` chama `generateAdapters()` — não tem `adapterContent()` inline.
- [x] **L1 preservado após move**: Adapter gerado por `flow move` contém referências a `context.md`, `constitution.md` e `glossary.md`.
- [x] **L1 focus condicional**: Se `focus.md` existe, adapter referencia `.letra/focus.md`.
- [x] **Sintaxe cursor**: `.cursorrules` usa `@.letra/...` para L1.
- [x] **Sintaxe opencode**: `AGENTS.md` usa bullet list de paths para L1.
- [x] **Teste regressão**: `flow-move.test.ts` verifica presença de L1 references após move, não só nome do estágio.

## Fase 2 — Work signals + focus sync

- [ ] **Spec path em L2**: Item com `spec` no workflow exibe path `.letra/specs/{spec}/spec.md` no adapter.
- [ ] **Acceptance path em L2**: Item com spec exibe path `.letra/specs/{spec}/acceptance.md` no adapter.
- [ ] **AC counter**: L3 exibe `ACs: X/Y pendentes` computado de acceptance.md (fallback spec.md).
- [ ] **Task counter**: L3 exibe `Tasks: X/Y abertas` quando item tem tasks no workflow.
- [ ] **Item primário**: L3 identifica item do `flow move` como primário; se múltiplos no estágio, primeiro da lista.
- [ ] **focus sync no move**: `flow move` de item com spec reescreve `focus.md` com id, path e outcome.
- [ ] **focus override**: `letra focus <spec>` após `flow move` sobrescreve foco automático e regenera adapters.
- [ ] **focus regenerate**: `letra focus` e `letra focus --clear` regeneram adapters.
- [ ] **Formato focus unificado**: `focus.md` gerado por `flow move` usa mesmo template que `letra focus`.

## Fase 3 — Detecção ac-source-drift

- [ ] **Drift inline**: Quando contagem de ACs difere entre spec.md e acceptance.md, L3 inclui aviso `ac-source-drift`.
- [ ] **Detector harness-stale**: Diagnostics detecta adapter sem referências L1 e sugere `letra flow move` ou `letra focus`.
- [ ] **Specs adapter-* atualizadas**: Exclusion "sem sync automático" removida; AC de regeneração em flow move adicionado.

## Fase 4 — Limpeza de estado dinâmico

- [ ] **context.md sem Estado Atual**: Template de init não gera seção "Estado Atual" em context.md.
- [ ] **Dogfood context.md**: `.letra/context.md` do repo letra não contém item/estágio obsoleto.
- [ ] **Glossary atualizado**: Entrada "Adapter Regeneration" descreve composição em camadas.

## Não-regressão

- [ ] **Adapter thin**: Nenhum adapter gerado ultrapassa 60 linhas em projeto com 1 item ativo.
- [ ] **Sem spec inline**: Nenhum adapter contém texto de Outcome/Constraints copiado de spec.md.
- [ ] **Multi-tool**: `workflow.tools` com cursor+opencode+vscode gera os 3 arquivos corretos no mesmo evento.
- [ ] **111+ testes**: Suite existente passa; novos testes cobrem builder e formatters.
