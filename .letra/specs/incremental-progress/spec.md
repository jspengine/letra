# Progresso Parcial — Quando o Agente Não Termina Tudo

> Updated: 2026-06-15

## Outcome

O agente não precisa escolher entre "mover item completo" ou "não mover nada". Quando faz progresso parcial (ex: 2 de 5 ACs de um item), ele registra quais ACs concluiu sem mover o item de estágio. O histórico fica no diário de bordo, e na próxima sessão ele retoma exatamente de onde parou.

## Linguagem (UX)

| Termo Técnico | Termo Humano | Onde |
|---|---|---|
| incremental progress | progresso parcial | Protocolo de handoff + session-log |
| partial completion | ACs concluídos hoje | Lista de ACs feitos nesta sessão |
| continuation point | ponto de retomada | Último AC trabalhado |
| full completion | item completo | Todos os ACs do item concluídos |
| task tracking | tarefas do item | Subtasks dentro de um item (já existem no workflow) |

## Constraints

- Mover item de estágio SÓ quando TODOS os ACs estão concluídos — não muda
- 3 cenários: FULL (todos ACs ✅ → move), PARTIAL (alguns ✅ → registra), NONE (nenhum ✅ → registra)
- O progresso parcial é registrado no session-log — não em arquivo separado
- O agente consulta `letra pulse` para ver quantos ACs faltam (antes e depois)
- O handoff-rules é atualizado para incluir os 3 cenários
- Tasks (dentro de um item) são atualizadas manualmente pelo agente no workflow.json? Não — tasks são opcionais e não bloqueiam move
- A regra é clara: ACs definem conclusão, não tasks

## Architecture

### Os 3 Cenários no Handoff

O handoff-rules existente diz "Se um AC foi concluído, mover o item". Isso é substituído por:

```markdown
4. **Verificar progresso**: `letra pulse --json` — veja ACs do item atual
   
   a) **Item completo** (todos ACs [x]):
      → `letra flow move ITEM-X --to proximo_estagio`
      → `letra log ac "todos os ACs" --item ITEM-X`
   
   b) **Progresso parcial** (alguns ACs [x], outros [ ]):
      → NÃO mova o item
      → Registre no diário: `letra log add "AC-001 e AC-002 concluídos" --item ITEM-X`
      → Se sessão está no fim: `letra log session-end`
      → Relate: "Fiz X de Y ACs. Próximo: AC-003"
   
   c) **Nenhum progresso** (ACs continuam [ ]):
      → NÃO mova o item
      → Registre no diário: `letra log add "Trabalhei em ITEM-X mas ACs não concluídos" --item ITEM-X`
      → Relate o que foi feito e por que ACs não avançaram
```

### Lógica de Decisão

```typescript
// Lógica do agente (NÃO no Letra — no protocolo do adaptador)
function decideMoveAction(pulse: PulseData): "full" | "partial" | "none" {
  if (!pulse.currentItem) return "none";

  const { pending, done, total } = pulse.currentItem.acs;

  if (done === total && total > 0) return "full";
  if (done > 0) return "partial";
  return "none";
}
```

### Integração com `letra pulse`

O `letra pulse --json` já mostra AC counts (`pending`, `done`, `total`). O agente compara `done` antes e depois do trabalho para saber se houve progresso.

O pulse também mostra tasks quando existem:

```json
{
  "currentItem": {
    "acs": { "pending": 3, "done": 2, "total": 5 },
    "tasks": { "open": 1, "done": 2, "total": 3 }
  }
}
```

### Exemplo de Sessão com Progresso Parcial

```
Sessão 1:
  pulse → ITEM-41, ACs 0/6
  Trabalha → implementa schema JSON, load/save
  pulse → ITEM-41, ACs 2/6 (progresso! mas não todos)
  log add "Schema + load/save prontos. Faltam API REST, CLI, testes"
  session-end

Sessão 2:
  log --since yesterday → "parei no AC-003"
  pulse → ITEM-41, ACs 2/6
  Retoma de AC-003 → API REST
  pulse → ITEM-41, ACs 4/6
  ...continua...

Sessão 3:
  Termina ACs 5 e 6
  pulse → ITEM-41, ACs 6/6 ✅
  flow move ITEM-41 --to review
```

### Seção no Adaptador (atualização do handoff)

O handoff-rules existente ganha o passo "4. Verificar progresso" com os 3 cenários acima. A seção completa fica:

```markdown
## Após completar uma ação

1. **Validar**: `letra validate`
   ✅ Passou → próximo passo
   ❌ Falhou → `letra diagnose`, corrija, `letra validate` de novo

2. **Verificar saúde**: `letra pulse`
   ✅ Sem alertas de severidade alta → próximo passo
   ❌ Alertas altos → `letra health`, ack/corrija, `letra pulse` de novo

3. **Atualizar situação**: `letra sitrep`
   ✅ Sucesso → próximo passo

4. **Verificar progresso**: `letra pulse --json`
   🔵 Item completo (todos ACs ✅) → `flow move ITEM-X --to proximo`
   🟡 Progresso parcial (alguns ✅) → `log add`, NÃO mover, relatar
   ⚪ Nenhum progresso → `log add`, relatar o que foi feito

5. **Confirmar build**: `npm run build`
   ✅ Passou → finalizado
   ❌ Falhou → corrija, `npm run build` de novo
```

## Acceptance Criteria

- [ ] **3 cenários documentados**: FULL (move), PARTIAL (log + não move), NONE (log + não move)
- [ ] **Handoff-rules atualizado**: Passo 4 substituído pelos 3 cenários
- [ ] **Progresso parcial**: SÓ move quando todos ACs concluídos — nunca antes
- [ ] **Registro**: `letra log add` usado para marcar progresso parcial
- [ ] **Detecção**: Agente usa `letra pulse --json` para comparar AC counts antes/depois
- [ ] **Continuidade**: session-log + pulse permitem retomar exatamente de onde parou
- [ ] **Tasks não bloqueiam**: Tasks podem ficar abertas mesmo com item movido (só ACs importam)
- [ ] **Testes**: Cenário FULL move, PARTIAL não move e registra, NONE não move e registra

## Exclusions

- Percentual de progresso (gráfico, barra) — só contagem de ACs
- Mover item com ACs pendentes "por engano" — não permitido
- Aprovação humana para progresso parcial — agente decide

## Context

Este spec resolve o falso dilema "ou move o item completo ou não move nada". Na prática, um item de 6 ACs raramente é concluído em uma única sessão. O agente precisa de um caminho intermediário: registrar o progresso sem fingir que terminou.

O handoff-rules existente já diz "Se um AC foi concluído, mover o item" — isso está errado para progresso parcial. A correção é: mover APENAS se TODOS os ACs estão concluídos; caso contrário, registre no diário e continue.
