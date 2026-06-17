# Spec: Self-Diagnosis Core

> Updated: 2026-06-14

## Outcome

O Letra detecta automaticamente drifts entre specs, código e workflow — e os corrige sem perguntar nada ao usuário. Cada correção gera um snapshot que permite rollback com um clique, caso o usuário perceba algo errado. O usuário final nunca precisa pensar sobre o estado interno da ferramenta.

## Constraints

- Toda auto-correção deve gerar snapshot em `.letra/snapshots/{timestamp}_{diagnosticId}.json` antes de modificar qualquer arquivo
- Snapshots mais antigos que 30 dias são limpos automaticamente
- Cada detector opera independentemente — falha em um não afeta os outros
- Nenhum detector pode depender de rede externa ou LLM
- A corrida de detectores não pode ultrapassar 500ms total

## Architecture

```
diagnostics/
├── engine.ts           — orquestrador: roda detectores, aplica fixes, gerencia snapshots
├── snapshot.ts         — save/restore/cleanup de snapshots
├── detectors/          — cada detector é um arquivo isolado
│   ├── ac-stale.ts     — AC [ ] com implementação existente → [x]         (user)
│   ├── ac-false-pos.ts — AC [x] sem implementação → [ ]                   (user)
│   ├── stage-drift.ts  — workflow.json estágio ≠ cobertura real           (user)
│   ├── missing-dir.ts  — .letra/templates/ etc ausentes → cria            (user)
│   └── dead-icons.ts   — ícone referenciado mas não definido → placeholder (dev-only)
└── index.ts            — API pública: runAll(), getResults(), undo(snapshotId)
```

### Dev-Only Detectors

Detectores marcados com `devOnly: true` só rodam quando o engine detecta que está executando dentro do repositório do próprio Letra (presença de `packages/cli/package.json`). Para projetos de usuário, estes detectores são pulados silenciosamente — não geram resultados, fixes ou sugestões.

O filtro é feito em `engine.ts` via `isLetraRepo()`: verifica se o arquivo `packages/cli/package.json` existe na raiz. Se não existe, todos os detectores com `devOnly: true` são ignorados no loop de `runAll()`.

## Acceptance Criteria

- [x] **engine.runAll()**: Executa todos os detectores em paralelo, coleta resultados
- [x] **Auto-fix certo**: Se detector tem certeza ≥ 90% (harness-stale, missing-dir, dead-icons), aplica correção automaticamente e registra snapshot
- [x] **Suggest-only**: Se detector tem certeza < 90% (stage-drift parcial, ac-false-pos), retorna como sugestão sem aplicar
- [x] **Snapshot pré-fix**: Antes de qualquer auto-correção, salva estado anterior dos arquivos modificados
- [x] **engine.undo(snapshotId)**: Restaura arquivos do snapshot, apaga snapshot
- [x] **Cleanup automático**: Snapshots >30d são removidos na inicialização do engine
- [x] **Detector AC stale**: Varre `*.test.ts` por padrões `AC-<specId>-<numero>` e compara com `acceptance.md` — AC `[ ]` com teste passando → auto-corrige para `[x]`
- [x] **Detector missing-dir**: Lista de diretórios obrigatórios (`.letra/templates/`, `.letra/brand/`) — ausente → cria
- [x] **Detector dead-icons**: Varre JSX `<Icon name="X">` vs `ICONS` map — referenciado não definido → adiciona placeholder
- [x] **Detector stage-drift**: Item com 100% ACs implementados em estágio `review` ou anterior → sugere mover para `done`
- [x] **Detector ac-false-pos**: AC `[x]` sem teste ou implementação correspondente → sugere marcar como `[ ]`
- [x] **Dev-only filter**: Detectores com `devOnly: true` são pulados se `isLetraRepo()` retorna `false`

## Exclusions

- Detector de dead code (exports sem imports) — depende de análise de módulos que foge ao escopo
- Detector de numbering-conflict (workflow.json vs AGENTS.md) — resolvido por AGENTS.md ser gerado, não detectado
- Qualquer detector que exija LLM, API externa, ou análise semântica profunda
- UI do usuário — isso é responsabilidade do spec diagnostics-ui

## Context

Decisão consciente: auto-corrigir sem perguntar. O usuário final não quer ser DevOps da ferramenta. Se a correção estiver errada, o undo existe. Se o undo nunca for usado, os snapshots viram lixo em 30 dias. O custo de um falso positivo (auto-corrigir algo que não deveria) é baixo porque o rollback é instantâneo e visível.
