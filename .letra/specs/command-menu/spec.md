# Cardápio de Comandos — Ferramentas que o Agente Tem

> Updated: 2026-06-15

## Outcome

O agente sabe exatamente quais comandos Letra estão disponíveis, categorizados por propósito (leitura, escrita, setup), sem precisar adivinhar ou rodar `--help`. O adaptador lista o cardápio em formato conciso: comando + descrição de uma linha. O agente consulta e usa.

## Linguagem (UX)

| Termo Técnico | Termo Humano | Seção no Adaptador |
|---|---|---|
| command menu | cardápio de comandos | `## Comandos Disponíveis` |
| safe commands | leitura (seguro) | Categoria: não mudam estado |
| write commands | escrita (muda estado) | Categoria: alteram workflow/prontuário |
| setup commands | configuração | Categoria: init, focus |
| pipeline commands | fluxo | Categoria: flow commands |

## Constraints

- Seção aparece apenas quando há workflow inicializado
- Comandos categorizados por risco (leitura vs escrita)
- Descrição máxima de uma linha por comando
- Máximo 15 comandos no total (para não poluir o adaptador)
- Comandos são links literais (inline code) — copiar e colar
- A seção é gerada automaticamente junto com os adaptadores
- Ferramentas diferentes podem ter comandos diferentes? Não — mesmo conjunto para todas

## Architecture

### Seção no Adaptador

```markdown
## Comandos Disponíveis

Leitura (seguro — não muda nada):
  letra pulse                    — Overview do workspace
  letra health                   — Alertas ativos
  letra health --all             — Alertas incluindo resolvidos
  letra sitrep --dry-run         — Simular atualização de contexto
  letra flow board               — Todas as colunas do fluxo
  letra flow backlog             — Itens no backlog

Escrita (muda estado):
  letra health ack <id>          — Reconhecer alerta
  letra health dismiss <id>      — Descartar alerta
  letra health scan              — Re-executar verificações
  letra sitrep                   — Atualizar context.md
  letra flow move <id> --to <s>  — Mover item entre estágios
  letra focus <spec>             — Definir foco

Setup:
  letra validate                 — Validar specs e ACs
  letra focus --clear            — Limpar foco
```

### Lógica de Geração

```typescript
function buildCommandMenu(): string {
  return [
    "## Comandos Disponíveis",
    "",
    "Leitura (seguro — não muda nada):",
    "  `letra pulse`                    — Overview do workspace",
    "  `letra health`                   — Alertas ativos",
    "  `letra health --all`             — Alertas incluindo resolvidos",
    "  `letra sitrep --dry-run`         — Simular atualização de contexto",
    "  `letra flow board`               — Todas as colunas do fluxo",
    "  `letra flow backlog`             — Itens no backlog",
    "",
    "Escrita (muda estado):",
    "  `letra health ack <id>`          — Reconhecer alerta",
    "  `letra health dismiss <id>`      — Descartar alerta",
    "  `letra health scan`              — Re-executar verificações",
    "  `letra sitrep`                   — Atualizar context.md",
    "  `letra flow move <id> --to <s>`  — Mover item entre estágios",
    "  `letra focus <spec>`             — Definir foco",
    "",
    "Setup:",
    "  `letra validate`                 — Validar specs e ACs",
    "  `letra focus --clear`            — Limpar foco",
  ].join("\n");
}
```

### Integração com a Ordem do Adaptador

```
L5: Checklist de Início        — "por onde começar"
L6: Comandos Disponíveis       — "quais ferramentas"     
L7: Pendências Detectadas      — "o que está errado" (se houver)
L8: Regras de Handoff          — "o que fazer depois" (se item ativo)
```

### Evolução do Cardápio

O cardápio é a única seção que deve ser atualizada quando novos comandos são adicionados ao Letra. É a responsabilidade mais simples de manter — uma lista plana.

Ferramentas podem **estender** o cardápio nos próprios adaptadores específicos (ex: "OpenCode: use `/think` para refletir antes de executar"), mas o núcleo é sempre o mesmo.

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

## Exclusions

- Descrição detalhada de cada comando (flags, opções) — `letra <cmd> --help` para isso
- Comandos específicos de ferramentas (ex: atalhos do Cursor) — responsabilidade do adapter da ferramenta
- Exemplos de uso — apenas descrição de uma linha
- Comandos de inicialização (init, spec new) — usados apenas no setup inicial

## Context

O cardápio de comandos elimina a necessidade de o agente explorar `--help` ou adivinhar comandos. É a documentação mínima que permite ao agente usar todas as capacidades do Letra sem depender de conhecimento prévio.

A divisão leitura/escrita é crucial: agentes podem chamar comandos de leitura sem medo de efeito colateral. Comandos de escrita têm impacto e devem ser usados com critério.
