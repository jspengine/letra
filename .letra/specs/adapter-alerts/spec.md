# Alertas no Adaptador — Visibilidade de Pendências para o Agente

> Updated: 2026-06-15

## Outcome

Quando um agente (OpenCode, Cursor, Claude Code, etc.) inicia uma sessão no workspace, ele lê o arquivo adaptador (AGENTS.md, .cursorrules, CLAUDE.md) e vê imediatamente os alertas ativos do prontuário de saúde. Não precisa rodar `letra health` — a informação já está lá, no formato que o agente entende.

O desenvolvedor não precisa lembrar de verificar alertas manualmente. O agente já chega sabendo o que está desalinhado, o que precisa de atenção, e onde os problemas estão.

## Linguagem (UX)

| Termo Técnico | Termo Humano | Contexto |
|---|---|---|
| adapter / agent file | adaptador / briefing do agente | AGENTS.md, .cursorrules, CLAUDE.md |
| health entry | alerta / pendência | Item no prontuário de saúde |
| L5 section / diagnostics section | Pendências Detectadas | Seção no adaptador |
| active alerts | alertas ativos | Status "novo" + "ciente" (exclui descartado/resolvido) |

## Constraints

- Seção de alertas aparece apenas quando há entradas ativas no prontuário
- Máximo 5 alertas "novo" no adaptador para não poluir o arquivo
- Se houver mais que 5, exibe "... e mais N alertas"
- Alertas "ciente" não aparecem na seção principal, apenas se `--all`
- Formato legível por humanos **e** parseável por agentes (consistente)
- Geração automática: toda vez que adapters são regenerados (após flow move, init, focus)
- O formato deve ser o mesmo em todas as ferramentas (cursor, opencode, vscode, windsurf, claude-code)

## Architecture

### Seção no Adaptador (AGENTS.md, .cursorrules, etc.)

```markdown
## Pendências Detectadas

Alerta · severidade média
  ID: hr-001
  O que: AC "Login com email" não encontrado no código fonte
  Onde: detector ac-stale
  Desde: 15/06/2026
  Ação: `letra health ack hr-001` (marcar como ciente) ou `letra health dismiss hr-001 --reason "já corrigido"`

Alerta · severidade alta
  ID: hr-003
  O que: Snapshot de correção ocupa 2.4MB — muito acima do ideal (50KB)
  Onde: detector snapshot-bloat
  Desde: 14/06/2026
  Ação: `letra health ack hr-003` ou revisar snapshots em `.letra/history/snapshots/`
```

### Seção Ausente (quando não há alertas)

A seção `## Pendências Detectadas` simplesmente não aparece. O adaptador termina no L4 (foco/tasks) sem ruído adicional.

### Formato Máquina (parsing por agente)

Cada alerta segue o padrão:

```
Alerta · severidade {baixa|media|alta}
  ID: {id}
  O que: {título}
  Onde: {detector}
  Desde: {data}
  Ação: {comando sugestão}
```

Um agente pode parsear isso com regex e extrair IDs, severidades, e comandos.

### Integração com Geração de Adaptadores

```typescript
// generate.ts — formatAdapterContent()
function formatAdapterContent(workflow, options) {
  const sections = [L1, L2, L3, L4];
  const healthRecord = loadHealthRecord(rootDir);
  const activeAlerts = healthRecord.entries
    .filter(e => e.status === "novo")
    .slice(0, 5);
  
  if (activeAlerts.length > 0) {
    sections.push(formatAlertSection(activeAlerts));
  }
  
  if (options.all && healthRecord.entries.length > 0) {
    sections.push(formatAllEntries(healthRecord.entries));
  }
  
  return sections.join("\n\n");
}

function formatAlertSection(alerts) {
  const lines = ["## Pendências Detectadas", ""];
  for (const alert of alerts) {
    lines.push(`Alerta · severidade ${alert.severity}`);
    lines.push(`  ID: ${alert.id}`);
    lines.push(`  O que: ${alert.title}`);
    lines.push(`  Onde: ${alert.source}`);
    lines.push(`  Desde: ${formatDate(alert.detectedAt)}`);
    lines.push(`  Ação: \`letra health ack ${alert.id}\``);
    lines.push("");
  }
  return lines.join("\n");
}
```

### Gatilhos de Regeneração

A seção de alertas é regenerada quando:
1. `letra health scan` executa (alerta novo aparece ou some)
2. `letra health ack/dismiss` marca entrada (muda estado ativo)
3. `letra flow move` (adapters já regeneram)
4. `letra init` (adapters já regeneram)
5. `letra focus` (adapters já regeneram)

## Acceptance Criteria

- [ ] **Seção condicional**: Adaptador só tem `## Pendências Detectadas` se health-record tem entradas "novo"
- [ ] **Limite 5**: Máximo 5 alertas na seção; excedente vira "... e mais N alertas"
- [ ] **Formato consistente**: Mesmo formato em AGENTS.md, .cursorrules, CLAUDE.md, .windsurfrules
- [ ] **Ação sugerida**: Cada alerta inclui linha `Ação:` com comando `letra health ack/dismiss`
- [ ] **Severidade**: Alertas exibem badge de severidade (baixa/media/alta)
- [ ] **Regeneração**: `letra health scan` → adapters regenerados automaticamente
- [ ] **Zero alertas**: Sem entradas "novo" → seção não aparece (sem ruído)
- [ ] **--all**: `letra generate --all` inclui alertas "ciente" também
- [ ] **Parseável**: Agente extrai IDs e comandos por regex consistente
- [ ] **Testes**: Alerta aparece com 1 entrada "novo", não aparece com 0 entradas, limite 5 com "e mais N"

## Exclusions

- UI gráfica para alertas — apenas seção textual no adaptador
- Alertas formatados diferente por ferramenta — todas usam o mesmo formato
- Histórico completo no adaptador — apenas ativos

## Context

Este spec substitui o rascunho anterior `diagnostics-adapter`. A mudança de nome reflete que não são "diagnósticos" técnicos — são "alertas" que um humano ou agente precisa ver para agir. A seção no adaptador é a ponte entre o prontuário (health-record) e o agente que vai atuar no workspace.

Sem este spec, o agente nunca sabe que existem alertas. O health-record existe mas fica invisível.
