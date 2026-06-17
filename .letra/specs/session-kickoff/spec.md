# Checklist de Início — Protocolo de Abertura de Sessão do Agente

> Updated: 2026-06-15

## Outcome

Quando um agente (OpenCode, Cursor, Claude Code, Windsurf) inicia uma sessão no workspace, ele não precisa adivinhar por onde começar. Uma seção "Checklist de Início" no adaptador instrui exatamente: leia o pulse, verifique alertas, identifique o item atual, leia o context.md, e prossiga.

A primeira ação do agente é sempre a mesma independente da ferramenta. O humano não precisa repetir instruções.

## Linguagem (UX)

| Termo Técnico | Termo Humano | Seção no Adaptador |
|---|---|---|
| session kickoff | checklist de início | `## Checklist de Início` |
| pulse check | verificar pulso | 1. `letra pulse` — como está o workspace |
| alert review | verificar alertas | 2. Ver Pendências Detectadas |
| context read | ler contexto | 3. Ler `context.md` |
| item identification | identificar item | 4. Qual item está ativo? |
| backlog fallback | entrar na fila | 5. Se não há item ativo, pegar do backlog |

## Constraints

- Seção aparece sempre que o workspace tem workflow inicializado
- Máximo 10 linhas no adaptador — concisa, direta
- Passos são checkboxes mentais, não acionáveis via clique
- Ordem importa: pulse → alertas → contexto → item
- Se não há item ativo, o último passo instrui a pegar do backlog
- A seção é gerada automaticamente junto com os adaptadores
- Não depende de health-record existir — funciona sem

## Architecture

### Seção no Adaptador

```markdown
## Checklist de Início

1. **Verificar pulso**: `letra pulse` — veja o estado atual do workspace
2. **Verificar alertas**: Leia "Pendências Detectadas" acima (se houver)
3. **Ler contexto**: Abra `.letra/context.md` para contexto completo
4. **Identificar item**: O pulse mostra qual item está ativo e seus ACs
5. **Mão na massa**: Se não há item ativo, pegue o primeiro do backlog:
   ```
   letra flow backlog --stage backlog
   letra pulse --json  # confirma estado
   letra flow move ITEM-N --to design
   ```
```

### Regras por Situação

| Situação | Fluxo de Início |
|---|---|
| Item ativo (code/review) | Pulse → alertas → contexto → ler spec do item → trabalhar |
| Item em design | Pulse → alertas → contexto → ler spec → validar design → codificar |
| Nenhum item ativo | Pulse → backlog → escolher item → mover para design → trabalhar |
| Alerta de severidade alta no pulse | Reconhecer ou resolver alerta ANTES de trabalhar |

### Integração com o Gerador de Adaptadores

```typescript
function buildKickoffSection(workflow: Workflow): string {
  const hasActiveItem = workflow.items.some(i => 
    ["design", "code", "review"].includes(i.stage)
  );

  const lines = ["## Checklist de Início", ""];
  lines.push("1. **Verificar pulso**: `letra pulse` — veja o estado atual do workspace");
  lines.push("2. **Verificar alertas**: Leia \"Pendências Detectadas\" acima (se houver)");
  lines.push('3. **Ler contexto**: Abra `.letra/context.md` para contexto completo');
  
  if (hasActiveItem) {
    lines.push("4. **Identificar item**: O pulse mostra qual item está ativo e seus ACs");
    lines.push("5. **Mão na massa**: Trabalhe no item ativo seguindo os ACs da spec");
  } else {
    lines.push("4. **Pegar do backlog**: Se não há item ativo:");
    lines.push("   ```");
    lines.push("   letra flow backlog --stage backlog");
    lines.push("   letra pulse --json");
    lines.push("   letra flow move ITEM-N --to design");
    lines.push("   ```");
  }

  return lines.join("\n");
}
```

### Ordem no Adaptador

O adaptador gerado segue esta ordem:

```
L1: Identidade do Projeto
L2: Workflow (estágios, item atual)
L3: Foco + ACs
L4: Pendências Detectadas (condicional)
L5: Checklist de Início
L6: Comandos Disponíveis (condicional)
L7: Regras de Handoff (condicional)
```

Isso forma uma progressão natural: **quem sou → o que está rolando → o que está errado → por onde começar → quais ferramentas → o que fazer depois**.

## Acceptance Criteria

- [ ] **Seção "Checklist de Início"**: Aparece no adaptador quando workflow existe
- [ ] **5 passos**: pulse → alertas → contexto → item → mão na massa
- [ ] **Sem item ativo**: Último passo instrui a pegar do backlog com comandos
- [ ] **Com item ativo**: Último passo instrui a trabalhar no item
- [ ] **Ordem correta no adaptador**: Após Pendências Detectadas e antes de Handoff
- [ ] **Concisa**: Máximo 10 linhas
- [ ] **Sem dependência**: Funciona sem health-record, sem situation-room
- [ ] **Regeneração automática**: Atualizada quando adapters são gerados
- [ ] **Testes**: Seção com item ativo, sem item ativo, sem health-record

## Exclusions

- Instruções específicas por tipo de tarefa (bug, feature, refactor) — sempre o mesmo protocolo
- Execução automática dos passos — agente decide se e como executar
- Tutorial de como usar a ferramenta (OpenCode/Cursor) — só os passos Letra

## Context

Este spec fecha o último gap do ciclo agêntico: a primeira ação. Antes, o agente chegava e não sabia por onde começar. Agora tem um checklist explícito: pulse → alertas → contexto → item → trabalhar.

A ordem no adaptador segue uma progressão de leitura natural:
1. Quem sou (Identidade)
2. O que está rolando (Workflow + Foco)
3. O que está errado (Alertas)
4. Por onde começar (Checklist)
5. Quais ferramentas (Comandos)
6. O que fazer depois (Handoff)
