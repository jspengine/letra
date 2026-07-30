# Rollout Plan — UX Release Readiness

> Updated: 2026-07-10

## Objective

Quebrar a transição de UX em etapas pequenas, reviewáveis e alinhadas à release, sem reabrir discussão estrutural a cada implementação.

## Phase 1 — Navigation And Product Framing

### Goal

Consolidar a navegação primária segundo a intenção do usuário.

### Includes

- substituir destinos herdados do primeiro plano
- remover itens desabilitados e placeholders da navegação crítica
- definir `Supervisão` como entrada padrão com workspace ativo
- alinhar nomenclatura global do produto

### Done Means

O usuário consegue navegar pela release usando apenas `Supervisão`, `Trabalho`, `Conhecimento e Regras` e `Atividade`, sem topar com destinos inertes.

## Phase 2 — Supervision First

### Goal

Transformar a superfície inicial em inbox de supervisão.

### Includes

- migrar a hierarquia principal de `HomeView` para o modelo de `SupervisionInbox`
- destacar decisões, bloqueios, atividade e próxima ação segura
- reduzir protagonismo de métricas e cards auxiliares

### Done Means

O usuário abre o produto e entende imediatamente o que precisa da sua decisão.

## Phase 3 — Work Surface Consolidation

### Goal

Separar jornada de trabalho supervisionado de administração estrutural do flow.

### Includes

- reduzir ruído de configuração estrutural em `FlowView`
- preservar board, item detail, gate actions e timeline como núcleo
- rebaixar edição de stages/webhooks para área avançada ou fluxo secundário

### Done Means

`Trabalho` fica focado no acompanhamento e decisão sobre itens.

## Phase 4 — Knowledge And Rules Consolidation

### Goal

Unificar contexto, specs e regras como biblioteca de governança.

### Includes

- consolidar `ContextView`, `SpecsView` e `HarnessViewer`
- alinhar nomenclatura e framing editorial
- tornar evidente a função de cada fonte de verdade

### Done Means

O usuário localiza a regra ou spec certa sem navegar por módulos técnicos desconectados.

## Phase 5 — Activity And Evidence

### Goal

Posicionar auditoria como trilha investigativa principal.

### Includes

- consolidar `AuditLogView` como `Atividade`
- reforçar links para item, spec, decisão e automação
- ajustar linguagem e hierarquia para investigação operacional

### Done Means

`Atividade` vira a superfície oficial para reconstruir acontecimentos relevantes.

## Phase 6 — DS Convergence On Critical Surfaces

### Goal

Fazer o design system governar as jornadas críticas da release.

### Includes

- reduzir estilos inline nas superfícies principais
- priorizar tokens canônicos e componentes de `@letra/ui`
- alinhar shell, spacing, radius, estados e feedback visual

### Done Means

As superfícies críticas da release têm semântica visual coerente e menor dependência de compatibilidade legada.

## Risks And Mitigations

- Risco: renomear navegação sem reorganizar conteúdo.
  Mitigação: cada fase precisa reposicionar a jornada correspondente.

- Risco: tentar resolver toda a dívida visual numa única etapa.
  Mitigação: focar primeiro nas superfícies críticas da release.

- Risco: preservar affordances falsas por conveniência.
  Mitigação: remover ou esconder do primeiro plano qualquer controle sem efeito observável.

## Backlog Mapping

- Item 1: Consolidação da navegação primária e framing do produto
- Item 2: Inbox de supervisão como experiência padrão
- Item 3: Consolidação da jornada de trabalho
- Item 4: Consolidação de conhecimento e regras
- Item 5: Consolidação de atividade e evidência
- Item 6: Convergência do DS nas superfícies críticas
