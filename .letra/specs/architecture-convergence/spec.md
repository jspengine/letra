# Spec: architecture-convergence

> Updated: 2026-06-27

## Outcome

O Letra passa a operar com uma arquitetura coerente com sua constitution: o comportamento do produto deixa de ficar espalhado entre UI, CLI e fallbacks hardcoded, e passa a ser resolvido principalmente a partir do workspace e do harness versionado.

Na prática, isso significa que:

- fluxos, gates, labels e expectativas de execução podem evoluir sem exigir mudanças estruturais no front-end ou no servidor
- a Web UI deixa de “definir” o processo e passa a renderizar a definição ativa do flow
- o `flow-serve` deixa de concentrar semântica de domínio em um único arquivo e passa a compor serviços menores
- o `activity-context` deixa de depender de heurísticas de stage/phase hardcoded e passa a ler pistas declarativas do flow/harness
- comportamentos automáticos ficam visíveis, rastreáveis e consistentes com “Human in the Loop” e “No Silent Automation”

## Constraints

1. A migration precisa preservar compatibilidade com workspaces atuais baseados em `.letra/workflow.json`
2. `workflow.json` continua sendo a fonte transacional de verdade do estado do workspace
3. Harness continua versionado e externo ao código de produto; o objetivo é aumentar sua autoridade, não duplicá-lo
4. Nenhuma fase pode reintroduzir “project” como agregado raiz acima de workspace
5. A refatoração precisa ser incremental: CLI, Web UI e adapters continuam funcionando durante a transição
6. A extração de módulos não pode quebrar auditabilidade, snapshots, session-log ou health-record
7. Toda automação adicional precisa respeitar “No Silent Automation” e deixar rastros explícitos
8. Sempre que possível, comportamento novo deve nascer em artefatos declarativos, não em branches condicionais de TypeScript

## Exclusions

- Reescrita completa do produto em nova stack
- Mudança de linguagem ou abandono da base Node/TypeScript
- Reprojeto visual completo do produto
- Nova engine de execução de LLMs dentro do Letra
- Reformulação ampla de todas as specs legadas
- Correção de todos os warnings históricos do `letra validate`
- Migração imediata de todos os comandos para suporte total de `--dry-run` em uma única entrega

## Acceptance Criteria

- [x] **AC1**: Existe uma definição clara do fluxo ativo do workspace que resolve, em um único ponto, stages, gates, phases, labels e hints de execução, sem depender de lookup direto em `harness.flows.sdlc`
- [x] **AC2**: `flow-move`, `flow-serve`, `activity-context` e a Web UI passam a consumir a mesma resolução normalizada do flow, reduzindo duplicação semântica
- [x] **AC3**: Templates de flow deixam de existir como fonte primária hardcoded no servidor; o comportamento padrão passa a vir do harness ou de uma camada explícita de bootstrap compatível
- [x] **AC4**: A UI deixa de hardcodar ordem de stages, labels, agentes e gates como semântica do processo; essas informações passam a ser derivadas da definição ativa do flow
- [x] **AC5**: O `activity-context` passa a derivar expectativas de `review`, `gate` e sinais operacionais a partir de metadados declarativos do flow/harness, e não de uma lista fixa de stage IDs e phase IDs
- [x] **AC6**: O `flow-serve` é quebrado em módulos de serviço menores, com responsabilidades separadas para workflow, specs, diagnostics, workspace/contexto e eventos
- [x] **AC7**: Toda automação recorrente relevante do servidor fica visível como ação de sistema supervisionável, com causa e efeito claros no estado e/ou na UI
- [x] **AC8**: O vocabulário de workspace vs target/repository fica consistente nas camadas principais; o produto deixa de expor “project” como agregado raiz em novas superfícies e fluxos
- [x] **AC9**: Fica definida uma política de escrita por tipo de artefato (canônico, derivado, evidência, rollback), reduzindo mutações distribuídas onde há invariantes de domínio
- [x] **AC10**: Existe um plano incremental de rollout com fases pequenas, cada uma com item de flow próprio, sem exigir big-bang refactor
- [x] **AC11**: A documentação arquitetural da refatoração referencia explicitamente o diagnóstico atual e a constitution, deixando claro o que é convergência e o que ainda é legado compatível
- [x] **AC12**: Ao final da fase inicial, é possível alterar aspectos centrais do flow ativo sem editar diretamente a UI ou condicionais de domínio no servidor

## Context

O Letra já tem uma direção arquitetural forte: workspace como unidade de valor, workflow como estado transacional, harness como camada de autoridade e memória operacional persistida em arquivos auditáveis. O problema não é ausência de arquitetura; é a coexistência de duas arquiteturas ao mesmo tempo.

Hoje parte relevante do comportamento do produto ainda está distribuída entre:

- `flow-serve` e seus templates e rotas com semântica própria
- `flow-move` e sua leitura direta de `harness.flows.sdlc`
- `phases/engine.ts` com fases built-in específicas
- componentes da UI que conhecem stage order, labels, agentes e gates
- `activity-context` com inferências baseadas em nomes hardcoded

Isso cria um produto que parece configurável, mas ainda exige mudança de código para várias mudanças de processo. Esse acoplamento fere diretamente os princípios “Harness is Authority”, “Harness first, CLI second”, “Workspace is Context” e “No Silent Automation”.

O objetivo deste spec é transformar o diagnóstico arquitetural em plano executável de convergência. Em vez de perseguir uma reescrita, a estratégia é mover autoridade do código para os artefatos corretos em passos pequenos, com compatibilidade e rastreabilidade.
