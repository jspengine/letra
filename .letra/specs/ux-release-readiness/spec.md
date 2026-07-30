# Spec: UX Release Readiness

> Updated: 2026-07-10

## Outcome

O Letra apresenta uma experiência de supervisão coesa e viável para release com as features já existentes. O usuário entende rapidamente o que precisa de sua decisão, onde acompanhar o trabalho, quais regras governam o workspace e onde encontrar a evidência operacional, sem depender de taxonomia técnica ou navegação fragmentada.

## Constraints

- A constitution permanece autoridade máxima, com prioridade explícita para `Human in the Loop`, `Product Truth and User Intent`, `Harness is Authority` e `Regression Safety Before Expansion`.
- O trabalho desta frente é de UX e arquitetura de informação antes de implementação pesada. A especificação deve reduzir risco de retrabalho e orientar backlog incremental.
- A release-alvo deve priorizar reuso das funcionalidades já existentes no client, evitando reescrita total da Web UI.
- Nenhum item desta frente pode reintroduzir destinos duplicados, controles inertes ou linguagem que prometa automação inexistente.
- @letra/ui e os tokens canônicos do DS devem ser a base visual obrigatória para a transição.
- Se um componente necessário ainda não existir, ele deve ser criado primeiro no catálogo do design system e somente depois consumido pelo app.
- A navegação principal deve permanecer orientada por intenção do usuário supervisor, não por módulos internos.

## Exclusions

- Implementação completa da refatoração visual e estrutural nesta spec.
- Novas capacidades de backend, novos fluxos de agentes ou novos contratos de API não necessários para a release atual.
- Reescrita integral do board, auditoria, editor de documentos ou setup flow em uma única etapa.
- Introdução de novas superfícies primárias além das jornadas já suportadas pelo produto.

## Acceptance Criteria

- [x] **AC1 — Diagnóstico formalizado**: Existe uma análise documentada dos gaps entre promessa do produto, jornadas atuais, arquitetura de informação e design system do Letra, com evidência em código e impacto para a experiência.
- [x] **AC2 — Jornadas-alvo definidas**: As jornadas da release são explicitadas com propósito, entrada, ação principal, evidência esperada e superfície de destino, cobrindo ao menos `Supervisão`, `Trabalho`, `Conhecimento e Regras`, `Atividade` e `Workspace`.
- [x] **AC3 — Navegação-alvo consolidada**: A spec define a navegação primária da release, lista destinos que devem sair do primeiro plano e justifica a consolidação em termos de intenção do usuário e verdade operacional.
- [x] **AC4 — Princípios de UX aplicáveis**: A frente documenta princípios claros para decisões futuras de UX, incluindo linguagem honesta, supervisão antes de operação, evidência observável, redução de atrito e uso obrigatório do DS.
- [x] **AC5 — Backlog de transição preparado**: O workflow passa a conter itens de backlog vinculados a esta spec, quebrando a transição em etapas executáveis e revisáveis antes da implementação.
- [x] **AC6 — Escopo viável para release**: A documentação separa com clareza o que é obrigatório para a release, o que é melhoria pós-release e o que deve ser explicitamente adiado para não diluir a frente.
- [x] **AC7 — Cobertura das superfícies existentes**: O material considera e reposiciona as superfícies atuais já existentes no client, incluindo `HomeView`, `FlowView`, `ExecutionView`, `ContextView`, `AuditLogView`, `SpecsView`, `WorkspacesView`, `DiagnosticsIndicator` e `AgentDetail`.
- [x] **AC8 — Roteiro incremental**: Existe um plano de transição em fases com dependências, ordem sugerida, riscos e critérios de pronto para iniciar implementação sem reabrir debate estrutural básico.

## Evidência (drift DS)
- Corrigido uso de tokens indefinidos no client: `packages/client/src/components/ui/button.tsx` trocou referência a `--color-secondary` por `--secondary`; `packages/client/src/components/ui/sidebar.tsx` alinhou `sidebar-accent` / `sidebar-border` para os aliases canônicos do DS.
- Eliminado hardcoded color no UI/client: `packages/ui/src/patterns/marching-border.tsx` trocou `#000` por `oklch(0% 0 0)`; `packages/client/src/components/Header/LogoDiamond.tsx` substituiu hex por tokens canônicos; `packages/client/src/index.css` trocou `rgba(255, 255, 255, 0.1)` por `oklch(100% 0 0 / 0.1)`.
- `npm run ds:check` e `npm run ds:validate` estão green na data desta correção.

## Context

O Letra já possui um conjunto relevante de capacidades: onboarding de workspace, supervisão parcial, board de trabalho, auditoria operacional, edição de contexto, gestão de specs, setup flow e surfaces de diagnóstico. O problema atual não é falta de funcionalidade, e sim falta de convergência entre a promessa do produto e a experiência real.

A constitution e a spec `product-supervision-navigation` deixam claro que o produto deve responder perguntas do supervisor humano: o que precisa de decisão, o que está acontecendo, o que está sendo construído, quais regras governam o trabalho e onde estão as evidências. A UI atual ainda expõe parte significativa da taxonomia interna do sistema, mistura destinos antigos com a arquitetura mais recente e mantém dívida de design system no `packages/client`.

Esta frente existe para congelar a direção de UX antes de iniciar a transição. A intenção é sair desta etapa com uma definição tangível e operacionalizável da experiência de release, reduzindo risco de implementar ajustes pontuais que não resolvem o problema central de produto.


