# Acceptance Criteria — Auditoria Operacional

- [ ] **AC1 — Contrato unificado**: todo evento exposto pela auditoria possui identificador, timestamp, tipo, ação, ator, origem, status, assunto, resumo, detalhes e, quando aplicável, correlação e motivo.
- [ ] **AC2 — Compatibilidade legada**: entradas existentes em `session-log.json` são normalizadas para o contrato unificado sem perda dos campos originais e sem exigir migração destrutiva.
- [ ] **AC3 — Preservação append-only**: a escrita não remove eventos antigos ao atingir um limite de memória; retenção, rotação ou arquivamento preservam a evidência e permitem reconstruir a projeção.
- [ ] **AC4 — Consulta consistente**: `GET /api/log` aplica busca textual, paginação, período, tipo, ação, ator, origem, status, item e spec, retornando itens, total, página, limite e facetas coerentes.
- [ ] **AC5 — Taxonomia alinhada**: filtros e rótulos da interface utilizam a mesma taxonomia de ações do domínio, incluindo flow, critérios de aceite, gates, decisões, validações e execuções.
- [ ] **AC6 — Redução de ruído sem perda**: repetições técnicas correlacionadas, como ciclos de watcher, podem ser agrupadas na projeção; o usuário consegue expandir o grupo e acessar todos os eventos brutos.
- [ ] **AC7 — Visão operacional**: a página em largura total apresenta indicadores resumidos, filtros, categorias e timeline agrupada por data ou correlação, com estados de carregamento, vazio e erro.
- [ ] **AC8 — Leitura explicativa**: cada ocorrência comunica quem executou, o que aconteceu, onde, resultado e motivo; assuntos conhecidos oferecem navegação para item, spec, AC, gate ou execução.
- [ ] **AC9 — Investigação detalhada**: a seleção de um evento abre painel acessível com causa, efeito, parâmetros, detalhes brutos, eventos correlacionados e links profundos disponíveis.
- [ ] **AC10 — Consolidação e qualidade**: as visões duplicadas são consolidadas sem regressão funcional, com testes de contrato, compatibilidade, busca, paginação, preservação, responsividade, teclado e temas light/dark.
