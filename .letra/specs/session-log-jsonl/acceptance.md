## Acceptance Criteria

- [ ] **JSONL append**: `logEntry()` escreve no arquivo diário com `appendFileSync` — O(1), sem load+rewrite
- [ ] **Daily rotation**: `session-log/YYYY/MM/DD.jsonl` — arquivo por dia, criado automaticamente no primeiro write
- [ ] **Log levels**: `logEntry()` aceita `level: 'info' | 'debug'`. Default `info`. Entradas `system` com `systemAction=true` viram `debug`
- [ ] **Query default info**: `queryLog()` sem `--debug` retorna apenas entradas `info` (humanas)
- [ ] **Query debug**: `queryLog()` com `--debug` retorna tudo (info + debug)
- [ ] **Retention prune**: `letra log prune --keep <N>` remove arquivos JSONL mais velhos que N dias
- [ ] **Legacy compat**: `loadSessionLog()` lê `session-log.json` antigo (se existir) e também o diretório `session-log/` com JSONLs
- [ ] **Multi-file query**: `queryLog()` faz merge de todos os arquivos JSONL disponíveis + legacy, ordena por timestamp
- [ ] **Performance**: escrita de 10K entradas em < 500ms (vs ~30s no modelo atual)
- [ ] **Testes**: append, rotation, prune, legacy compat, query multi-file, log levels, performance benchmark
