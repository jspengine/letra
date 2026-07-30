# Regression Safety Before Expansion

**Data:** 2026-07-03
**Status:** Accepted
**Autores:** Product Engineering e Architecture

## Contexto

O Letra evolui simultaneamente em domínio, harness, CLI, servidor e Web UI. Uma mudança aparentemente local pode alterar adapters, estado canônico, fluxos, auditoria ou jornadas já utilizadas. Executar apenas testes novos ao final não protege adequadamente essas relações.

Também existe o risco inverso de transformar prevenção de regressão em uma lista fixa de comandos sem relação com o impacto real. Quantidade de testes não comprova preservação de comportamento.

## Decisão

A prevenção de regressão passa a fazer parte do desenho de toda mudança. Antes da implementação, a spec deverá identificar:

- comportamento existente que precisa ser preservado;
- contratos e fronteiras afetados;
- baseline verificável antes da mudança;
- testes necessários conforme o risco;
- estratégia de compatibilidade, migração ou rollback;
- risco residual conhecido.

Correções de bugs deverão incluir teste de regressão que reproduza o problema. Features deverão executar testes direcionados e também a suíte das superfícies afetadas. Alterar ou remover uma expectativa existente exigirá decisão explícita, nunca simples adaptação do teste para aceitar o novo código.

## Evidência Mínima de Conclusão

Uma feature somente poderá ser concluída quando houver registro de:

1. comportamento protegido;
2. testes adicionados ou preservados;
3. suítes e verificações executadas;
4. resultados obtidos;
5. falhas preexistentes separadas de regressões novas;
6. riscos residuais e estratégia de reversão, quando aplicável.

## Consequências

- Specs passam a considerar regressão desde o Design.
- Bugs corrigidos deixam um teste permanente.
- Mudanças em harness, schema e APIs exigem compatibilidade explícita.
- Testes não podem ser enfraquecidos para legitimar regressões.
- ACs sem evidência de regressão permanecem pendentes.
