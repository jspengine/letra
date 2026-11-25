# Linha de base do MVP (ITEM-1)

Medição feita em 22/11/2026 no workspace `letra-mvp`, para servir de "antes" aos itens do M0 e do M1.

## Ambiente

| | Windows (esta medição) | Linux (plano do MVP) |
|---|---|---|
| Sistema | Windows 11 Pro 10.0.26200 | não registrado |
| Node | v24.14.0 | não registrado |
| Biome | 1.9.4 | não registrado |
| Código | `f62e36d` + 82 arquivos alterados no working tree | não registrado |

O working tree inclui alterações anteriores à sessão e a correção da resolução do harness (`packages/cli/src/harness/loader.ts`, `packages/cli/src/workspace/resolution.ts`, `packages/cli/src/commands/flow-init.test.ts` e o teste novo `loader-resolve.test.ts`). Por isso, esta medição não é de um commit limpo.

## Resultados

| Medida | Comando | Windows | Linux |
|---|---|---|---|
| Testes | `npm test` (`packages/cli`, vitest) | 891 passam, 94 falham, 1 pulado, de 986, em 25 arquivos com falha | 896 passam, 62 falham |
| Typecheck | `npm run typecheck` | `cli`: 1 erro. `ui`: 0 | 3 erros |
| Lint (regras) | `biome lint` no código-fonte | 78 erros, 344 avisos | 136 erros |
| Formatação | `biome format` no código-fonte | 473 erros | não registrado |

### Falhas de teste por área (`packages/cli/src`)

| Área | Testes falhando |
|---|---|
| `commands` | 40 |
| `session-log.test.ts` | 18 |
| `orchestrator` | 11 |
| `spec-frontmatter` | 8 |
| `diagnostics` | 5 |
| `adapters` | 4 |
| `health-record.test.ts`, `flow-serve`, `mcp`, `workflow-versions` | 2 cada |

Alguns testes (`session-log`, `flow-backlog`, `flow-export-import`) mudam de resultado entre rodadas: eles usam o diretório home real. O número de falhas pode variar alguns testes de uma rodada para outra.

### Typecheck

Único erro: `packages/cli/src/flow-serve/routes/item-routes.ts(231,60)` TS2345. O argumento não tem `expectedRevision` e `reason`, exigidos por `OperationContext`. O arquivo já estava alterado antes da sessão.

## Como o lint foi medido

`npm run lint` (`biome check packages/`) informa 3278 erros e 2186 avisos no Windows. Quase tudo vem de duas origens que não são código-fonte:

1. **Build do Storybook.** Cerca de 2314 erros de regra estão em `packages/ui/.storybook-static/assets/`, bundles minificados gerados localmente. A pasta está no `.gitignore`, mas o `biome.json` não usa o arquivo de ignore do VCS. Por isso foram analisados apenas os caminhos de código: `packages/cli`, `packages/client`, `packages/types`, `packages/ui/src`, `packages/ui/.storybook` e `packages/design-toolkit`. A extração do Storybook está registrada como ITEM-33.
2. **Fim de linha.** Com `core.autocrlf=true`, o checkout no Windows tem CRLF, e o formatador do Biome acusa cada arquivo. Registrado como ITEM-32.

Regras mais frequentes no código-fonte: `noShadowRestrictedNames` (12), `noUnusedTemplateLiteral` (11), `noDelete` (11), `noGlobalIsNan` (6).

## O que comparar depois

- Para comparar com o Linux, use o lint só do código-fonte (78 contra 136), não o `npm run lint`.
- A diferença de testes (94 contra 62 falhas) inclui testes sensíveis ao Windows e ao home real. O ITEM-3 deve partir da lista de arquivos com falha desta medição, não só do total.
