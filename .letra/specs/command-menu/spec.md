# Spec: command-menu

> Updated: 2026-06-22

## Outcome

O agente sabe exatamente quais comandos Letra estão disponíveis, categorizados por propósito (leitura, escrita, setup), sem precisar adivinhar ou rodar `--help`. O adaptador lista o cardápio em formato conciso: comando + descrição de uma linha. O agente consulta e usa.

## Constraints

- Seção aparece apenas quando há workflow inicializado
- Comandos categorizados por risco (leitura vs escrita)
- Descrição máxima de uma linha por comando
- Máximo 15 comandos no total (para não poluir o adaptador)
- Comandos são links literais (inline code) — copiar e colar
- A seção é gerada automaticamente junto com os adaptadores
- Ferramentas diferentes podem ter comandos diferentes? Não — mesmo conjunto para todas

## Exclusions

- Descrição detalhada de cada comando (flags, opções) — `letra <cmd> --help` para isso
- Comandos específicos de ferramentas (ex: atalhos do Cursor) — responsabilidade do adapter da ferramenta
- Exemplos de uso — apenas descrição de uma linha
- Comandos de inicialização (init, spec new) — usados apenas no setup inicial

## Acceptance Criteria

- [x] **Seção "Comandos Disponíveis"**: Aparece no adaptador quando workflow existe
- [x] **Categorias**: Leitura, Escrita, Setup — cada uma com header claro
- [x] **Descrições concisas**: Máximo 1 linha por comando
- [x] **14 comandos no total**: 6 leitura, 6 escrita, 2 setup
- [x] **Formato consistente**: `inline code` + descrição em todas as ferramentas
- [x] **Sem duplicação**: Cada comando aparece em exatamente uma categoria
- [x] **Sem dependência**: Funciona sem health-record, sem situation-room
- [x] **Regeneração automática**: Atualizada quando adapters são gerados
- [x] **Testes**: Cardápio completo, comandos categorizados, sem duplicação

## Context

O cardápio de comandos elimina a necessidade de o agente explorar `--help` ou adivinhar comandos. É a documentação mínima que permite ao agente usar todas as capacidades do Letra sem depender de conhecimento prévio.

A divisão leitura/escrita é crucial: agentes podem chamar comandos de leitura sem medo de efeito colateral. Comandos de escrita têm impacto e devem ser usados com critério.
