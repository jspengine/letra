# Spec: activity-context

> Updated: 2026-06-26

## Outcome

O Letra passa a entregar ao agente um contexto operacional recortado para a atividade atual, em vez de apenas expor arquivos brutos do workspace. Para cada momento do fluxo (`design`, `implement`, `review`, `diagnose`, `gate`), o sistema produz um "activity context" com objetivo, item ativo, riscos, leituras obrigatórias, ações recomendadas e proibições relevantes. O resultado esperado é reduzir deriva, excesso de contexto e ambiguidade sobre "o que fazer agora".

## Constraints

1. `workflow.json` continua sendo a fonte única de verdade para item, stage e metadata operacional
2. O activity context é derivado de artefatos existentes (`workflow`, `focus.md`, `context.md`, `constitution.md`, `health-record`, `session-log`) — não cria um estado paralelo manual
3. O recorte deve respeitar a constitution: human-in-the-loop, workspace-first, harness-as-authority e no silent automation
4. A saída precisa ser agnóstica de agent/tool — pode alimentar AGENTS.md, Web UI, API e futuros adapters
5. Cada modo de atividade deve expor apenas contexto necessário para aquela execução, priorizando sinal sobre volume
6. Gates humanos e restrições arquiteturais devem aparecer explicitamente quando forem relevantes para a atividade atual
7. O sistema deve funcionar sem quebrar os fluxos atuais baseados em `pulse`, `health`, `focus`, `sitrep` e adapters existentes

## Exclusions

- Modelo de linguagem embutido no Letra ou execução autônoma de prompts
- Memória semântica de longo prazo fora dos artefatos já existentes no workspace
- Mudanças no schema do `workflow.json`
- Reescrita completa do sistema de adapters
- Reprojeto visual completo da Web UI
- Personalização por provedor específico (Cursor, Codex, Claude, etc.) além de campos neutros de contexto

## Acceptance Criteria

- [ ] **AC1**: Existe um builder de `activity context` que recebe pelo menos `{ activity, workspaceRoot }` e retorna uma estrutura normalizada com `objective`, `currentItem`, `stage`, `mustRead[]`, `mustNotDo[]`, `nextActions[]`, `risks[]` e `signals[]`
- [ ] **AC2**: O builder suporta no mínimo os modos `design`, `implement`, `review`, `diagnose` e `gate`, cada um com priorização e instruções diferentes
- [ ] **AC3**: Em modo `implement`, o contexto inclui spec ativa, ACs pendentes do item, restrições arquiteturais e próxima ação objetiva; não inclui instruções de revisão como foco principal
- [ ] **AC4**: Em modo `review`, o contexto troca o foco para diff/spec/riscos/testes/gates e destaca problemas esperados em vez de instruções de construção
- [ ] **AC5**: Em modo `gate`, o contexto explicita qual gate humano está em jogo, qual decisão é esperada e quais evidências o humano precisa revisar antes de aprovar
- [ ] **AC6**: O builder detecta divergências entre `focus.md`, item ativo, stage atual e alertas de health, expondo isso em `signals[]` com prioridade alta
- [ ] **AC7**: O activity context sempre referencia arquivos concretos do workspace em `mustRead[]`, incluindo no mínimo `.letra/context.md` e `.letra/constitution.md`, e inclui `.letra/focus.md` ou spec ativa quando aplicável
- [ ] **AC8**: Existe uma forma programática de consumir esse contexto no CLI e no `flow-serve` sem duplicar a lógica de composição
- [ ] **AC9**: Os adapters podem optar por incluir um resumo curto do activity context sem perder compatibilidade com o conteúdo atual
- [ ] **AC10**: Quando não houver item ativo ou spec focada, o builder retorna contexto válido de descoberta/triagem em vez de falhar
- [ ] **AC11**: O output do activity context não duplica integralmente arquivos grandes; ele resume e referencia, mantendo o contexto enxuto
- [ ] **AC12**: Testes cobrem pelo menos um caso por modo de atividade e validam a mudança de prioridade entre `implement`, `review` e `gate`

## Context

Hoje o Letra já fornece boa governança para o agente: constitution, context, focus, spec, session log, health record, workflow e adapters regenerados. Isso já coloca o projeto acima da média em direcionamento operacional. Ainda assim, o contexto chega majoritariamente como um pacote fixo de arquivos e instruções, exigindo que o agente faça sozinho o recorte do que importa para cada tarefa.

O próximo salto de qualidade não é adicionar mais contexto, e sim entregar o contexto certo para o momento certo. Um agente em implementação precisa de ACs, restrições e próximos passos. Um agente em revisão precisa de diff, riscos, checks e violações prováveis. Um humano em gate precisa de evidências e decisão clara. Misturar tudo no mesmo envelope aumenta ruído e favorece drift.

Este spec propõe uma camada de activity context que fica acima dos artefatos existentes e abaixo dos adapters/UI. Ela não substitui workflow, focus ou context; ela compõe uma janela operacional derivada e situacional. O objetivo é transformar o harness do Letra de "bom provedor de contexto base" para "orquestrador de contexto situacional".
