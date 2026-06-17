# Protocolo de Decisões — Quando o Agente Deve Registrar uma Escolha

> Updated: 2026-06-15

## Outcome

Quando um agente faz uma escolha técnica durante o trabalho (biblioteca, arquitetura, abordagem, workaround), ele registra a decisão automaticamente em `.letra/decisions/`. O humano pode consultar o histórico de decisões e entender o "porquê" de cada escolha. A confiança aumenta porque nada é invisível.

## Linguagem (UX)

| Termo Técnico | Termo Humano | Onde |
|---|---|---|
| decision protocol | registrar decisão | Seção no adaptador |
| decision trigger | gatilho de decisão | Situações que exigem registro |
| context | contexto | O problema que gerou a decisão |
| alternatives | alternativas | O que foi considerado |
| chosen approach | escolha | O que foi feito |
| reasoning | justificativa | Por que essa escolha |

## Constraints

- Usa o formato existente de `.letra/decisions/` (mesmo de `decision-new`): `slug.md` com frontmatter
- A seção no adaptador lista os gatilhos que exigem registro
- O agente decide se uma situação é um gatilho — não é automático
- A decisão deve incluir: contexto, alternativas consideradas, escolha, justificativa
- Se a decisão desvia do spec, o AC correspondente deve ser atualizado
- O `letra decision new` já existe — este spec apenas define QUANDO usar

## Architecture

### Gatilhos de Decisão (seção no adaptador)

```markdown
## Registrar uma Decisão

Registre uma decisão em `.letra/decisions/` sempre que:

  - Escolher uma biblioteca ou框架 (ex: "usar Express em vez de Fastify")
  - Definir arquitetura (ex: "separar em 3 camadas em vez de 2")
  - Desviar do spec (ex: "AC diz X, mas optamos por Y porque Z")
  - Fazer workaround (ex: "bug no Node 22, workaround com setTimeout")
  - Escolher entre abordagens equivalentes (ex: "SQL vs NoSQL para este caso")

Comando:
  letra decision new "slug-da-decisao"

Formato esperado no arquivo gerado:
  - Contexto: qual era o problema/cenário
  - Alternativas: o que foi considerado (pelo menos 2)
  - Escolha: o que foi feito
  - Justificativa: por que esta em vez das outras
```

### Gatilhos por Situação

| Situação | Precisa de Decisão? | Exemplo |
|---|---|---|
| Escolher biblioteca | ✅ Sim | "express vs fastify vs hono" |
| Nome de variável | ❌ Não | Detalhe de implementação |
| Arquitetura de diretórios | ✅ Sim | "flat vs domain-driven" |
| Cor de botão no CSS | ❌ Não | Estilo, não decisão arquitetural |
| Workaround para bug | ✅ Sim | "bug no parser, workaround com regex" |
| Desvio de spec | ✅ Sim (obrigatório) | "spec diz Firebase, optamos por Supabase" |
| Escolha de algoritmo | ⚠️ Depende | "bubble sort vs quick sort" — só se relevante |
| Formato de API | ✅ Sim | "REST vs GraphQL vs tRPC" |

### Template de Decisão

```markdown
# Usar JSON puro sem Zod para Schema Validation

> Updated: 2026-06-15
> Status: adopted

## Contexto

O health-record.json precisa de validação de schema. O spec diz "schema
versionado". Considerei usar Zod para type checking em runtime.

## Alternativas

1. **Zod**: Validação runtime completa, gera tipos TS automaticamente.
   Prós: segurança de tipos em runtime. Contras: +13KB no bundle, mais
   complexidade, dependência externa.

2. **JSON puro + TypeScript interface**: Validar na mão no load/save.
   Prós: zero dependências, simples, type checking em compile time.
   Contras: sem validação runtime (dados corrompidos passam).

3. **Ajv**: JSON Schema validator.
   Prós: padrão JSON Schema, amplamente usado. Contras: +8KB no bundle,
   complexidade de schema.

## Escolha

JSON puro + TypeScript interface. O schema é simples (≤5 campos),
o risco de dados corrompidos é baixo, e zero dependências externas
mantém o core do Letra enxuto.

## Justificativa

O Letra tem como constraint "zero dependências runtime externas".
Zod e Ajv quebram essa constraint. O ganho de segurança não justifica
o custo em complexidade e tamanho de bundle para um schema tão simples.
```

### Integração com o Adaptador

A seção `## Registrar uma Decisão` aparece no adaptador sempre que há workflow inicializado. Fica entre o Checklist de Início (L5) e os Comandos Disponíveis (L6):

```
L5: Checklist de Início
L6: Registrar uma Decisão          ← NOVO
L7: Comandos Disponíveis
L8: Pendências Detectadas
L9: Regras de Handoff
```

### Registro no Diário de Bordo

Quando `letra decision new` é executado, um registro é adicionado ao session-log automaticamente:

```json
{
  "id": "log-00X",
  "timestamp": "2026-06-15T18:10:00.000Z",
  "action": "decision",
  "description": "Decisão: usar JSON puro sem Zod para schema validation",
  "itemId": "ITEM-41",
  "acId": null,
  "details": { "decisionFile": ".letra/decisions/json-schema-sem-zod.md" }
}
```

## Acceptance Criteria

- [ ] **Seção "Registrar uma Decisão"**: Aparece no adaptador com gatilhos listados
- [ ] **5 gatilhos documentados**: biblioteca, arquitetura, desvio de spec, workaround, abordagens equivalentes
- [ ] **Tabela de situações**: Incluída no spec, documenta o que é ou não decisão
- [ ] **Template**: Definição do formato esperado (Contexto, Alternativas, Escolha, Justificativa)
- [ ] **Desvio de spec**: Gatilho obrigatório — decisão deve ser registrada
- [ ] **Integração session-log**: `letra decision new` registra no diário automaticamente
- [ ] **Ordem no adaptador**: Após Checklist de Início, antes de Comandos
- [ ] **Testes**: Seção aparece, gatilhos documentados, desvio de spec é obrigatório

## Exclusions

- Decisões retroativaS — apenas decisões tomadas DURANTE o trabalho
- Aprovação humana da decisão — agente decide e registra; humano confere depois
- Reversão de decisão — se a escolha se mostrou errada, nova decisão substitui

## Context

O `decision-new` spec já existe e o `letra decision new` já funciona. O que falta é o agente SABER QUANDO usar. Sem este protocolo, o agente faz escolhas técnicas importantes que ficam invisíveis — o humano descobre depois ("por que usaram SQLite?!").

A seção no adaptador com gatilhos explícitos resolve: o agente lê, entende as situações que exigem registro, e age de acordo. A confiança humano-agente aumenta porque nada é escondido.
