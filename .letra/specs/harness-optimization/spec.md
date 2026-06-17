# Spec: Harness Optimization — Loop de Execução para Agentes

> Updated: 2026-06-17

## Problema

O harness do Letra gera adapters para agentes de IA (opencode, Cursor, Windsurf, Claude Code, VS Code Copilot), mas o conteúdo gerado não é otimizado para como agentes realmente consomem instruções. Consequências:

1. **Agentes não seguem o loop de execução** — startup protocol é sugestão, não comando. As instruções existem no AGENTS.md, mas estão enterradas entre 6+ seções de peso igual.
2. **Sem hierarquia de prioridade** — "Verificar pulso" tem o mesmo peso visual que "Comandos Disponíveis" e "Checklist de Encerramento".
3. **Sem continuidade entre sessões** — agente volta sem saber o que foi feito na sessão anterior.
4. **ACs não são visíveis sem abrir spec.md** — focus.md tem outcome mas não tem ACs pendentes.
5. **Conteúdo desatualizado no context.md** — seções manuais (Estado Atual, Stack) ficam stale enquanto só o bloco sitrep é atualizado.
6. **Sem validação de entrada** — nada verifica se o estado do agente é consistente com o workspace.

## Análise de Consumidores

Cada ferramenta lê um arquivo diferente no início da sessão:

| Tool | Arquivo Lido | Formato | Lê Automaticamente? |
|---|---|---|---|
| opencode | `AGENTS.md` (via system prompt) | texto | ✅ Sim |
| opencode (futuro) | `.opencode/instructions.md` | texto | ✅ Sim (mais direto) |
| Cursor | `.cursorrules` | `@path` + texto | ✅ Sim |
| Windsurf | `.windsurfrules` | `@path` + texto | ✅ Sim |
| Claude Code | `CLAUDE.md` | texto | ✅ Sim |
| VS Code Copilot | `.github/copilot-instructions.md` | texto | ✅ Sim |

**Problema comum a todos**: o conteúdo gerado não resolve as 6 falhas acima, independente do formato.

## Abordagem

Repensar a estrutura de conteúdo do adapter para TODOS os tools, unificando o formato interno e priorizando por ordem de importância para o agente:

```
P1 — PROTOCOLO DE INÍCIO (imperativo, mandatory)
P2 — FOCO ATUAL + ACs (o que fazer agora)
P3 — ALERTAS ATIVOS (o que está bloqueando)
P4 — REGRAS (o que NÃO fazer — violação = erro grave)
P5 — COMANDOS (como fazer — referência rápida)
P6 — ENCERRAMENTO (como saber quando parar)
P7 — REFERÊNCIAS (arquivos L1 — consulta)
```

Cada adapter (tool) usa o MESMO conteúdo, apenas variando:
- Formato de referência de arquivo (`@path` vs `- path`)
- Header/comment style (cada tool espera marcador diferente)
- Artefato de saída (caminho do arquivo)

## HarnessSnapshot Aprimorado

O snapshot gerado pelo builder precisa de campos novos:

```typescript
interface HarnessSnapshot {
  // ... campos existentes ...

  // NOVOS:
  pendingACs: number;           // ACs pendentes do item atual
  totalACs: number;             // Total de ACs do item atual
  lastSession?: {               // Continuidade entre sessões
    lastDate: string;           // ISO date da última ação
    actionsSummary: string;     // "4 movimentos, 3 ACs concluídos"
  };
  startupProtocol: string[];    // 4 passos obrigatórios (hardcoded ou dinâmico)
  prohibitionRules: string[];   // Regras de proibição (não fazer)
}
```

## Estrutura de Saída por Tool

### opencode (`AGENTS.md` + `.opencode/instructions.md`)

Ambos gerados com o mesmo conteúdo. `.opencode/instructions.md` como primário (lido automaticamente), `AGENTS.md` como fallback/legado.

```
# Letra Session — <workflowName>

PASSO OBRIGATÓRIO #1: letra pulse
PASSO OBRIGATÓRIO #2: Leia .letra/context.md
PASSO OBRIGATÓRIO #3: Leia .letra/focus.md
PASSO OBRIGATÓRIO #4: Leia .letra/specs/<spec>/spec.md

## Foco Atual
Item: <itemId> · <description>
Spec: <spec>
Estágio: <activeStage> → <nextStage>
ACs: <pendingACs>/<totalACs> pendentes
Outcome: <outcome>

## Alertas
<se houver>

## Regras (Violação = Erro Grave)
- Não edite workflow.json manualmente
- Não crie specs fora de .letra/specs/<spec>/
- Não pule os passos obrigatórios acima
- Execute letra validate antes de mover item
- Siga constitution.md rigorosamente

## Comandos
letra pulse              → status do workspace
letra flow board         → todas as colunas
letra flow backlog       → backlog
letra health             → alertas ativos
letra validate           → validar ACs
letra flow move <id> --to <s>  → mover item
letra sitrep             → atualizar context.md
letra focus <spec>       → definir foco

## Continuidade
Última sessão: <data>
Atividades: <últimas N ações do session-log>

## Checklist de Encerramento
CONTINUE: backlog ou ACs pendentes → relate progresso
BLOCKED: aguardando humano → liste o que foi feito
ALL_DONE: tudo concluído → reporte missão completa

## Arquivos de Contexto
- .letra/context.md
- .letra/constitution.md
- .letra/glossary.md
- .letra/constraints.md
```

### Cursor (`.cursorrules`)

Formato `@path` para L1, markdown para o resto.

```
@.letra/context.md
@.letra/constitution.md
@.letra/glossary.md
@.letra/constraints.md

PASSO OBRIGATÓRIO #1: letra pulse
PASSO OBRIGATÓRIO #2: Leia .letra/context.md
PASSO OBRIGATÓRIO #3: Leia .letra/focus.md
PASSO OBRIGATÓRIO #4: Leia .letra/specs/<spec>/spec.md

## Foco Atual
... (mesmo conteúdo do opencode)

## Regras (Violação = Erro Grave)
... (mesmo conteúdo)

## Comandos
... (mesmo conteúdo)
```

### Windsurf (`.windsurfrules`)

Idêntico ao Cursor (mesmo formato `@path` + markdown).

### Claude Code (`CLAUDE.md`)

Formato texto (bullet list para L1). Mesmo conteúdo.

### VS Code Copilot (`.github/copilot-instructions.md`)

Formato texto. Mesmo conteúdo. Adaptado para o contexto do Copilot (instruções de código inline, menos foco em CLI commands).

## Detalhamento dos Passos Obrigatórios

Cada passo tem: ação, propósito, e verificação de sucesso.

| # | Ação | Propósito | Verificação |
|---|---|---|---|
| 1 | `letra pulse` | Verificar estado atual do workspace | Output mostra item ativo, ACs, alertas |
| 2 | Leia `.letra/context.md` | Entender projeto, domínio, restrições | Conteúdo lido e compreendido |
| 3 | Leia `.letra/focus.md` | Saber o foco exato e outcome esperado | Spec name + outcome identificados |
| 4 | Leia spec do item | Conhecer ACs e critérios de aceite | ACs pendentes mapeados |

Se qualquer passo falhar (ex: pulse retorna erro), o agente DEVE reportar e parar.

## Continuidade de Sessão

O builder consulta o session-log.json para extrair:
- Data da última entrada (`entries[0].timestamp`)
- Últimas 3 ações (tipo + descrição)
- Total de ACs concluídos na última sessão

Formato no adapter:
```
## Continuidade
Última atividade: 17/06/2026, 09:14
Últimas ações:
  • item_move: ITEM-41 → Review
  • health_ack: hr-7ad9021f
  • ac_complete: ITEM-41 / AC5
```

Se não houver sessão anterior, omitir a seção.

## Acceptance Criteria

### AC1: `.opencode/instructions.md` é gerado com protocolo imperativo

- [x] **AC1.1**: Harness gera `.opencode/instructions.md` com os 4 passos obrigatórios no topo
- [x] **AC1.2**: Passos usam "PASSO OBRIGATÓRIO #N:" em vez de checklist numerado
- [x] **AC1.3**: AGENTS.md continua sendo gerado com o mesmo conteúdo (fallback)
- [x] **AC1.4**: Conteúdo do adapter começa com P1 (protocolo), não com L1 (referências)

### AC2: Adapters têm hierarquia de prioridade P1-P7

- [x] **AC2.1**: Todos os adapters seguem a ordem: Protocolo → Foco → Alertas → Regras → Comandos → Encerramento → Referências
- [x] **AC2.2**: Referências (L1) ficam no final, não no início
- [x] **AC2.3**: Regras de proibição têm destaque visual (negrito, "Violação = Erro Grave")

### AC3: ACs pendentes visíveis sem abrir spec

- [x] **AC3.1**: builder.ts consulta ac-counter.ts para `pendingACs` e `totalACs`
- [x] **AC3.2**: Adapter mostra "ACs: <N>/<M> pendentes" na seção de Foco
- [x] **AC3.3**: `HarnessSnapshot` ganha `pendingACs` e `totalACs`

### AC4: Continuidade entre sessões

- [x] **AC4.1**: builder.ts consulta session-log.json para última sessão
- [x] **AC4.2**: Adapter mostra "Última atividade: <data>" e últimas ações
- [x] **AC4.3**: Se não há sessão anterior, seção é omitida
- [x] **AC4.4**: `HarnessSnapshot` ganha `lastSession?`

### AC5: Foco.idempotent — foco sincronizado com workflow

- [x] **AC5.1**: Se focus.md existe mas o item referenciado não está no workflow → foco é limpo
- [x] **AC5.2**: Se focus.md não existe mas há item ativo → focus.md é gerado automaticamente
- [x] **AC5.3**: `letra pulse` avisa se focus.md e item ativo divergem

### AC6: Context.md tem todo conteúdo dinâmico

- [x] **AC6.1**: Bloco sitrep vira a seção principal (remover conteúdo manual acima)
- [x] **AC6.2**: "Estado Atual", "Stack", "Restrições Reais", "Porquês" movidos para depois do bloco sitrep
- [x] **AC6.3**: `letra sitrep` atualiza TODO o context.md, não só o bloco intermediário

### AC7: Tool-specific content adaptation

- [x] **AC7.1**: Cada tool tem o mesmo conteúdo base, adaptado ao seu formato (Cursor/Windsurf: `@path`, opencode/Claude/VSCode: texto)
- [x] **AC7.2**: opencode gera DOIS arquivos: `.opencode/instructions.md` (primário) e `AGENTS.md` (fallback)
- [x] **AC7.3**: Header de geração mantido (`# Gerado por letra flow move...`)

### AC8: `flow backlog add --spec` registra specLinks

- [x] **AC8.1**: `flow backlog add <desc> --spec <name>` registra `specLinks[<name>]` automaticamente
- [x] **AC8.2**: Se spec já existe em specLinks, não duplica
- [x] **AC8.3**: Se spec é nova, adiciona `{ path: ".letra/specs/<name>/spec.md" }`
- [x] **AC8.4**: Comportamento simétrico no `letra spec link`

### AC9: Engine de diagnóstico roda automaticamente pós-mutação

- [x] **AC9.1**: `writeWorkflow()` executa `engine.run()` depois de salvar workflow.json e ANTES de regenerar adapters
- [x] **AC9.2**: Gatilhos: `flow backlog add`, `flow move`, `flow init`, `flow edit`, `spec link`, `focus set`, `focus --clear`
- [x] **AC9.3**: `engine.run()` escreve resultados no `health-record.json`
- [x] **AC9.4**: Ordem final: `writeWorkflow() → engine.run() → health-record.json → generateAdapters()`
- [x] **AC9.5**: Se engine detecta problema GRAVE, adapter ganha aviso extra no topo

### AC10: Board exibe alertas do health-record nos cards

- [x] **AC10.1**: `letra flow board` mostra badge de alerta ao lado de itens com problemas detectados (ex: `⚠specLinks` ao lado de `📎harness-optimization`)
- [x] **AC10.2**: Badge usa dados do `health-record.json` — alertas com status "novo" associados ao item via `item.id` no `id` do alerta
- [x] **AC10.3**: Se item tem múltiplos alertas, badge mostra contagem (ex: `⚠2`)
- [x] **AC10.4**: Board web UI (KanbanView) também exibe badges nos cards
- [x] **AC10.5**: Badges são atualizados quando engine roda (AC9) — nunca ficam stale

### AC11: Nada quebrado

- [x] **AC11.1**: Testes existentes continuam passando
- [x] **AC11.2**: `letra validate` OK
- [x] **AC11.3**: health-record.json schema unchanged

### AC12: Agente marca ACs como concluídos durante o loop de execução

- [x] **AC12.1**: `letra ac done <AC-ID> --spec <name>` comando top-level que encontra o AC no spec.md pelo ID (ex: `**AC1.1**`) e marca `[ ]` → `[x]`
- [x] **AC12.2**: Comando registra no session-log (`ac_complete`) + executa `letra validate` após marcar
- [x] **AC12.3**: `letra ac` sem subcomando lista ACs pendentes do spec ativo (resumo)
- [x] **AC12.4**: Adapter (formatters.ts) inclui passo "Após cada AC: `letra ac done <AC-ID>`" na seção de regras/fluxo
- [x] **AC12.5**: Testes: marca AC por ID, AC inexistente retorna erro, `letra ac` lista pendentes

## Diagrama de Detecção Automática

```
ANTES:
flow move / backlog add
  → writeWorkflow()
  → generateAdapters()    ← L5 vazio, engine não rodou
  → [fim]

DEPOIS:
flow move / backlog add / spec link / focus
  → writeWorkflow()       ← salva workflow.json
  → engine.run()          ← roda TODOS os detectores
     │
     ├─ ac-stale ✔
     ├─ ac-false-pos ✔
     ├─ harness-stale ✔
     ├─ missing-dir ✔
     ├─ stage-drift ✔
     └─ missing-spec-link ✔  ← DETECTA spec não registrada
     │
     → mergeScanResults() ← atualiza health-record.json
     → generateAdapters()  ← L5 lê alertas "novo" do health-record
     → adapters escritos com L5 populado
     → [fim]

AGENTE (eu):
  No início da sessão, leio o adapter:
    PASSO OBRIGATÓRIO #1: letra pulse
      → pulse mostra "Alertas: 1 novo(s)"
    L5 no adapter mostra:
      Alerta · severidade baixa
        ID: missing-spec-link_ITEM-42_unregistered
        O que: ITEM-42: spec não registrada em specLinks
        Ação: `letra health ack <id>`

  Eu (agente) reporto ao usuário:
    "Detectei que ITEM-42 foi criado mas specLinks está incompleto.
     Quer que eu corrija com `letra spec link ITEM-42 harness-optimization`?"
```

## Especificação de Formatos

### Formato `@` (Cursor, Windsurf)

```
@.letra/context.md
@.letra/constitution.md
@.letra/glossary.md
@.letra/constraints.md

PASSO OBRIGATÓRIO #1: letra pulse — verificar estado
PASSO OBRIGATÓRIO #2: Leia .letra/context.md
PASSO OBRIGATÓRIO #3: Leia .letra/focus.md
PASSO OBRIGATÓRIO #4: Leia .letra/specs/{spec}/spec.md

## Foco Atual
Item: {itemId} · {description}
Spec: {spec}
Estágio: {activeStage} → {nextStage}
ACs: {pendingACs}/{totalACs} pendentes
Outcome: {outcome}

{se houver alertas}
## Alertas
{lista de alertas}
{se não houver, omitir}

## Regras (Violação = Erro Grave)
- Não edite workflow.json manualmente
- Não crie specs fora de .letra/specs/
- Não pule os passos obrigatórios acima
- Execute letra validate antes de mover item
- Siga constitution.md rigorosamente

## Comandos
letra pulse              → status do workspace
letra flow board         → todas as colunas
letra health             → alertas ativos
letra health ack <id>    → reconhecer alerta
letra flow move <id> --to <s>  → mover item
letra sitrep             → atualizar context.md
letra validate           → validar ACs
letra focus <spec>       → definir foco
letra focus --clear      → limpar foco

{se houver lastSession}
## Continuidade
Última atividade: {lastDate}
Últimas ações: {actionsSummary}
{se não houver, omitir}

## Checklist de Encerramento
**CONTINUE**: backlog tem itens OU item atual tem ACs pendentes
  → Relate progresso: quais ACs fez, o que falta, onde parou
  → Se sessão >30 min, pare e relate

**BLOCKED**: backlog vazio, item sem ACs pendentes, aguardando humano
  → Relate "Trabalho concluído, aguardando revisão"
  → Liste o que foi feito e o que precisa de decisão humana

**ALL_DONE**: todos os itens em Done, backlog vazio
  → Relate missão completa: itens concluídos, o que foi construído, próximos passos
```

### Formato texto (opencode, Claude Code, VS Code Copilot)

Mesmo conteúdo, mas com `- path` em vez de `@path` para L1.

```
Read the following files before starting any task:
- .letra/context.md
- .letra/constitution.md
- .letra/glossary.md
- .letra/constraints.md

PASSO OBRIGATÓRIO #1: letra pulse — verificar estado
PASSO OBRIGATÓRIO #2: Leia .letra/context.md
PASSO OBRIGATÓRIO #3: Leia .letra/focus.md
PASSO OBRIGATÓRIO #4: Leia .letra/specs/{spec}/spec.md

... (mesmo conteúdo do formato @)
```

### Formato opencode especial (`.opencode/instructions.md`)

Mesmo conteúdo do formato texto, mas:
- Header `# Letra Session — {workflowName}` em vez de `# Letra Context — {workflowName}`
- Foco no protocolo imperativo

## Mapeamento de Ferramentas

```typescript
const TOOL_CONFIG = {
  cursor: {
    paths: [".cursorrules"],
    format: "at",
    displayName: "Cursor",
  },
  windsurf: {
    paths: [".windsurfrules"],
    format: "at",
    displayName: "Windsurf",
  },
  "claude-code": {
    paths: ["CLAUDE.md"],
    format: "text",
    displayName: "Claude Code",
  },
  vscode: {
    paths: [".github/copilot-instructions.md"],
    format: "text",
    displayName: "VS Code Copilot",
  },
  opencode: {
    paths: [".opencode/instructions.md", "AGENTS.md"],
    format: "text",
    displayName: "OpenCode",
  },
};
```

## Notas de Implementação

### builder.ts
- Adicionar `pendingACs` e `totalACs` consultando `ac-counter.ts`
- Adicionar `lastSession` consultando `session-log.json` (primeira entrada, últimas 3 ações)
- `startupProtocol` e `prohibitionRules` são hardcoded (não variam por projeto)

### generate.ts
- TOOL_TARGETS vira TOOL_CONFIG com suporte a múltiplos paths
- opencode gera 2 arquivos: `.opencode/instructions.md` (primário) e `AGENTS.md` (fallback)
- Cabeçalho de geração mantido (`# Gerado por letra flow move...`)

### formatters.ts
- Nova função `formatAdapterContentV2()` com ordem P1-P7
- `formatL1()` movida para o final (era início)
- `formatKickoffSection()` vira protocolo imperativo (PASSO OBRIGATÓRIO)
- `formatFocusSection()` novo — mostra ACs, outcome, stage
- `formatProhibitionRules()` novo — regras de proibição com destaque
- `formatSessionContinuity()` novo — dados da última sessão
- `formatCompletionChecklist()` mantido com ajustes (P6)
- `formatRules()` removido (regras de proibição substituem)

### types.ts
```typescript
interface HarnessSnapshot {
  // ... campos existentes ...
  pendingACs: number;
  totalACs: number;
  lastSession?: {
    lastDate: string;
    actionsSummary: string;
  };
}

interface ToolConfig {
  paths: string[];
  format: "at" | "text";
  displayName: string;
}
```

### Estimativa de Linhas
- builder.ts: +20 linhas (AC counter + session log)
- formatters.ts: +50 linhas (novas seções, reordenação)
- generate.ts: +10 linhas (tool config com múltiplos paths)
- types.ts: +10 linhas (novos tipos)
- `ac-counter.ts`: já existe, só integrar
- Testes: +30 linhas

## UX Journey — Antes vs Depois

```
ANTES:
AGENTS.md:
  # Letra Context — letra

  Read the following files before starting any task:
  - .letra/context.md
  - .letra/constitution.md
  - .letra/glossary.md
  - .letra/constraints.md

  ## Checklist de Início
  1. Verificar pulso...
  2. Verificar alertas...
  3. Ler contexto...
  4. Identificar item...
  5. Mão na massa...

  ## Comandos Disponíveis
  ...

  ## Checklist de Encerramento
  ...

  ## Regras
  ...

DEPOIS:
.opencode/instructions.md (PRIMÁRIO) + AGENTS.md (FALLBACK):

  # Letra Session — letra

  PASSO OBRIGATÓRIO #1: letra pulse
  PASSO OBRIGATÓRIO #2: Leia .letra/context.md
  PASSO OBRIGATÓRIO #3: Leia .letra/focus.md
  PASSO OBRIGATÓRIO #4: Leia .letra/specs/<spec>/spec.md

  ## Foco Atual
  Item: ITEM-41 · Remover dependência de npm
  Spec: npm-agnostic
  Estágio: Review → Done
  ACs: 0/6 pendentes
  Outcome: Letra funciona em qualquer projeto...

  ## Regras (Violação = Erro Grave)
  ...

  ## Comandos
  ...

  ## Continuidade
  Última atividade: 17/06/2026, 09:18
  Últimas ações: item_move ITEM-41 → Review, health_ack, ac_complete

  ## Checklist de Encerramento
  ...

  ## Arquivos de Contexto
  - .letra/context.md
  - .letra/constitution.md
  - .letra/glossary.md
  - .letra/constraints.md
```

## Escopo Futuro (Fora Deste Spec)

- Detector "startup-drift": verifica consistência entre focus.md, workflow, item ativo
- `letra pulse` avisar se focus diverge do item ativo
- Sessão multi-agente (handoff entre agentes)
- Métricas de efetividade do harness (taxa de follow-through)
