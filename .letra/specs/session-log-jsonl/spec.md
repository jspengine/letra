# Spec: Session Log v2 — JSONL + Daily Rotation + Retention

> Updated: 2026-07-08

## Diagnosis

### Problema Raiz

O session-log atual (`session-log.json`) é um JSON array monolítico com rewrite completa em cada operação:

```
logEntry() → loadSessionLog() → readFileSync(arquivo inteiro) → JSON.parse() → push() → JSON.stringify() → writeFileSync(arquivo inteiro)
```

Isso gera 4 problemas:

**1. Write amplification O(n)**
Cada entrada nova carrega e reescreve o arquivo inteiro. Com 763K entradas, cada operação leva ~1-2s. 42 chamadas de automação por execução × segundos por chamada = minutos perdidos em I/O.

**2. Monolítico sem fronteiras temporais**
Um único arquivo cresce sem parar. Não há como "dar dc" em logs de ontem sem carregar tudo. Toda leitura é sobre o arquivo completo.

**3. Ruído de automação domina o sinal humano**
Das 763K entradas, ~90% são `system` de automação (autopilot, runner, health_scan). Ações humanas relevantes (item_move, decision, ac_done) são uma fração minúscula — difícil de encontrar.

**4. Spec original não cumprida — FIFO 500 nunca implementado**
A spec `session-log` dizia "Máximo 500 registros; >500 → remove os mais antigos". O AC "Limite FIFO" ficou pendente. O limite de 2000 que implementamos é paliativo.

### Evidências no Código

| Arquivo | Linha | Problema |
|---------|-------|----------|
| `session-log.ts:69-82` | `loadSessionLog` | Lê arquivo inteiro com `readFileSync` |
| `session-log.ts:134-138` | `saveSessionLog` | Reescreve arquivo inteiro com `writeFileSync` |
| `session-log.ts:155-168` | `logEntry` | load + push + save = 1 chamada = 2 I/O completos |
| `session-log.ts:217-224` | `queryLog` / `queryLogWithMeta` | Carrega arquivo inteiro mesmo pra 1 entrada |
| `phases/runner.ts:34-108` | Runner | 7 `logEntry` por execução de fase |
| `phases/autopilot.ts:32-83` | Autopilot | 8 `logEntry` por ciclo |
| `commands/health.ts:81-152` | Health | 3 `logEntry` por scan |

## Outcome

O session-log passa a ser:
- **Append-only verdadeiro** — JSONL (JSON Lines), O(1) por entrada, sem rewrite
- **Rotacionado por dia** — arquivos em `session-log/YYYY/MM/DD.jsonl`, previsíveis e pequenos
- **Com níveis** — `info` (default, ações humanas) vs `debug` (system/automação)
- **Com política de retenção** — `letra log prune --keep 7` mantém apenas N dias
- **Queries multi-arquivo** — buscam em todos os JSONLs do diretório + legacy JSON
- **Backward compatível** — `loadSessionLog()` lê formato antigo e novo

## Architecture

### Formato JSONL

```
{"id":"log-001","timestamp":"2026-07-08T10:00:00Z","action":"item_move","description":"Move ITEM-1","itemId":"ITEM-1","acId":null,"details":{},"level":"info"}
{"id":"log-002","timestamp":"2026-07-08T10:00:01Z","action":"system","description":"autopilot:starting","itemId":"ITEM-2","acId":null,"details":{},"level":"debug"}
```

Cada linha é um JSON válido. Append com `writeFileSync(path, line, {flag:'as'})` — sem ler, sem parse, sem rewrite.

### Estrutura de Diretórios

```
.letra/
├── session-log.json          ← legado (apenas leitura)
└── session-log/              ← novo diretório
    ├── 2026/
    │   ├── 07/
    │   │   ├── 08.jsonl      ← hoje
    │   │   ├── 07.jsonl      ← ontem
    │   │   └── 06.jsonl      ← anteontem
    │   └── 06/
    │       └── 30.jsonl
    └── archive/              ← logs podados (opcional, não obrigatório nesta fase)
```

### Fluxo de Escrita

```
logEntry() → path = session-log/2026/07/08.jsonl → mkdir -p → appendFileSync(line + '\n') → O(1)
```

Nenhum load, nenhum parse, nenhum rewrite. Zero contenção.

### Fluxo de Leitura

```
queryLog() →
  1. Lê session-log.json (legado, se existir)
  2. Lista *.jsonl em session-log/2026/**/*
  3. Lê cada arquivo como linhas, JSON.parse por linha
  4. Merge + sort por timestamp (reverse chronological)
  5. Aplica filtros e paginação
```

Leitura carrega múltiplos arquivos, mas cada um é pequeno (diário = ~centenas de entradas).

### Níveis de Log

| Nível | Uso | Visível em `--info` (default) | Visível em `--debug` |
|-------|-----|-------------------------------|----------------------|
| `info` | Ações humanas: item_move, decision, ac_done, validate | Sim | Sim |
| `debug` | Automação: autopilot, runner, health_scan, system | Não | Sim |

O campo `level` é opcional no JSONL (default `info` para backward compat). Entradas `system` com details.systemAction recebem `level: "debug"` automaticamente.

## Constraints

- Backward compatible: `loadSessionLog()` continua aceitando `session-log.json` legado em modo leitura
- Zero perda acidental: `log prune` só remove com flag `--keep` ou confirmação
- Sem dependências externas — apenas `node:fs` (appendFile, readdir, readFile, mkdir)
- `queryLog()` e `queryLogWithMeta()` mantêm mesma interface e semântica
- Harness e operational-audit normalizer continuam funcionando sem alterações
- O diretório `.letra/session-log/` é versionado em git (como `.letra/` todo)

## Exclusions

- Migração retroativa do `session-log.json` existente para JSONL (opcional)
- Compressão automática de arquivos (postergado)
- Interface UI para logs (apenas CLI nesta fase)
- Log remoto ou centralizado (SaaS, telemetria)
- Métricas de performance ou analytics de log

## Acceptance Criteria

- [x] **JSONL append**: `logEntry()` escreve no arquivo diário com `appendFileSync` — O(1), sem load+rewrite
- [x] **Daily rotation**: `session-log/YYYY/MM/DD.jsonl` — arquivo por dia, criado automaticamente no primeiro write
- [x] **Log levels**: `logEntry()` aceita `level: 'info' | 'debug'`. Default `info`. Entradas `system` com `systemAction=true` viram `debug`
- [x] **Query default info**: `queryLog()` sem `--debug` retorna apenas entradas `info` (humanas)
- [x] **Query debug**: `queryLog()` com `--debug` retorna tudo (info + debug)
- [x] **Retention prune**: `letra log prune --keep <N>` remove arquivos JSONL mais velhos que N dias
- [x] **Legacy compat**: `loadSessionLog()` lê `session-log.json` antigo (se existir) e também o diretório `session-log/` com JSONLs
- [x] **Multi-file query**: `queryLog()` faz merge de todos os arquivos JSONL disponíveis + legacy, ordena por timestamp
- [x] **Performance**: escrita de 10K entradas em < 500ms (vs ~30s no modelo atual)
- [x] **Testes**: append, rotation, prune, legacy compat, query multi-file, log levels, performance benchmark

## Context

### Histórico

O session-log foi implementado na primeira semana do projeto (spec: 2026-06-22). O design de JSON array com rewrite completo era aceitável para < 1000 entradas. Com a introdução de automações (autopilot, runner, health_scan, flow-serve), o volume explodiu para 763K entradas em 2 semanas.

O AC "Limite FIFO: Máximo 500 registros" nunca foi implementado — a spec foi seguida parcialmente. O MAX_ENTRIES=2000 que adicionamos em 08/07/2026 é um hotfix, não a solução definitiva.

### Trade-offs

| Abordagem | Pro | Contra |
|-----------|-----|--------|
| JSONL + daily rotation | O(1) write, previsível, trivial de podar | Leitura multi-arquivo é mais lenta que um único array |
| SQLite | Query flexível, índices | Dependência externa, complexidade, viola "sem dependências" do projeto |
| append-only JSONL sem rotação | Mais simples que daily | Arquivo único ainda cresce sem limites |
| JSON com streaming | Não precisa mudar formato | Node.js síncrono não tem streaming de escrita JSON eficiente |

JSONL + daily rotation foi escolhido porque:
- Zero dependências externas
- Write é genuinamente O(1) (append)
- Prune é trivial (`rm *.jsonl` por data)
- Leitura carrega N arquivos pequenos em vez de 1 gigantesco
- Formato é grep-ável com ferramentas padrão (`rg 'item_move' .letra/session-log/`)

### Relação com Specs Existentes

A spec `operational-audit` (AC3) diz: "retenção, rotação ou arquivamento preservam a evidência e permitem reconstruir a projeção". JSONL + prune com `--keep` atende este requisito: os dados rotacionados podem ser arquivados ou descartados com política explícita.

A spec `session-log` original continua valendo para o contrato de dados (id, timestamp, action, etc.). Esta spec v2 altera apenas o formato de armazenamento e adiciona níveis.
