# Pulso do Workspace — Overview de Uma Olhada Só

> Updated: 2026-06-15

## Outcome

Um comando único (`letra pulse`) responde: "como está o workspace agora?". Mostra o item em andamento, ACs pendentes, alertas ativos, dias parado, e se o build passa. Tudo em formato legível para humanos e parseável para agentes.

O desenvolvedor não precisa rodar `letra flow board`, `letra health`, `letra validate`, e `npm test` separadamente. Um comando dá o pulso do projeto.

O agente começa a sessão com `letra pulse --json` e já sabe exatamente o que precisa fazer.

## Linguagem (UX)

| Termo Técnico | Termo Humano | Contexto |
|---|---|---|
| workspace overview | pulso do workspace | `letra pulse` |
| current item | item em andamento | Item no estágio "code" ou "review" |
| pending ACs | ACs pendentes | Critérios de aceitação não concluídos |
| health alert count | alertas ativos | Contagem de alertas "novo" no prontuário |
| days idle | dias parado | Dias desde último `letra sitrep` ou mudança no workflow |
| build status | build | `npm run build` passou ou falhou |
| test status | testes | `vitest run` passou ou falhou |

## Constraints

- Um comando apenas — sem flags obrigatórias para o overview básico
- Saída texto para humanos + `--json` para agentes
- Leitura apenas — não modifica nenhum arquivo
- Falha silenciosa: se algo não existe (workflow, health-record), mostra "N/A" em vez de erro
- Rápido (< 1s) — não executa build/test a menos que solicitado
- Flags `--build` e `--test` ativam verificação de build e testes (mais lento)

## Architecture

### Saída Texto (`letra pulse`)

```
╔══════════════════════════════════════════════╗
║          Pulso do Workspace                  ║
║          letra · 15/06/2026 18:00            ║
╚══════════════════════════════════════════════╝

Item em andamento:
  ITEM-39 · Harness meta-test
  Estágio: Code · 3 dias no estágio
  ACs: 5/6 pendentes (1 feito)
  Tasks: 2/4 abertas
  Spec: .letra/specs/harness-meta-test/spec.md

Alertas:
  3 novos · 2 cientes · 0 resolvidos
  ⚠ 1 alerta de severidade alta
  → Corra `letra health` para detalhes

Build: ✓ Passou (npm run build)
Testes: ✓ 168/168 passando

Última atualização: 15/06/2026 (via sitrep)
Próximo item na fila: ITEM-16 · flow import issues (Backlog)
```

### Saída JSON (`letra pulse --json`)

```json
{
  "workspace": "letra",
  "pulseAt": "2026-06-15T18:00:00.000Z",
  "currentItem": {
    "id": "ITEM-39",
    "description": "Harness meta-test",
    "stage": "code",
    "daysInStage": 3,
    "spec": "harness-meta-test",
    "acs": { "pending": 5, "done": 1, "total": 6 },
    "tasks": { "open": 2, "done": 2, "total": 4 }
  },
  "alerts": {
    "new": 3,
    "acknowledged": 2,
    "resolved": 0,
    "dismissed": 1,
    "highSeverity": 1
  },
  "build": { "status": "passed" },
  "tests": { "status": "passed", "passing": 168, "total": 168 },
  "lastUpdated": "2026-06-15T12:00:00.000Z",
  "nextItem": { "id": "ITEM-16", "description": "flow import issues", "stage": "backlog" }
}
```

### API REST

- `GET /api/pulse` — retorna JSON do pulso
- `GET /api/pulse?build=true&test=true` — inclui build e test (mais lento)

### Implementação

```typescript
// commands/pulse.ts
export async function pulse(rootPath: string, options?: { build?: boolean; test?: boolean; json?: boolean }) {
  const workflow = loadWorkflow(rootPath);
  const healthRecord = loadHealthRecord(rootPath);
  const currentItem = findCurrentItem(workflow);
  const acCounts = currentItem?.spec ? countACs(join(rootPath, ".letra", "specs", currentItem.spec)) : null;
  const nextItem = findNextBacklog(workflow);
  const lastUpdated = getLastSitrepDate(rootPath);
  const daysIdle = lastUpdated ? daysSince(lastUpdated) : null;
  
  let buildStatus = { status: "skipped" as const };
  let testStatus = { status: "skipped" as const };
  
  if (options?.build) {
    buildStatus = await checkBuild(rootPath);
  }
  if (options?.test) {
    testStatus = await checkTests(rootPath);
  }
  
  const pulseData = {
    workspace: workflow.name,
    pulseAt: new Date().toISOString(),
    currentItem: currentItem ? {
      id: currentItem.id,
      description: currentItem.description,
      stage: currentItem.stage,
      daysInStage: daysInStage(currentItem),
      spec: currentItem.spec,
      acs: acCounts ?? { pending: 0, done: 0, total: 0 },
      tasks: getTaskCounts(currentItem),
    } : null,
    alerts: {
      new: healthRecord?.entries.filter(e => e.status === "novo").length ?? 0,
      acknowledged: healthRecord?.entries.filter(e => e.status === "ciente").length ?? 0,
      resolved: healthRecord?.entries.filter(e => e.status === "resolvido").length ?? 0,
      dismissed: healthRecord?.entries.filter(e => e.status === "descartado").length ?? 0,
      highSeverity: healthRecord?.entries.filter(e => e.status === "novo" && e.severity === "alta").length ?? 0,
    },
    build: buildStatus,
    tests: testStatus,
    lastUpdated: lastUpdated?.toISOString() ?? null,
    daysIdle,
    nextItem: nextItem ? { id: nextItem.id, description: nextItem.description, stage: nextItem.stage } : null,
  };
  
  if (options?.json) {
    console.log(JSON.stringify(pulseData, null, 2));
  } else {
    renderPulseText(pulseData);
  }
}
```

## Acceptance Criteria

- [ ] **`letra pulse`**: Exibe overview sem flags obrigatórias
- [ ] **Item atual**: Mostra ID, descrição, estágio, dias no estágio
- [ ] **ACs pendentes**: Contagem pending/done/total do item atual
- [ ] **Tasks**: Contagem de tasks abertas/feitas se item tiver tasks
- [ ] **Alertas**: Contagem de alertas novos/cientes/resolvidos
- [ ] **Severidade alta**: Destaca se há alertas de severidade alta
- [ ] **--json**: Saída JSON completa para consumo por agente
- [ ] **--build**: Inclui resultado de `npm run build`
- [ ] **--test**: Inclui resultado de `vitest run`
- [ ] **Fallback**: Sem workflow, mostra "N/A" sem quebrar
- [ ] **Sem item ativo**: Mostra "Nenhum item em andamento" sem quebrar
- [ ] **Próximo item**: Mostra primeiro item do backlog se existir
- [ ] **Dias parado**: Mostra dias desde último sitrep
- [ ] **API GET /api/pulse**: Retorna JSON do pulso
- [ ] **API GET /api/pulse?build=true**: Inclui build na resposta
- [ ] **Rápido sem --build/--test**: < 1s sem verificar build/test
- [ ] **Testes**: Saída texto, saída JSON, fallback sem workflow, fallback sem health-record

## Exclusions

- Pulso contínuo (watch mode) — apenas sob comando explícito
- Gráficos ou UI — apenas CLI texto + JSON
- Histórico de pulso — apenas estado atual
- Sugestões de ação — isso é responsabilidade do handoff-rules

## Context

O `letra pulse` é o ponto de entrada único para entender o workspace. Antes deste spec, um agente precisava rodar múltiplos comandos ou parsear múltiplos arquivos para entender o estado. Com o pulse, um comando dá a resposta.

O pulse NÃO modifica nada — é puramente leitura. É o comando mais seguro para um agente chamar no início de uma sessão sem risco de efeito colateral.
