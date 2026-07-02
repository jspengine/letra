# Spec: workspace-pulse

> Updated: 2026-06-22

## Outcome

Um comando único (`letra pulse`) responde: "como está o workspace agora?". Mostra o item em andamento, ACs pendentes, alertas ativos, dias parado, e se o build passa. Tudo em formato legível para humanos e parseável para agentes.

O desenvolvedor não precisa rodar `letra flow board`, `letra health`, `letra validate`, e `npm test` separadamente. Um comando dá o pulso do projeto.

O agente começa a sessão com `letra pulse --json` e já sabe exatamente o que precisa fazer.

## Constraints

- Um comando apenas — sem flags obrigatórias para o overview básico
- Saída texto para humanos + `--json` para agentes
- Leitura apenas — não modifica nenhum arquivo
- Falha silenciosa: se algo não existe (workflow, health-record), mostra "N/A" em vez de erro
- Rápido (< 1s) — não executa build/test a menos que solicitado
- Flags `--build` e `--test` ativam verificação de build e testes (mais lento)

## Exclusions

- Pulso contínuo (watch mode) — apenas sob comando explícito
- Gráficos ou UI — apenas CLI texto + JSON
- Histórico de pulso — apenas estado atual
- Sugestões de ação — isso é responsabilidade do handoff-rules

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

## Context

O `letra pulse` é o ponto de entrada único para entender o workspace. Antes deste spec, um agente precisava rodar múltiplos comandos ou parsear múltiplos arquivos para entender o estado. Com o pulse, um comando dá a resposta.

O pulse NÃO modifica nada — é puramente leitura. É o comando mais seguro para um agente chamar no início de uma sessão sem risco de efeito colateral.
