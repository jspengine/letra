# Spec: workspace-runtime-governance

> Updated: 2026-06-28

## Outcome

O Letra passa a oferecer um modelo estrutural coerente para configuração de workspaces, composição de pastas locais, definição de equipes digitais, fluxos supervisionáveis e governança de execução com IA, sem violar a constitution do produto.

Na prática, isso significa que:

- o `workspace` continua sendo o único agregado raiz do domínio
- o produto deixa de tratar `project` como entidade arquitetural concorrente ao workspace
- a configuração operacional do usuário passa a ser representada por targets, scopes, equipes, fluxos e runs dentro do workspace
- a inferência de contexto para adapters e LLMs passa a ser resolvida por composição explícita de contexto ativo, em vez de heurísticas dispersas
- auditoria, rastreabilidade e governança de conteúdo gerado por IA passam a ser ativos estruturais do core do produto
- o armazenamento embarcado com `PGlite` entra como read model, índice textual e base de auditoria consultável, sem substituir `workflow.json` como fonte transacional canônica

## Constraints

1. `Workspace` permanece como o único agregado raiz do produto, em conformidade com a constitution
2. Nenhuma nova superfície pode reintroduzir `project` como raiz semântica acima de workspace
3. `workflow.json` continua sendo a fonte transacional de verdade do estado operacional do fluxo
4. Harness continua versionado e externo ao código do produto; novas capacidades devem aumentar sua autoridade, não duplicá-la
5. Toda mutação relevante de estado precisa passar por um gateway explícito de escrita com rastreabilidade
6. `PGlite` deve ser tratado como camada derivada e reconstruível a partir das fontes canônicas
7. Toda automação precisa respeitar `Human in the Loop` e `No Silent Automation`
8. O modelo deve suportar workspaces com uma ou múltiplas pastas locais sem degradar a qualidade de inferência de contexto para LLMs

## Exclusions

- Migração imediata do estado canônico inteiro do produto para banco relacional
- Substituição de `workflow.json` por `PGlite` como fonte primária de verdade
- Reescrita completa da Web UI, CLI ou flow engine
- Implementação de execução autônoma irrestrita sem gates humanos
- Introdução de uma engine própria de inferência dentro do Letra
- Entrega final de todas as telas de CRUD desta capacidade em uma única fase

## Acceptance Criteria

- [ ] **AC1**: Existe uma definição formal aprovada em spec de que `workspace` é o único agregado raiz e de que `project` não pode existir como raiz concorrente nas novas superfícies
- [ ] **AC2**: O modelo conceitual do domínio passa a distinguir explicitamente `workspace`, `target`, `scope`, `team`, `agent`, `flow definition`, `flow run`, `run item` e `audit event`
- [ ] **AC3**: Fica definido um modelo entidade-relacionamento inicial que suporte configuração de pastas, equipes, fluxos, execução e auditoria sem ambiguidade de ownership
- [ ] **AC4**: Fica definida uma política explícita de armazenamento separando artefatos canônicos, derivados, evidências e trilha de auditoria
- [ ] **AC5**: Fica estabelecido que `PGlite` entra como read model local, índice de busca textual e base consultável de auditoria, com estratégia de reconstrução a partir das fontes canônicas
- [ ] **AC6**: Fica definido um contrato inicial para resolução de contexto ativo consumido por harness, adapters e LLMs, reduzindo dependência de heurísticas locais
- [ ] **AC7**: Fica formalizado que toda iteração relevante registra quem agiu, o que foi feito, quando ocorreu, sobre qual contexto e com qual evidência
- [ ] **AC8**: O desenho considera explicitamente governança de conteúdo gerado por IA, incluindo rastreabilidade de prompt, contexto, modelo e output
- [ ] **AC9**: O plano deixa claro quais partes são decisão estrutural de curto prazo e quais entram como rollout incremental posterior

## Context

Os requisitos apresentados introduzem uma necessidade real de evolução do produto: permitir que o usuário configure workspaces com múltiplas pastas, estruture equipes digitais, associe agentes a capacidades e execute fluxos supervisionados sobre ferramentas agênticas externas.

O problema não está na intenção do requisito, e sim no risco de materializá-lo com um modelo conceitual incompatível com a architecture atual do Letra. A constitution estabelece com clareza que:

- workspace é contexto
- workspace é a única unidade de valor
- harness é autoridade
- não pode haver automação invisível

Portanto, o refinamento correto não é introduzir `project` como novo centro do domínio. O refinamento correto é decompor o requisito em entidades subordinadas ao workspace:

- targets para representar pastas locais
- scopes para agrupamentos lógicos opcionais
- teams e agents para capacidade operacional
- flow definitions e flow runs para execução supervisionada
- audit events e AI generation records para governança

Além disso, o repositório já carrega um histórico de drift entre fontes de estado. Por isso, qualquer introdução de banco embarcado precisa respeitar uma política rigorosa de canônico versus derivado. A entrada de `PGlite` só melhora o produto se servir para consulta, busca, auditoria e projeções rápidas sem competir com o estado transacional canônico já estabelecido.
