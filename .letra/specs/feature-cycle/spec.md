# Ciclo de Funcionalidade — Do Paper ao Done, Humano + Agente

> Updated: 2026-06-15

## Outcome

Um humano com uma ideia consegue transformá-la em funcionalidade pronta sem precisar gerenciar o agente em cada passo. O fluxo é:

```
IDÉIA → SPEC → BACKLOG → AGENTE EXECUTA → REVISÃO → DONE
  ↑human     ↑human      ↑human    ↑autônomo   ↑human   ↑human
```

O humano define **o quê** (spec + ACs). O agente executa **como** (código + validação + movimentação). O humano revisa e aprova. O ciclo se repete.

## Linguagem (UX)

| Termo Técnico | Termo Humano | Quem |
|---|---|---|
| spec creation | criar especificação | Humano |
| workflow add | adicionar ao fluxo | Humano |
| agent session | sessão do agente | Humano inicia, agente executa |
| autonomous loop | execução autônoma | Agente |
| checkpoint | ponto de verificação | Agente → Humano |
| review | revisão | Humano |
| closure | fechamento | Humano |

## Constraints

- Humano sempre cria a spec — agente nunca cria spec do zero
- Humano sempre revisa antes de fechar — agente nunca move direto para Done
- Agente pode mover entre estágios intermediários (Code → Review) sem aprovação
- Agente deve parar e pedir ajuda se: build quebra sem solução clara, decisão arquitetural complexa, ou AC ambíguo
- O ciclo funciona para OpenCode e Cursor — com diferenças de capacidade
- Cada item no workflow tem exatamente um humano responsável pela aprovação final
- Uma sessão de agente não precisa concluir o item inteiro — progresso parcial é registrado

## Architecture

### O Ciclo Completo (6 Fases)

```
┌─────────────────────────────────────────────────────────────────┐
│                         FEATURE CYCLE                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  FASE 1: IDEA → SPEC                                            │
│  ┌────────────────────────────────────────┐                     │
│  │ Humano: "Preciso de um sistema de       │                     │
│  │          login com email e senha"       │                     │
│  │                                         │                     │
│  │ Humano executa:                         │                     │
│  │   letra spec new "login-email"          │                     │
│  │   # edita .letra/specs/login-email/     │                     │
│  │   #   spec.md: escreve Outcome, ACs     │                     │
│  │   #   acceptance.md: ACs checkáveis     │                     │
│  │                                         │                     │
│  │ Humano: "Adiciono ao fluxo"             │                     │
│  │   letra flow add "Login por email"      │                     │
│  │   # ITEM-N criado em Backlog            │                     │
│  └────────────────────────────────────────┘                     │
│                                                                  │
│  FASE 2: SPEC → BACKLOG (opcional)                              │
│  ┌────────────────────────────────────────┐                     │
│  │ Humano pode organizar prioridade:       │                     │
│  │   letra flow board                      │                     │
│  │   # vê todos itens, reordena            │                     │
│  └────────────────────────────────────────┘                     │
│                                                                  │
│  FASE 3: BACKLOG → AGENTE                                       │
│  ┌────────────────────────────────────────┐                     │
│  │ Humano inicia o agente:                 │                     │
│  │   "Trabalhe no ITEM-N (login-email)"   │                     │
│  │                                         │                     │
│  │ letra flow move ITEM-N --to design     │                     │
│  │ # item sai do backlog, entra no fluxo  │                     │
│  └────────────────────────────────────────┘                     │
│                                                                  │
│  │                                                              │
│  ├── INÍCIO DA ZONA AUTÔNOMA DO AGENTE ──────────────────┤     │
│  │                                                              │
│  │  FASE 4: AGENTE EXECUTA (loop autônomo)                     │
│  │  ┌──────────────────────────────────────────────────┐       │
│  │  │ 4.1. letra pulse --json                          │       │
│  │  │     → entende estado, item, estágio atual        │       │
│  │  │                                                   │       │
│  │  │ 4.2. Lê spec do item                             │       │
│  │  │     read(".letra/specs/login-email/spec.md")     │       │
│  │  │     read(".letra/specs/login-email/acceptance.md")│      │
│  │  │                                                   │       │
│  │  │ 4.3. Cria plano (todowrite no OpenCode)           │       │
│  │  │     AC-001: Tela de login com email e senha       │       │
│  │  │     AC-002: Validação de formato de email         │       │
│  │  │     AC-003: Mensagem de erro para senha inválida  │       │
│  │  │                                                   │       │
│  │  │ 4.4. PARA CADA AC NO PLANO:                      │       │
│  │  │     ├── IMPLEMENTA (edita código)                 │       │
│  │  │     ├── DECISÃO TÉCNICA? → letra decision new     │       │
│  │  │     ├── letra validate                            │       │
│  │  │     │   └── Falhou → letra diagnose → corrige     │       │
│  │  │     ├── letra pulse                               │       │
│  │  │     ├── letra sitrep                              │       │
│  │  │     ├── AC CONCLUÍDO → letra log ac AC-N          │       │
│  │  │     └── npm run build                             │       │
│  │  │         └── Falhou → corrige → build de novo      │       │
│  │  │                                                   │       │
│  │  │ 4.5. TODOS ACS ✅ → letra flow move --auto        │       │
│  │  │     # item vai para Review                        │       │
│  │  │                                                   │       │
│  │  │ 4.6. ENCERRA SESSÃO                               │       │
│  │  │     ├── letra log add "resumo da sessão"          │       │
│  │  │     ├── letra log session-end                     │       │
│  │  │     └── Relata para o humano                      │       │
│  │  └──────────────────────────────────────────────────┘       │
│  │                                                              │
│  └── FIM DA ZONA AUTÔNOMA DO AGENTE ───────────────────┘       │
│                                                                  │
│  FASE 5: REVIEW                                                │
│  ┌────────────────────────────────────────┐                     │
│  │ Humano recebe relatório:                │                     │
│  │   "Item ITEM-N concluído.               │                     │
│  │    ACs: 3/3 concluídos.                 │                     │
│  │    Decisões: usar bcrypt para senhas.   │                     │
│  │    Build: ✅ passou. Testes: ✅ 12/12"  │                     │
│  │                                         │                     │
│  │ Humano pode:                            │                     │
│  │   ✅ Aprovar → letra flow move --to done│                     │
│  │   🔄 Pedir ajustes → "mude X"          │                     │
│  │      agente volta pra Code automaticamente│                   │
│  └────────────────────────────────────────┘                     │
│                                                                  │
│  FASE 6: DONE                                                  │
│  ┌────────────────────────────────────────┐                     │
│  │ Item está em Done.                      │                     │
│  │ Humano pega próximo do backlog.         │                     │
│  │ O ciclo recomeça na FASE 3.             │                     │
│  └────────────────────────────────────────┘                     │
└─────────────────────────────────────────────────────────────────┘
```

### Responsabilidades Claras

```
FASE           HUMANO                          AGENTE
─────────────────────────────────────────────────────────────────────
IDEA → SPEC   Cria spec.md + acceptance.md   ❌ Não participa
              letra spec new
              letra flow add

BACKLOG       Prioriza itens                  ❌ Não participa
              letra flow board

INÍCIO        letra flow move --to design     ✅ Lê spec, cria plano
              "Trabalhe no ITEM-N"            ✅ todowrite()

EXECUÇÃO      ❌ Não participa                ✅ Implementa ACs
              (pode interromper)              ✅ validate → pulse → sitrep
                                              ✅ Registra decisões
                                              ✅ letra log
                                              ✅ flow move --auto (entre estágios)

REVIEW        ✅ Revisa código/diff           ✅ Relata o que fez
              ✅ Aprova ou pede ajustes       ✅ Se ajustes: implementa

DONE          ✅ letra flow move --to done    ❌ Não participa
              ✅ Pega próximo item
```

### Diferenças: OpenCode vs Cursor

| Aspecto | OpenCode | Cursor Agent |
|---|---|---|
| Paralelismo | `task()` sub-agentes → ACs em paralelo | Sequencial — um AC por vez |
| Planejamento | `todowrite()` com checkboxes | Plano mental + Composer |
| Shell | `bash()` direto | Terminal integrado |
| Leitura de spec | `read()` + parseia ACs | Lê no chat + contexto |
| Checkpoint | Pede ajuda se travou | Pede ajuda se travou |
| Duração | Pode processar itens grandes | Melhor para itens ≤5 ACs |

**OpenCode** → loop autônomo completo com paralelismo. Ideal para itens complexos (5-10 ACs).

**Cursor** → loop autônomo sequencial. Ideal para itens pequenos (1-3 ACs). Para itens maiores, Cursor precisa de checkpoint: "mostre o progresso para o humano a cada 2 ACs".

### Seção no Adapter do OpenCode

```markdown
## Ciclo de Funcionalidade

Ao receber a instrução "Trabalhe no ITEM-N (nome-da-spec)", execute:

### Fase 1: Entender
1. `letra pulse --json` — confirme qual item e estágio
2. Leia `.letra/specs/{spec}/spec.md` — entenda outcome e constraints
3. Leia `.letra/specs/{spec}/acceptance.md` — identifique todos os ACs
4. Crie um plano usando todowrite() com um item por AC

### Fase 2: Executar (para cada AC)
1. Implemente o AC editando os arquivos necessários
2. Se escolha técnica: pause → `letra decision new <slug>` → continue
3. `letra validate` — se falhar: `letra diagnose`, corrija, re-valide
4. `letra pulse` — verifique se não surgiram alertas
5. `letra sitrep` — atualize o contexto
6. `letra log ac AC-N --item ITEM-N` — marque AC como concluído
7. `npm run build` — se falhar: corrija, rebuild

### Fase 3: Completar
1. Se todos os ACs estão concluídos: `letra flow move ITEM-N --auto`
2. Se progresso parcial: `letra log add` descrevendo o que foi feito
3. Encerre: `letra log session-end`
4. Relate ao humano:
   - Quais ACs foram concluídos
   - Decisões técnicas tomadas
   - Build passou? Testes passaram?
   - Próximo passo sugerido

### Sub-agentes
Use task() para delegar ACs independentes em paralelo.
O agente principal coordena o fluxo e executa validate/pulse/sitrep.

### Checkpoints
Se em qualquer momento você estiver travado >2 minutos:
- Explique o problema para o humano e peça orientação
- Não fique em loop tentando a mesma solução

### Regras
- NUNCA crie spec do zero — o humano faz isso
- NUNCA mova para Done — o humano faz isso
- NUNCA ignore um AC — todos devem ser implementados ou justificados
- SEMPRE valide antes de mover
- SEMPRE registre session-end
```

### Seção no Adapter do Cursor

```markdown
## Ciclo de Funcionalidade

Ao receber a instrução "Trabalhe no ITEM-N (nome-da-spec)", execute:

### Fase 1: Entender
1. Execute no terminal: `letra pulse --json`
2. Leia `.letra/specs/{spec}/spec.md` e `acceptance.md`
3. Identifique os ACs e planeje a ordem de implementação

### Fase 2: Executar (para cada AC, sequencialmente)
1. Use o Composer para implementar o AC
2. Se escolha técnica: abra issue ou registre em .letra/decisions/
3. No terminal: `letra validate` — se falhar: `letra diagnose`, corrija
4. No terminal: `letra pulse`
5. No terminal: `letra sitrep`
6. No terminal: `letra log ac AC-N --item ITEM-N`
7. No terminal: `npm run build`

### Fase 3: Checkpoint (a cada 2 ACs para itens grandes)
Pare e mostre progresso ao humano:
  "Completei AC-001 e AC-002. Faltam AC-003 a AC-005.
   Deseja que eu continue ou quer revisar o que foi feito?"

### Fase 4: Completar
1. Todos ACs ✅ → terminal: `letra flow move ITEM-N --auto`
2. Encerre: `letra log session-end`
3. Relate ao humano o resumo do que foi feito

### Regras
- NUNCA crie spec do zero
- NUNCA mova para Done
- NUNCA ignore ACs
- SEMPRE valide antes de mover
- SEMPRE registre session-end
- Para itens com mais de 3 ACs, faça checkpoint a cada 2 ACs
```

### Geração dos Adapters

```typescript
// generate.ts — seções de ciclo por ferramenta
function buildCycleSection(tool: string, workflow: Workflow): string | null {
  const activeItems = workflow.items.filter(i =>
    ["design", "code"].includes(i.stage)
  );
  if (activeItems.length === 0) return null;

  if (tool === "opencode") return buildOpenCodeCycleSection();
  if (tool === "cursor") return buildCursorCycleSection();
  // ... outras ferramentas
  return null;
}
```

### Integração com o Session Log

Cada execução do ciclo gera registros no diário de bordo que permitem rastrear:

```
log-001  item_move   ITEM-N movido: Backlog → Design (humano iniciou)
log-002  ac_complete AC-001 concluído (agente)
log-003  decision    Decisão: usar bcrypt (agente)
log-004  ac_complete AC-002 concluído (agente)
log-005  validate    Validação: 9 passed (agente)
log-006  item_move   ITEM-N movido: Code → Review (agente, --auto)
log-007  session_end Sessão encerrada (agente)
log-008  item_move   ITEM-N movido: Review → Done (humano aprovou)
```

## Acceptance Criteria

- [ ] **Seção no adapter OpenCode**: Instruções completas do ciclo com task(), todowrite(), bash()
- [ ] **Seção no adapter Cursor**: Instruções completas do ciclo com checkpoint a cada 2 ACs
- [ ] **Fase 1 — Entender**: pulse + ler spec + identificar ACs + criar plano
- [ ] **Fase 2 — Executar**: implementar → validate (+recovery) → pulse → sitrep → log → build (+recovery)
- [ ] **Fase 3 — Completar**: flow move --auto se todos ACs ✅, session-end, relato
- [ ] **Checkpoint no Cursor**: Instrução para pausar a cada 2 ACs em itens grandes
- [ ] **Sub-agentes no OpenCode**: Instrução para usar task() para ACs paralelos
- [ ] **Regras**: NUNCA criar spec, NUNCA mover para Done, NUNCA ignorar ACs, SEMPRE validar
- [ ] **Geração automática**: Seção gerada junto com adapters quando há item ativo
- [ ] **Sem item ativo**: Seção não aparece (sem ruído)
- [ ] **Registro no session-log**: Cada fase gera entradas no diário
- [ ] **Testes**: Seção OpenCode, seção Cursor, com/sem item ativo, checkpoint, sub-agentes

## Exclusions

- Ciclo para outras ferramentas (Windsurf, Codex CLI, VSCode) — mesmo conceito, adaptar depois
- Execução automática do comando humano "Trabalhe no ITEM-N" — humano digita
- Aprovação automática de review — humano sempre revisa
- Specs geradas por IA — humano cria specs

## Context

Este spec é o **fechamento de todo o sistema**. Os 12 specs anteriores definem o que o Letra oferece. Este spec define **como usar** em um ciclo completo humano + agente.

As diferenças entre OpenCode e Cursor refletem capacidades reais:
- OpenCode tem sub-agentes → ACs paralelos = mais rápido
- Cursor não tem → checkpoint = evita trabalho perdido

Ambos compartilham o núcleo: entender → implementar → validar → mover → relatar. A diferença está no paralelismo e checkpoint.
