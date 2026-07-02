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
