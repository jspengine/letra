# Sala de Situação — Contexto Dinâmico do Workspace

> Updated: 2026-06-15

## Outcome

O `context.md` do Letra para de ser um documento estático que desatualiza com o tempo. Com um comando `letra sitrep`, o contexto é atualizado automaticamente com o estado real do workspace: workflow atual, item em andamento, alertas do prontuário, decisões recentes, contagem de ACs.

O desenvolvedor (ou agente) não precisa editar context.md manualmente. O comando puxa informações de várias fontes e monta um relato de situação coeso. Seções escritas manualmente (Intent, Stack, Porquês) são preservadas — só o que é dinâmico é substituído.

## Linguagem (UX)

| Termo Técnico | Termo Humano | Contexto |
|---|---|---|
| context sync | atualizar situação | `letra sitrep` |
| context.md | relato de situação | Arquivo `.letra/context.md` |
| dry-run | simular | `letra sitrep --dry-run` mostra diff sem escrever |
| dynamic sections | seções dinâmicas | Updated, Estado Atual, Progresso (substituídas) |
| manual sections | seções manuais | Intent, Domínio, Stack, Restrições, Porquês (preservadas) |

## Constraints

- Apenas seções marcadas como dinâmicas são substituídas
- Seções manuais (Intent, Domínio, Stack, Restrições, Porquês) nunca são tocadas
- Comentário `<!-- sitrep:ignore -->` em qualquer seção impede substituição
- Campo `> Updated:` é sempre atualizado para a data/hora do comando
- `--dry-run` exibe diff sem modificar arquivo
- Falha silenciosa se `.letra/` não existe (exit 0 com warning)
- Output do comando mostra o que mudou (seções adicionadas/removidas/atualizadas)

## Architecture

### Estrutura do context.md

```markdown
# Context

> Updated: 2026-06-15T18:00:00.000Z  ← DINÂMICO (sempre atualizado)
> Owner: letra-dev                      ← MANUAL (preservado)

## Intent                          ← MANUAL

## Domínio                         ← MANUAL

## Estado Atual (2026-06-15)       ← DINÂMICO (substituído)

<!-- sitrep:start -->
- **Estágio**: Code
- **Item atual**: ITEM-39 — Harness meta-test
- **ACs**: 5/6 pendentes | Tasks: 2/4 abertas
- **Alertas**: 3 novos · 2 cientes · 0 resolvidos
- **Últimas decisões**: "usar vitest" (02/06), "separar engine de detectores" (01/06)
- **Recente**: flow-move refatorado, testes de diagnóstico adicionados
- **Build**: ✓ 168/168 testes passando | Build limpo
<!-- sitrep:end -->

## Stack                           ← MANUAL

## Restrições Reais                ← MANUAL

## Porquês                         ← MANUAL
```

### Comando `letra sitrep`

```typescript
// commands/sitrep.ts
export async function sitrep(rootPath: string, options?: { dryRun?: boolean }) {
  const contextFile = join(rootPath, ".letra", "context.md");
  if (!existsSync(contextFile)) {
    console.log("Aviso: .letra/context.md não encontrado");
    return;
  }

  const workflow = loadWorkflow(rootPath);
  const healthRecord = loadHealthRecord(rootPath);
  const decisions = getRecentDecisions(rootPath, 4);
  const currentItem = getCurrentItem(workflow);
  const acCounts = currentItem?.spec ? countACs(join(rootPath, ".letra", "specs", currentItem.spec)) : null;
  const testResults = await runTests(rootPath); // vitest run --reporter=json
  const buildResult = await runBuild(rootPath); // npm run build --silent

  const dynamicBlock = buildSitrepBlock({
    stage: currentItem?.stage ?? "sem item ativo",
    currentItem,
    acCounts,
    healthRecord,
    decisions,
    testResults,
    buildResult,
  });

  const originalContent = readFileSync(contextFile, "utf-8");
  const newContent = replaceDynamicSection(originalContent, dynamicBlock);

  if (options?.dryRun) {
    showDiff(originalContent, newContent);
    return;
  }

  writeFileSync(contextFile, newContent, "utf-8");
  console.log(chalk.green("✓ Situação atualizada em context.md"));
  logChanges(originalContent, newContent);
}
```

### Fontes de Dados

| Informação | Fonte | Formato |
|---|---|---|
| Estágio atual | workflow.json → item ativo no estágio "doing" mais avançado | string |
| Item atual | workflow.json → item com stage em "code" ou "review" | { id, desc, spec? } |
| Contagem ACs | spec do item → countACs() | { pending, done, total } |
| Alertas | health-record.json → entries agrupadas por status | { new, ack, dismissed, resolved } |
| Decisões recentes | `.letra/decisions/` → arquivos ordenados por data | { title, date }[] |
| Testes | `vitest run --reporter=json` | { passing, total } |
| Build | `npm run build --silent` exit code | boolean |

### Substituição de Seção

```typescript
function replaceDynamicSection(content: string, newBlock: string): string {
  const startMarker = "<!-- sitrep:start -->";
  const endMarker = "<!-- sitrep:end -->";
  const pattern = new RegExp(`${startMarker}[\\s\\S]*?${endMarker}`, "g");
  
  const newSection = `${startMarker}\n${newBlock}\n${endMarker}`;
  
  if (pattern.test(content)) {
    return content.replace(pattern, newSection);
  }
  
  // Se não existe ainda, insere antes de "## Stack"
  return content.replace("## Stack", `${newSection}\n\n## Stack`);
}
```

## Acceptance Criteria

- [ ] **`letra sitrep`**: Comando principal atualiza context.md com estado real
- [ ] **Seções manuais preservadas**: Intent, Domínio, Stack, Restrições, Porquês intactos
- [ ] **Data atualizada**: Campo `> Updated:` sempre atualizado
- [ ] **Bloco dinâmico**: Conteúdo entre `<!-- sitrep:start -->` e `<!-- sitrep:end -->` substituído
- [ ] **Inserção inicial**: Se bloco não existe, inserido antes de `## Stack`
- [ ] **Dry-run**: `letra sitrep --dry-run` exibe diff sem escrever
- [ ] **Fallback sem vitest**: Se vitest falha, mostra "N/A (vitest unavailable)" em vez de quebrar
- [ ] **Fallback sem build**: Se build falha, mostra "Falha — verifique o build" em vez de quebrar
- [ ] **Workflow ausente**: Sem workflow.json, mostra "N/A (sem workflow)" sem quebrar
- [ ] **Sem prontuário**: Sem health-record.json, mostra "0 alertas" sem quebrar
- [ ] **Ignore**: Comentário `<!-- sitrep:ignore -->` impede substituição de seção
- [ ] **Testes**: Sync preserva seções manuais, atualiza data, fallback sem vitest, fallback sem build
- [ ] **Output claro**: Comando imprime quais seções foram alteradas

## Exclusions

- Edição de seções manuais via CLI — apenas substituição do bloco dinâmico
- Múltiplos blocos dinâmicos — apenas um bloco `sitrep` por context.md
- Geração automática (cron/timer) — apenas sob comando explícito

## Context

Este spec substitui o rascunho anterior `context-sync`. O nome "sala de situação" comunica melhor a ideia de um relato de situação atualizado sob demanda, em vez de "sincronizar contexto" (que parece uma operação técnica).

O `letra sitrep` é o comando que o agente (ou humano) roda antes de começar a trabalhar, ou depois de fazer mudanças, para garantir que o context.md reflete a realidade.
