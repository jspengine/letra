# Spec: cross-spec-dep

> Updated: 2026-06-22

## Outcome

Specs podem depender uns dos outros (ex: ITEM-32 diagnostics UI depende de ITEM-31 diagnostics web). Se um spec muda (ex: API endpoint renomeado), specs dependentes podem quebrar silenciosamente. Este detector identifica dependências entre specs e alerta quando um spec dependente está em estágio diferente do spec que mudou.

## Constraints

- Certeza 0.6 (suggest-only) — dependências entre specs são heurísticas, não determinísticas
- Dependência inferida por: referência a outro spec ID no text, referência a endpoint/arquivo de outro spec
- Não requer configuração manual de dependências — inferência automática
- Alerta quando spec A (code) referencia spec B (done) e B foi modificado após A entrar em code

## Exclusions

- Dependências cíclicas — o grafo ignora ciclos (alerta apenas o mais recente)
- Dependências externas (npm, APIs de terceiros) — escopo só intra-projeto
- Resolução automática — suggest-only

## Acceptance Criteria

- [x] **Inferência de dependência**: Detecta referências entre specs via IDs e paths de API
- [x] **Grafo temporal**: Compara `updatedAt` entre specs dependentes
- [x] **Alerta de drift**: Se spec B mudou depois de spec A referenciá-la, sugere revisão de A
- [x] **Testes**: Spec A referencia B, B alterado → alerta; B não alterado → silêncio

## Context

O problema é real neste projeto: ITEM-31 (diagnostics web) expõe endpoints `/api/diagnostics/*`. ITEM-32 (diagnostics UI) consome esses endpoints. Se ITEM-31 renomeia um endpoint, ITEM-32 quebra. Hoje não há nada que detecte isso.
