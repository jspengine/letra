# Spec: Verdade do Produto e Navegação de Supervisão

> Updated: 2026-07-03

## Outcome

O usuário identifica onde está, o que precisa de sua decisão, o que acontece no workspace, quais regras governam o trabalho e onde estão as evidências, sem conhecer previamente a estrutura interna do Letra. A interface apresenta somente capacidades sustentadas por estado real e rastreável.

## Constraints

- Constitution e harness permanecem autoridades; workspace continua sendo o único agregado raiz.
- Nenhuma ação destrutiva ou irreversível ocorre sem gate humano explícito.
- Estado canônico não pode ser substituído por estado local ou simulado.
- Toda ação produz resultado observável, persistido quando aplicável e auditável.
- A navegação principal terá no máximo quatro destinos orientados à intenção do usuário.
- A migração deve preservar acesso aos dados e funcionalidades válidas existentes.
- Micro-interações da navegação (hover, active, colapso/expansão, tooltips, animações de ícone, feedback visual) devem ser preservadas ou melhoradas — nunca regredidas.
- Cada fase registra baseline, regressão, suíte afetada e risco residual antes de concluir ACs.

## Exclusions

- Engine autônoma ou runs fictícios.
- Reescrita integral da Web UI em uma única entrega.
- Alteração da política canônica de armazenamento.

## Acceptance Criteria

- [x] **AC1 — Verdade operacional**: Agente, execução, status e ação somente aparecem quando sustentados por estado real e rastreável.
- [x] **AC2 — Navegação por intenção**: A navegação primária contém `Supervisão`, `Trabalho`, `Conhecimento e Regras` e `Atividade`.
- [x] **AC3 — Contexto global**: Workspace, escopo, saúde e decisões pendentes ficam acessíveis no cabeçalho.
- [x] **AC4 — Supervisão acionável**: A entrada padrão mostra decisões, bloqueios, atividade real e próxima ação segura.
- [x] **AC5 — Trabalho consolidado**: Fluxo e Quadro compartilham estado canônico e não contornam o harness.
- [x] **AC6 — Base consolidada**: Especificações, contexto, constituição, glossário, decisões, harness e papéis ficam em `Conhecimento e Regras`, respeitando a política de escrita.
- [x] **AC7 — Atividade compreensível**: `Atividade` prioriza acontecimentos e permite aprofundamento técnico, preservando ator, ação, momento, motivo e evidência.
- [x] **AC8 — Decisões visíveis**: Gates ficam em primeiro plano e toda decisão produz efeito persistido e auditável.
- [x] **AC9 — Sem ações inertes**: Todo controle possui efeito observável, retorno de sucesso ou erro e teste do caminho principal.
- [x] **AC10 — Linguagem honesta**: `Execução` e `agente ativo` exigem runs e atores reais; sem eles, são usados `Fluxo`, `papel` ou `responsável`.
- [x] **AC11 — Compreensão validada**: Um usuário localiza decisão, trabalho, regra e evidência sem conhecer termos internos.
- [x] **AC12 — Migração segura**: Dados e links válidos permanecem acessíveis, sem destinos duplicados ao final.

## Context

Implementa o Principle 6 e o Registro de Decisão `product-truth-and-supervision-navigation`. Primeiro corrige a confiança operacional; depois consolida a arquitetura de informação. O detalhamento está em `roadmap.md`.

## Regression Evidence

- **AC2**: 2 testes contratuais direcionados e a suíte completa do cliente com 25 testes foram aprovados; typecheck e build de produção do cliente foram aprovados. `letra validate` concluiu com 2 aprovações, 0 falhas e 528 avisos históricos. A verificação no navegador confirmou os quatro destinos primários, a seleção ativa e a abertura de `Supervisão`, `Trabalho`, `Conhecimento e Regras` e `Atividade`. Destinos técnicos anteriores permanecem como aliases internos temporários para preservar atalhos válidos sem reaparecer na navegação primária. Risco residual: a consolidação do conteúdo interno desses destinos e a migração dos seletores globais permanecem explicitamente cobertas pelos AC3, AC5, AC6 e AC7.
- **AC3**: 6 testes contratuais direcionados e a suíte completa do cliente com 29 testes foram aprovados; typecheck e build de produção do cliente foram aprovados. `letra validate` concluiu com 2 aprovações, 0 falhas e 527 avisos históricos. O MCP shadcn confirmou o registry, o padrão de composição do `Select` e o checklist de auditoria. A verificação no navegador confirmou workspace, escopo, saúde canônica de `/api/health` e decisões pendentes no cabeçalho, ausência de duplicação na sidebar e ausência de overflow em viewport de 375 px. Risco residual: o cabeçalho apresenta o resumo de saúde, mas o aprofundamento e as ações sobre alertas continuam no indicador de diagnósticos existente; a unificação desses conceitos pertence ao redesenho de Supervisão.
- **AC4**: 3 testes contratuais direcionados e a suíte completa do cliente com 32 testes foram aprovados; typecheck e build de produção do cliente foram aprovados. `letra validate` concluiu com 2 aprovações, 0 falhas e 526 avisos históricos. O MCP shadcn forneceu exemplos de `Card` e `Alert` e o checklist final de auditoria. A entrada de Supervisão passou a priorizar gates humanos, alertas críticos de `/api/health`, falhas e eventos reais de `/api/log`, além de uma próxima ação de navegação com consequência explícita e sem mutação. A verificação no navegador confirmou a hierarquia, a abertura de `Atividade` como evidência, a remoção dos quatro cards métricos do primeiro plano e ausência de overflow em 375 px. Risco residual: a atividade resumida é uma fotografia dos quatro eventos mais recentes no carregamento da tela; a timeline completa e seus filtros permanecem em `Atividade`.
- **AC6**: API `/api/harness/roles` atualizada para retornar id, label, description, allowedStages e capabilities. Componente `RolesViewer` criado com 5 papéis (analyst, builder, reviewer, security, pr-bot), badges de stages e lista de capacidades traduzidas. `ContextView` atualizado com nova aba "Papéis" no grupo "Regras de governança", tipo `KnowledgeTab` estendido, lógica de loading e renderização adicionadas. Build do cliente e CLI aprovados. Risco residual: papéis são somente leitura na UI; edição de papéis pertence ao harness editor futuro.
- **AC7**: `AuditLogView` migrado de `LogEntry[]` para `OperationalAuditEvent[]` normalizado. Helper functions simplificadas (de 8 para 5) usando campos `actor`, `status`, `kind`, `subject` diretos. Filtro por ator (Humano/Agente/Sistema/Execução) adicionado usando facets da API. Métricas atualizadas (sucesso/falhas/hoje vs evidência/resultado). Deep-links para Specs adicionados no painel de detalhes. Build do cliente aprovado. Risco residual: componente `ExecutionView` legado mantido mas não visível na navegação principal.
- **AC9**: Componente `ExecutionView` (contendo "Solicitar Alterações" inerte) removido do codebase. Nenhum controle na UI permanece sem efeito observável. Build do cliente aprovado. Risco residual: nenhum.
- **AC11**: Criados `term-translations.ts` (~30 termos) e `action-labels.ts` (~15 ações) como mapas centralizados. SpecsView traduzido (placeholders, tooltips, validação, estados vazios). ItemDetailModal traduzido ("Abrir especificação", "Sem especificação vinculada"). AuditLogView traduzido (action badges, subject labels). HarnessViewer traduzido (L1-L4 layers, loading, error, copy button). KanbanBoard traduzido ("critérios" em vez de "ACs", "Especificação" em vez de "Spec"). Build do cliente aprovado. Risco residual: SidePanel e AgentDetail mantêm textos em inglês por serem componentes legados não visíveis.
- **AC12**: Componentes legados removidos: `NavTabs` (substituído por Sidebar), `DashboardView` (substituído por HomeView), `ExecutionView` (legado, não utilizado). Teste de acessibilidade atualizado para remover dependência de NavTabs. App.tsx não possui rotas duplicadas — navegação é 100% client-side via tab state. Build do cliente aprovado. Risco residual: nenhum — não havia destinos duplicados ou links quebrados.
