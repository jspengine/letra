# Prontuário de Saúde — Registro Persistente de Verificações

> Updated: 2026-06-15

## Outcome

O Letra mantém um histórico vivo de verificações do workspace. Cada vez que `letra diagnose` (ou `letra health scan`) roda, os resultados são armazenados com ciclo de vida:  entram como "novos", podem ser revisados, reconhecidos ou descartados. Nada se perde entre execuções.

Um desenvolvedor (ou agente) pode perguntar "o que precisa de atenção?" e receber apenas os alertas ativos — sem ruído de alertas já resolvidos. Alertas antigos (>90 dias) são limpos automaticamente.

## Linguagem (UX)

| Termo Técnico | Termo Humano | Contexto |
|---|---|---|
| diagnostics state | prontuário / registro de saúde | Arquivo `.letra/health-record.json` |
| scan / run all | verificar / examinar | `letra health scan` |
| new alert | alerta novo | Entrou no último scan |
| acknowledged | reconhecido | Humano/agente viu e marcou como ciente |
| dismissed | descartado | Humano marcou como falso positivo ou irrelevante |
| resolved | resolvido | Alerta não apareceu no último scan |

## Constraints

- Zero perda de dados entre scans — o arquivo de prontuário é o estado único da verdade
- Alerta "resolvido" = não apareceu no último scan (automático)
- Alerta "descartado" = humano marcou como irrelevante (manual)
- Alerta "reconhecido" = humano/agente viu e marcou como ciente (manual)
- Limpeza automática remove entradas >90 dias nos status "resolvido" e "descartado"
- Schema versionado para permitir migrações futuras
- Arquivo de prontuário é JSON, versionado em git (faz parte do `.letra/`)

## Architecture

### Schema: `.letra/health-record.json`

```json
{
  "schemaVersion": 1,
  "lastScanAt": "2026-06-15T18:00:00.000Z",
  "entries": [
    {
      "id": "hr-001",
      "type": "desalinhamento",
      "title": "AC 'Login com email' não encontrado no código fonte",
      "status": "novo",
      "severity": "media",
      "source": "detector-ac-stale",
      "detectedAt": "2026-06-15T18:00:00.000Z",
      "resolvedAt": null,
      "dismissedAt": null,
      "dismissReason": null,
      "acknowledgedAt": null
    }
  ]
}
```

### Ciclo de Vida

```
         scan
           │
           ▼
       ┌──────┐
       │ novo │
       └──┬───┘
          │
     ┌────┴────┐
     │         │
     ▼         ▼
 ┌──────┐ ┌───────┐
 │ ciente│ │descar-│
 └──┬───┘ │ tado  │
    │     └───────┘
    │         │
    ▼         ▼
 n aparece no scan → "resolvido" automático
```

### Integração com o Motor de Diagnóstico

```typescript
// engine.ts — após runAll()
const record = loadHealthRecord(rootDir);
for (const result of results) {
  const existing = record.entries.find(e => e.id === hash(result));
  if (!existing) {
    record.entries.push({ id: hash(result), type: result.type, title: result.title, status: "novo", ... });
  } else if (existing.status === "resolvido" && result.severity !== "ok") {
    existing.status = "novo"; // reapareceu
  }
}
// Entradas que não apareceram mais → resolved
record.entries.forEach(e => {
  if (e.status !== "descartado" && !results.find(r => hash(r) === e.id)) {
    e.status = "resolvido";
    e.resolvedAt = new Date().toISOString();
  }
});
saveHealthRecord(rootDir, record);
```

### API REST (no flow-serve)

- `GET /api/health` — retorna prontuário completo
- `GET /api/health/alerts` — apenas entradas ativas (novo + ciente)
- `POST /api/health/ack/:id` — marca como "ciente"
- `POST /api/health/dismiss/:id` — descarta com reason opcional
- `POST /api/health/scan` — re-executa diagnose e mescla

### CLI

- `letra health` — exibe resumo formatado (X novos, Y cientes, Z resolvidos)
- `letra health scan` — executa diagnose e mescla com prontuário existente
- `letra health ack <id>` — marca entrada como ciente
- `letra health dismiss <id> [--reason "falso positivo"]` — descarta
- `letra health --all` — exibe entradas ocultas (descartadas, resolvidas)
- `letra health --json` — saída JSON para consumo por agente

## Acceptance Criteria

- [ ] **health-record.json**: Criado em `.letra/` após primeiro `letra health scan` com schema versionado
- [ ] **Merge idempotente**: Rodar scan 2x seguidas não duplica entradas — alertas existentes permanecem com mesmo status
- [ ] **Resolução automática**: Alerta que não aparece no scan atual → marcado como "resolvido" automaticamente
- [ ] **Ressurreição**: Alerta "resolvido" que reaparece → volta como "novo"
- [ ] **Dismiss**: `POST /api/health/dismiss/:id` persiste razão e data, alerta some do output padrão
- [ ] **Ack**: `POST /api/health/ack/:id` persiste data, alerta fica visível mas sem badge "novo"
- [ ] **Cleanup**: Entradas "resolvido" ou "descartado" com >90 dias são removidas no próximo scan
- [ ] **CLI health**: `letra health` imprime resumo com contagem por status
- [ ] **CLI health scan**: Executa engine.runAll() e mescla resultados
- [ ] **CLI health ack/dismiss**: Atalhos sem API para marcar entradas
- [ ] **--all**: Exibe entradas ocultas (descartadas, resolvidas)
- [ ] **--json**: Saída JSON para consumo por agente
- [ ] **API GET /api/health**: Retorna prontuário completo
- [ ] **API GET /api/health/alerts**: Retorna apenas entradas ativas
- [ ] **API POST /api/health/scan**: Re-executa diagnose e mescla
- [ ] **Integração diagnose**: `letra diagnose` também atualiza health-record.json automaticamente
- [ ] **Testes**: Merge 3 cenários (novo, repetido, mudou), persistência, ack, dismiss, cleanup

## Exclusions

- Sugestões de correção automática (auto-fix) — escopo separado
- UI gráfica para o prontuário — apenas CLI + REST
- Migração de dados de versões anteriores do schema — schema v1 é o inicial

## Context

Este spec substitui o rascunho anterior `diagnostics-state` com uma visão expandida: o nome "prontuário de saúde" comunica melhor o propósito (manter histórico de verificações) do que "diagnostics state" (termo técnico que não diz o que é).

A persistência é a fundação para todos os outros componentes do ciclo agêntico: sem ela, alertas somem entre sessões, o adapter não tem o que mostrar, e o agente começa sempre do zero.
