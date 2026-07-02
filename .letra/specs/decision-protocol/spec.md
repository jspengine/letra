# Spec: decision-protocol

> Updated: 2026-06-22

## Outcome

Quando um agente faz uma escolha técnica durante o trabalho (biblioteca, arquitetura, abordagem, workaround), ele registra a decisão automaticamente em `.letra/decisions/`. O humano pode consultar o histórico de decisões e entender o "porquê" de cada escolha. A confiança aumenta porque nada é invisível.

## Constraints

- Usa o formato existente de `.letra/decisions/` (mesmo de `decision-new`): `slug.md` com frontmatter
- A seção no adaptador lista os gatilhos que exigem registro
- O agente decide se uma situação é um gatilho — não é automático
- A decisão deve incluir: contexto, alternativas consideradas, escolha, justificativa
- Se a decisão desvia do spec, o AC correspondente deve ser atualizado
- O `letra decision new` já existe — este spec apenas define QUANDO usar

## Exclusions

- Decisões retroativaS — apenas decisões tomadas DURANTE o trabalho
- Aprovação humana da decisão — agente decide e registra; humano confere depois
- Reversão de decisão — se a escolha se mostrou errada, nova decisão substitui

## Acceptance Criteria

- [ ] **Seção "Registrar uma Decisão"**: Aparece no adaptador com gatilhos listados
- [ ] **5 gatilhos documentados**: biblioteca, arquitetura, desvio de spec, workaround, abordagens equivalentes
- [ ] **Tabela de situações**: Incluída no spec, documenta o que é ou não decisão
- [ ] **Template**: Definição do formato esperado (Contexto, Alternativas, Escolha, Justificativa)
- [ ] **Desvio de spec**: Gatilho obrigatório — decisão deve ser registrada
- [ ] **Integração session-log**: `letra decision new` registra no diário automaticamente
- [ ] **Ordem no adaptador**: Após Checklist de Início, antes de Comandos
- [ ] **Testes**: Seção aparece, gatilhos documentados, desvio de spec é obrigatório

## Context

O `decision-new` spec já existe e o `letra decision new` já funciona. O que falta é o agente SABER QUANDO usar. Sem este protocolo, o agente faz escolhas técnicas importantes que ficam invisíveis — o humano descobre depois ("por que usaram SQLite?!").

A seção no adaptador com gatilhos explícitos resolve: o agente lê, entende as situações que exigem registro, e age de acordo. A confiança humano-agente aumenta porque nada é escondido.
