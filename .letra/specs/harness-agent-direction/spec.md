# Spec: Direção de Agentes por Harness (Cross-Adapter)

> Updated: 2026-07-04

## Outcome

Agentes de IA (OpenCode, Cursor, Claude Code, Windsurf, VSCode Copilot, Codex CLI, Hermes) recebem no adapter instruções derivadas do harness ativo — papel, estágio permitido, comandos resolvidos, constraints e next actions — sem que o humano precise carregar skills ou ler arquivos manualmente. A direção é automaticamente atualizada quando o item muda de estágio.

## Constraints

- Nenhum adapter existente pode perder seções ou dados (retrocompatibilidade total).
- A seção "Direção do Harness" deve aparecer em TODOS os 7 adaptadores, respeitando o formato de cada um (`text` ou `at`).
- Comandos com placeholders (`<AC-ID>`, `<ITEM-ID>`) devem ser resolvidos para IDs reais do workflow e specs antes da escrita.
- A autoridade do harness (Princípio 3 da Constitution) deve ser preservada — o adapter não inventa direção se o harness não definir.
- Sempre que `letra flow move`, `letra ac done`, `letra health`, `letra focus` ou `letra init` forem executados, os adapters devem ser regenerados com a direção atualizada.
- Agentes sem estágio ativo (workspace sem workflow ou sem item em andamento) não devem receber direção de estágio — apenas o bloco de contexto geral.

## Exclusions

- Correção do sync automático do Claude Code (escopo separado).
- Unificação do gerador duplicado do Hermes.
- Implementação da seção "Pendências Detectadas" do spec adapter-alerts.
- Mudanças no formato ou localização dos arquivos de adapter existentes.

## Acceptance Criteria

### AC1 — Seção "Direção do Harness" em todos os adapters

- [x] **AC1**: Seção "Direção do Harness" aparece em todos os 7 adapters com versão, papel, estágios, item, objetivo, comandos, proibições e próximas ações

Cada adapter ganha uma seção `## Direção do Harness` (ou equivalente no formato `@` para Cursor/Windsurf) contendo:

- **Versão ativa** do harness (ex: `v0.1.3`)
- **Seu papel** (derivado do primeiro `agents` do estágio atual, ex: `builder`)
- **Estágios permitidos** (ex: `code`)
- **Item atual**: ID + descrição + estágio
- **Objetivo do estágio** (do `activity.{stageId}.objective` do harness)
- **Comandos** (do `activity.{stageId}.commands`, com placeholders resolvidos)
- **Proibições** (do `activity.{stageId}.mustNotDo`)
- **Próximas ações** (do `activity.{stageId}.nextActions`, 2 primeiras)

Formato `text` (OpenCode, AGENTS.md, CLAUDE.md, VSCode, Hermes):
```markdown
## Direção do Harness

**Versão**: v0.1.3 | **Papel**: builder | **Estágios**: code

**Item**: ITEM-62 — Verdade do Produto e Navegação de Supervisão (Code)

**Objetivo**: Implementar o item ativo conforme a spec e as restrições aprovadas.

**Comandos**:
- `letra ac done AC5` — Registrar AC concluído
- `letra validate` — Validar implementação

**Proibições**: Não ampliar o escopo além da spec ativa.

**Próximas ações**:
1. Executar próximo AC — Implementar o próximo critério pendente com testes
2. Verificar drift — Comparar a mudança com a spec, o foco e a constitution
```

Formato `@` (Cursor `.cursorrules`, Windsurf `.windsurfrules`):
```markdown
## Direção do Harness

@harness: v0.1.3 | papel: builder | estágios: code
@item: ITEM-62 (Code)
@objetivo: Implementar o item ativo conforme a spec e as restrições aprovadas.
@comandos: letra ac done AC5 | letra validate
@proibições: Não ampliar o escopo além da spec ativa.
@proximas: Executar próximo AC | Verificar drift
```

### AC2 — Resolução de placeholders

- [x] **AC2**: Placeholders `<AC-ID>` e `<ITEM-ID>` resolvidos para IDs reais antes da escrita

`<AC-ID>` e `<ITEM-ID>` nos `commands` do harness são resolvidos antes da escrita:

- `<AC-ID>` → IDs dos ACs pendentes do spec atual (ex: `AC5`, `AC6`), concatenando todos em comandos separados
- `<ITEM-ID>` → ID do item ativo (ex: `ITEM-62`)
- Se spec não existir ou não tiver ACs pendentes, o comando com `<AC-ID>` é omitido
- Se não houver item ativo, comandos com `<ITEM-ID>` são omitidos

Regra: cada comando gera uma linha. `letra ac done <AC-ID>` com 3 ACs pendentes vira:
```
- `letra ac done AC5` — Registrar AC concluído
- `letra ac done AC6` — Registrar AC concluído
- `letra ac done AC7` — Registrar AC concluído
```

### AC3 — Regeneração automática na mudança de estágio

- [x] **AC3**: Adapters regenerados com direção atualizada em flow move, ac done, health, focus e init

Os adapters são regenerados com a direção atualizada sempre que:

- `letra flow move ITEM-X --to <stage>` é executado
- `letra flow move ITEM-X --auto` descobre novo estágio
- `letra ac done AC-X` conclui o último AC e o framework move o item

Nestes casos, o novo estágio determina:
- Novo papel (do `agents` do estágio)
- Novos comandos (do `activity.{stageId}.commands`)
- Novas proibições (do `activity.{stageId}.mustNotDo`)
- Novas próximas ações (do `activity.{stageId}.nextActions`)

Se o estágio não tiver `agents`, papel default é `agent`.
Se o estágio não tiver `commands`, a seção "Comandos" é omitida.
Se o estágio não tiver `mustNotDo`, a seção "Proibições" é omitida.

### AC4 — Fallback sem workflow ou sem item ativo

- [x] **AC4**: Fallback correto sem workflow, sem item ativo, e sem activity configurada

Sem workflow:
- Seção "Direção do Harness" é omitida
- Adapter mantém formato atual (arquivos L1 + referências + rules)

Com workflow mas sem item ativo:
- Seção exibe apenas: "Nenhum item em andamento. Consulte o backlog para priorizar."
- Papel e estágio não são exibidos

Com workflow e item ativo, mas estágio sem `activity` definida:
- Exibe papel, item e estágio
- Comandos, proibições e próximas ações são omitidos
- Inclui nota: "Estágio sem activity configurada no harness."

### AC5 — Evidência de regeneração

- [x] **AC5**: Bloco delimitado por comentários de início/fim; timestamp preservado no header do adapter

O timestamp de regeneração da direção é preservado no header do adapter (já existente: `# Gerado por letra flow move. Nao edite manualmente.`). O bloco de direção pode ser identificado por comentário de início/fim para facilitar diff e debugging:

```markdown
<!-- harness-direction:start -->
## Direção do Harness
...
<!-- harness-direction:end -->
```

Formatos `@` (Cursor/Windsurf) usam comentário de linha única:
```markdown
# harness-direction:start
...
# harness-direction:end
```

### AC6 — Testes

- [x] **AC6**: 7 testes de contrato + 3 de placeholders + 2 de regeneração + 2 de fallback

- 7 testes de contrato (um por adapter) verificam que a seção "Direção do Harness" aparece no formato correto
- 3 testes de resolução de placeholders:
  - `<AC-ID>` com 0 ACs pendentes → comando omitido
  - `<AC-ID>` com 3 ACs pendentes → 3 linhas geradas
  - `<ITEM-ID>` resolvido para ID real
- 2 testes de regeneração:
  - `buildHarnessSnapshot()` retorna `currentRole`, `allowedStages`, `resolvedCommands`
  - Regeneração após `flow move` produz direção do novo estágio
- 2 testes de fallback:
  - Sem workflow → seção omitida
  - Sem item ativo → mensagem padrão sem papel/estágio
- Typecheck e build do CLI aprovados
- `letra validate` com 0 falhas

## Context

### Diagnóstico

O harness atual define por estágio: agents, commands, objective, mustNotDo, nextActions. O pipeline de geração de adapters (builder.ts → formatters.ts) constrói um `HarnessSnapshot` rico, mas o formatter descarta a maior parte dos dados de direção — produz apenas um template genérico com item ativo, ACs pendentes e regras fixas.

A skill `harness-direction` (`.opencode/skills/harness-direction/SKILL.md`) provou que o conceito funciona, mas depende do humano chamá-la manualmente. O adapter é o lugar certo para essa direção porque é lido automaticamente por todos os agentes ao iniciar sessão.

### Decisões de Design

1. **Adapter > Skill**: A direção deve estar no adapter (lido automaticamente), não em skill (requer invocação manual).
2. **Formato nativo**: Cada adapter usa seu formato nativo (`text` ou `@`), não um formato genérico.
3. **Resolução upfront**: Placeholders são resolvidos no momento da geração, não em runtime pelo agente. Isso mantém o adapter como fonte de verdade imediata.
4. **Comentários delimitadores**: Facilitam diff, debugging e eventual parser de terceiros.
5. **Agentes no plural**: `agents` pode ter múltiplos valores; o primeiro é usado como papel principal. Se houver múltiplos, exibe "builder, reviewer".

### Risco Residual

- Cursor e Windsurf podem não interpretar comentários `# harness-direction:start`; nesse caso, os delimitadores serão silenciosamente ignorados pelo agente mas visíveis para debugging humano.
- Resolução de `<AC-ID>` depende do spec existir e ter ACs no formato `- [ ] **ACx**` — specs sem esse formato não terão comandos resolvidos.
- Adaptadores gerados antes desta implementação precisarão ser regenerados (executando `letra flow move` ou `letra ac`) para receber a seção.

## Regression Baseline

- O formato e conteúdo atuais de todos os 7 adapters são preservados para seções existentes.
- A seção "Direção do Harness" é adicionada, nunca removida ou modificada nas seções existentes.
- Testes existentes do builder, formatter e generate continuam passando.
- `letra validate` antes e depois da implementação: 0 falhas.
- Build de produção do CLI aprovado.
