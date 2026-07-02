# Spec: health-record

> Updated: 2026-06-22

## Outcome

O Letra mantém um histórico vivo de verificações do workspace. Cada vez que `letra diagnose` (ou `letra health scan`) roda, os resultados são armazenados com ciclo de vida:  entram como "novos", podem ser revisados, reconhecidos ou descartados. Nada se perde entre execuções.

Um desenvolvedor (ou agente) pode perguntar "o que precisa de atenção?" e receber apenas os alertas ativos — sem ruído de alertas já resolvidos. Alertas antigos (>90 dias) são limpos automaticamente.

## Constraints

- Zero perda de dados entre scans — o arquivo de prontuário é o estado único da verdade
- Alerta "resolvido" = não apareceu no último scan (automático)
- Alerta "descartado" = humano marcou como irrelevante (manual)
- Alerta "reconhecido" = humano/agente viu e marcou como ciente (manual)
- Limpeza automática remove entradas >90 dias nos status "resolvido" e "descartado"
- Schema versionado para permitir migrações futuras
- Arquivo de prontuário é JSON, versionado em git (faz parte do `.letra/`)

## Exclusions

- Sugestões de correção automática (auto-fix) — escopo separado
- UI gráfica para o prontuário — apenas CLI + REST
- Migração de dados de versões anteriores do schema — schema v1 é o inicial

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

## Context

Este spec substitui o rascunho anterior `diagnostics-state` com uma visão expandida: o nome "prontuário de saúde" comunica melhor o propósito (manter histórico de verificações) do que "diagnostics state" (termo técnico que não diz o que é).

A persistência é a fundação para todos os outros componentes do ciclo agêntico: sem ela, alertas somem entre sessões, o adapter não tem o que mostrar, e o agente começa sempre do zero.
