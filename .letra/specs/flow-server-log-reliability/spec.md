# Spec: Confiabilidade do Log do Flow Server

> Updated: 2026-07-03

## Outcome

O `letra flow serve` permanece disponível durante rajadas de alterações e contenções transitórias do Windows, sem corromper nem truncar o histórico auditável do workspace.

## Constraints

- O `session-log.json` permanece compatível com o schema versão 1 e com os leitores existentes.
- O histórico permanece append-only; esta correção não remove nem compacta registros existentes.
- Falhas persistentes de escrita devem ser observáveis, mas não podem encerrar o servidor por ocorrerem em telemetria de automação.
- Eventos repetidos do mesmo watcher devem ser coalescidos sem ocultar uma alteração efetiva.
- A escrita deve preservar uma versão JSON válida mesmo quando a substituição do arquivo falhar.

## Regression Baseline

- `logEntry` adiciona registros e preserva todo o histórico existente.
- `queryLog` e `queryLogWithMeta` mantêm filtros, ordenação e paginação.
- O runtime rearma watchers e diagnósticos ao trocar de workspace.
- O servidor publica atualizações de workflow após mudanças em specs.

## Acceptance Criteria

- [x] **AC1 - Escrita resiliente**: A persistência usa substituição atômica e repete operações que falham temporariamente com `UNKNOWN`, `EBUSY`, `EPERM` ou `EACCES`.
- [x] **AC2 - Integridade append-only**: Uma escrita bem-sucedida preserva todos os registros anteriores e nunca expõe JSON parcial.
- [x] **AC3 - Watcher coalescido**: Uma rajada de eventos de specs produz uma única atualização e um único ciclo auditável dentro da janela de debounce.
- [x] **AC4 - Telemetria não fatal**: Uma falha persistente ao registrar ação de watcher é informada sem encerrar o flow server.
- [x] **AC5 - Evidência de regressão**: Testes direcionados, typecheck, build e validação do Letra são executados e seus riscos residuais são registrados.

## Rollback

Reverter a persistência atômica e o debounce restaura o comportamento anterior sem migração de dados, pois o formato canônico do arquivo não é alterado. Arquivos temporários usam nome exclusivo e são removidos após sucesso ou falha.

## Regression Evidence

- Testes direcionados: 27 aprovados em `session-log.test.ts` e `automation-runtime.test.ts`.
- Suíte afetada: 70 aprovados; três integrações preexistentes de `focus/flow move` falharam por timeout e `EPERM` em diretórios temporários.
- Typecheck do CLI: aprovado.
- Inicialização real: `flow serve --port 3011` permaneceu ativo e `GET /api/workflow` retornou HTTP 200.
- Build: UI e client aprovados; bundle do CLI aprovado com `tsup --clean false`. O build limpo permanece bloqueado por `EPERM` sobre `packages/cli/dist/client/favicon.svg`, mantido aberto por processo externo.
- `letra validate`: 2 aprovados, 0 falhas e 633 avisos históricos.
- Risco residual: múltiplos processos ainda podem disputar atualizações append-only entre a leitura e a troca atômica; a correção cobre a contenção transitória observada e impede JSON parcial, mas não introduz lock distribuído.
