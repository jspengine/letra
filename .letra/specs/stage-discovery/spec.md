# Próximo Estágio — Descoberta Automática do Destino do Item

> Updated: 2026-06-15

## Outcome

O agente não precisa saber o nome do próximo estágio para mover um item. `letra flow move ITEM-X --auto` descobre automaticamente qual é o próximo estágio com base na ordem definida no workflow. O adaptador também mostra "Seu item está em X. Próximo: Y" para que o agente saiba antes de mover.

## Linguagem (UX)

| Termo Técnico | Termo Humano | Onde |
|---|---|---|
| auto discovery | próximo estágio automático | `--auto` no flow move |
| stage order | ordem dos estágios | workflow.json `stages[].order` |
| next stage | próximo estágio | Estágio com order atual + 1 |
| zone transition | mudança de zona | De "doing" para "review" etc |

## Constraints

- `--auto` calcula o próximo estágio baseado na ordem crescente (`order` field) dos stages no workflow.json
- Se item está no último estágio (maior order), `--auto` não faz nada (já está no fim)
- Se workflow não tem stages definidos, `--auto` mostra erro amigável
- O adapter mostra estágio atual + próximo estágio para o item ativo
- A descoberta é local (lê workflow.json) — não requer API
- Funciona com qualquer workflow, independente de quantos estágios

## Architecture

### Funcionalidade: `letra flow move ITEM-X --auto`

```typescript
// commands/flow-move.ts — novo handler para --auto
async function flowMoveAuto(itemId: string, rootPath: string) {
  const workflow = loadWorkflow(rootPath);
  const item = workflow.items.find(i => i.id === itemId);

  if (!item) {
    console.log(chalk.red(`Item ${itemId} não encontrado`));
    process.exit(1);
  }

  const currentStage = workflow.stages.find(s => s.id === item.stage);
  if (!currentStage) {
    console.log(chalk.red(`Estágio "${item.stage}" não encontrado no workflow`));
    process.exit(1);
  }

  const nextStage = workflow.stages
    .filter(s => s.order > currentStage.order)
    .sort((a, b) => a.order - b.order)[0];

  if (!nextStage) {
    console.log(chalk.yellow(`Item ${itemId} já está no último estágio (${currentStage.name})`));
    return;
  }

  // Delega para o flowMove() existente com o estágio descoberto
  await flowMove(itemId, nextStage.id, rootPath, { from: item.stage });
  console.log(chalk.green(`Item ${itemId} movido: ${currentStage.name} → ${nextStage.name} (automático)`));
}
```

### Funcionalidade: Adapter mostra próximo estágio

A seção de workflow no adaptador ganha o próximo estágio:

```markdown
## Workflow

**Pipeline**: Backlog → Design → Code → Review → Done

**Item atual**: ITEM-41 (Prontuário de Saúde)
  Estágio: Code
  ➡ Próximo estágio: Review
  Comando: `letra flow move ITEM-41 --auto`
```

### Lógica de Geração no Adapter

```typescript
function buildStageInfo(workflow: Workflow, item?: WorkflowItem): string {
  const stageOrder = workflow.stages
    .sort((a, b) => a.order - b.order)
    .map(s => s.name)
    .join(" → ");

  const lines = [`**Pipeline**: ${stageOrder}`, ""];

  if (item) {
    const currentStage = workflow.stages.find(s => s.id === item.stage);
    let nextStageName = "(último estágio)";

    if (currentStage) {
      const nextStage = workflow.stages
        .filter(s => s.order > currentStage.order)
        .sort((a, b) => a.order - b.order)[0];
      if (nextStage) nextStageName = nextStage.name;
    }

    lines.push(`**Item atual**: ${item.id} (${item.description})`);
    lines.push(`  Estágio: ${currentStage?.name ?? item.stage}`);
    lines.push(`  ➡ Próximo estágio: ${nextStageName}`);
    lines.push(`  Comando: \`letra flow move ${item.id} --auto\``);
  }

  return lines.join("\n");
}
```

### Exemplos

```
Workflow com 5 estágios:
  Item em Backlog (order 0) → --auto → Design (order 1)
  Item em Design (order 1) → --auto → Code (order 2)
  Item em Code (order 2) → --auto → Review (order 3)
  Item em Review (order 3) → --auto → Done (order 4)
  Item em Done (order 4) → --auto → "já está no último estágio"

Workflow com estágios personalizados:
  [Proposta, Análise, Desenvolvimento, QA, Homologação, Produção]
  Item em Análise → --auto → Desenvolvimento
```

### Impacto no Handoff

O handoff-rules existente diz:

```
letra flow move ITEM-39 --to proximo_estagio
```

Com `--auto`, fica:

```
letra flow move ITEM-39 --auto
```

O agente não precisa mais saber o nome do próximo estágio. `--auto` descobre.

## Acceptance Criteria

- [ ] **`--auto`**: `letra flow move ITEM-X --auto` descobre próximo estágio por order
- [ ] **Último estágio**: Se item já está no último, exibe mensagem e não move
- [ ] **Stage ausente**: Se stage do item não existe no workflow, erro amigável
- [ ] **Item ausente**: Se item não existe, erro amigável
- [ ] **Adapter mostra**: Seção do workflow no adaptador mostra "Próximo estágio: X"
- [ ] **Adapter comando**: Mostra `letra flow move ITEM-X --auto` como ação
- [ ] **Sem stages**: Se workflow não tem stages, erro amigável
- [ ] **Ordem correta**: Usa `stage.order` ascendente — não assume posição no array
- [ ] **Compatibilidade**: Funciona com workflows de 2 a N estágios
- [ ] **Testes**: Mover 1o estágio, mover estágio intermediário, mover último, adapter info, workflow sem stages

## Exclusions

- Mover para estágio específico com `--auto` (`--auto --to code`) — use `--to` explícito para isso
- Multi-saltos (pular estágios) — `--auto` sempre vai para o próximo imediato
- Estágios paralelos (ex: Code e Review simultâneos) — ordem linear apenas

## Context

Este spec resolve o problema mais básico do handoff: o agente não sabe para QUAL estágio mover o item. "Próximo estágio" é óbvio para um humano que desenhou o workflow, mas não para um agente que acabou de chegar.

O `--auto` elimina a necessidade de o agente parsear workflow.json para descobrir a ordem. O adapter mostra o próximo estágio como informação adicional, mas o comando `--auto` é o que realmente resolve o problema.
