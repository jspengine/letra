# Regras de Handoff — Protocolo de Ações Pós-Tarefa

> Updated: 2026-06-15

## Outcome

Quando um agente completa uma tarefa (edita código, atualiza spec, move item), ele sabe exatamente o que fazer em seguida — inclusive o que fazer quando algo dá errado. O adaptador contém uma seção "Após completar uma ação" com passos claros e rotas de recuperação para cada falha possível.

O ciclo fecha sem o humano precisar lembrar o agente do que fazer. O agente tem um protocolo explícito que cobre o caminho feliz E os desvios.

## Linguagem (UX)

| Termo Técnico | Termo Humano | Contexto |
|---|---|---|
| handoff protocol | regras de handoff | Seção no adaptador com passos pós-tarefa |
| post-action steps | próximos passos | Sequência de comandos após completar tarefa |
| validation gate | verificação | `letra validate` ou `letra lint` antes de mover |
| sitrep | atualizar situação | `letra sitrep` para context.md refletir mudanças |
| pulse check | verificar pulso | `letra pulse` para confirmar estado |

## Constraints

- Seção aparece apenas quando há um item ativo no workflow (estágio "doing")
- Passos padrão são sempre os mesmos, mas podem ser estendidos por config
- A seção é concisa — máximo 10 linhas no adaptador
- Comandos são executáveis via copy-paste (inline code blocks)
- Não é automação — o Letra não executa comandos, apenas instrui o agente
- O humano pode desabilitar a seção via config (`"handoff": false`)

## Architecture

### Seção no Adaptador

```markdown
## Após completar uma ação

1. **Validar**: `letra validate`
   ✅ Passou → próximo passo
   ❌ Falhou → `letra diagnose` para identificar, corrija o problema,
              `letra validate` de novo — só prossiga se passar

2. **Verificar saúde**: `letra pulse`
   ✅ Sem alertas de severidade alta → próximo passo
   ❌ Alertas altos → `letra health` para ver detalhes,
       `letra health ack <id>` se já está ciente ou
       corrija o problema antes de prosseguir

3. **Atualizar situação**: `letra sitrep`
   ✅ Feito → próximo passo
   ❌ Erro → comum na primeira execução (seção não existe ainda).
        O comando cria a seção automaticamente.

4. **Mover item**: Se ACs foram concluídos:
   ```
   letra flow move ITEM-39 --to review
   ```
   ✅ Movido → próximo passo
   ❌ Bloqueado → os portões de validação do estágio não passaram.
        Leia o erro, corrija, tente de novo.

5. **Confirmar build**: `npm run build`
   ✅ Passou → finalizado
   ❌ Falhou → corrija o erro de compilação, `npm run build` de novo
```

### Diagrama de Decisão

```
VALIDAR
  ├─ ✅ Passou → PULSE
  └─ ❌ Falhou → DIAGNOSE → CORRIGIR → VALIDAR

PULSE
  ├─ ✅ Sem alertas altos → SITREP
  └─ ❌ Alertas altos → HEALTH → ACK/CORRIGIR → PULSE

SITREP
  ├─ ✅ Sucesso → FLOW MOVE
  └─ ❌ Erro → criar seção manual → FLOW MOVE

FLOW MOVE
  ├─ ✅ Movido → BUILD
  └─ ❌ Bloqueado → LER ERRO → CORRIGIR → FLOW MOVE

BUILD
  ├─ ✅ Passou → 🎉 FINALIZADO
  └─ ❌ Falhou → CORRIGIR → BUILD
```

### Quando a Seção Aparece

```typescript
// generate.ts — formatAdapterContent()
function buildHandoffSection(workflow: Workflow): string | null {
  const activeItems = workflow.items.filter(i => 
    ["code", "review", "design"].includes(i.stage)
  );
  
  if (activeItems.length === 0) return null;
  
  const config = loadConfig(rootDir);
  if (config.handoff === false) return null;
  
  const primaryItem = activeItems[0]; // ou o do focus
  
  const recoveryPath = (step: string, failAction: string) =>
    `   ❌ Falhou → ${failAction}`;
  
  return [
    "## Após completar uma ação",
    "",
    "1. **Validar**: `letra validate`",
    "   ✅ Passou → próximo passo",
    recoveryPath("validate", "`letra diagnose`, corrija, `letra validate` de novo"),
    "",
    "2. **Verificar saúde**: `letra pulse`",
    "   ✅ Sem alertas altos → próximo passo",
    recoveryPath("pulse", "`letra health`, ack/corrija, `letra pulse` de novo"),
    "",
    "3. **Atualizar situação**: `letra sitrep`",
    "   ✅ Sucesso → próximo passo",
    "   ❌ Erro → comum na 1a execução (cria seção automático)",
    "",
    primaryItem ? "4. **Mover item**: Se ACs foram concluídos:" : null,
    primaryItem ? `   \`\`\`` : null,
    primaryItem ? `   letra flow move ${primaryItem.id} --to proximo_estagio` : null,
    primaryItem ? `   \`\`\`` : null,
    primaryItem ? "   ✅ Movido → próximo passo" : null,
    primaryItem ? recoveryPath("move", "leia o erro, corrija o bloqueio, tente de novo") : null,
    primaryItem ? "" : null,
    "5. **Confirmar build**: `npm run build`",
    "   ✅ Passou → 🎉 finalizado",
    recoveryPath("build", "corrija o erro, `npm run build` de novo"),
  ].filter(Boolean).join("\n");
}
```

### Configuração

```json
// .letra/config.json
{
  "handoff": {
    "enabled": true,
    "customSteps": [
      "npm run typecheck — verificar tipos"
    ],
    "skipSteps": ["build"]
  }
}
```

### Fluxo Completo do Agente (com Recuperação)

```
1. AGENTE CHEGA → Checklist de Início
   ↓
2. Lê adaptador → vê seções L5-L8
   ↓
3. Roda `letra pulse --json` → entende estado
   ↓
4. TRABALHA (edita código, spec, etc.)
   ↓
5. COMPLETA TAREFA
   ↓
6. Segue handoff com recovery paths:
   ┌──────────────┐
   │  VALIDATE    │ ←── ❌ ──→ DIAGNOSE → CORRIGIR → VALIDATE
   └──────┬───────┘
          ✅
   ┌──────▼───────┐
   │   PULSE      │ ←── ❌ ──→ HEALTH → ACK/CORRIGIR → PULSE
   └──────┬───────┘
          ✅
   ┌──────▼───────┐
   │   SITREP     │ ←── ❌ ──→ (automático: cria seção)
   └──────┬───────┘
          ✅
   ┌──────▼───────┐
   │  FLOW MOVE   │ ←── ❌ ──→ LER ERRO → CORRIGIR → FLOW MOVE
   └──────┬───────┘
          ✅
   ┌──────▼───────┐
   │   BUILD      │ ←── ❌ ──→ CORRIGIR → BUILD
   └──────┬───────┘
          ✅
        🎉 FEITO
   ↓
7. VOLTA PARA PASSO 1 (próxima sessão ou próximo item)
```

## Acceptance Criteria

- [ ] **Seção "Após completar uma ação"**: Aparece no adaptador quando há item ativo
- [ ] **Passos padrão com recovery**: validate (↔ diagnose), pulse (↔ health), sitrep, flow move, build
- [ ] **Recovery paths**: Cada passo documenta ❌ o que fazer em caso de falha
- [ ] **Item específico**: Comando `flow move` usa o ID do item ativo
- [ ] **Sem item ativo**: Seção não aparece (sem ruído)
- [ ] **Config desabilitar**: `"handoff": false` ou `"handoff.enabled": false` remove seção
- [ ] **Steps customizados**: `handoff.customSteps` adiciona passos extras
- [ ] **Skip steps**: `handoff.skipSteps` remove passos padrão
- [ ] **Formato conciso**: Máximo 20 linhas no adaptador (incluindo recovery paths)
- [ ] **Flow move com placeholder**: Usa `--to proximo_estagio` — humano/agente substitui
- [ ] **Regeneração**: Seção atualizada quando item muda de estágio
- [ ] **Testes**: Seção aparece com item ativo, recovery paths corretos por passo, sem item não aparece, custom/skip steps, disabled via config

## Exclusions

- Execução automática dos passos — apenas instrução textual
- Handoff diferente por tipo de tarefa — mesmo protocolo para tudo
- Validação de que o agente seguiu os passos — confiança no agente
- Recovery automático — agente decide quando e como recuperar

## Context

Este spec fecha o ciclo agêntico. Os outros specs (health-record, adapter-alerts, situation-room, workspace-pulse) fornecem a infraestrutura de estado e visibilidade. O handoff-rules fornece o **protocolo** — o que fazer com essa infraestrutura.

Sem este spec, o agente tem as ferramentas (health, pulse, sitrep) mas não sabe quando usá-las. Com ele, o adaptador instrui explicitamente: "depois de trabalhar, faça X, Y, Z".
