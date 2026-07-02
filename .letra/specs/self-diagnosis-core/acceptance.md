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
