# Spec: Auditoria Operacional

> Updated: 2026-07-02

## Outcome

O usuário consegue compreender, investigar e correlacionar eventos do flow, execuções automatizadas e tarefas manuais em uma visão operacional única, preservando o harness como autoridade e a evidência bruta como registro canônico.

## Context

A auditoria atual apresenta dados incompletos porque a interface e a API utilizam contratos diferentes. A consulta não possui paginação e busca consistentes, ações de domínio são filtradas por nomes incompatíveis e eventos repetitivos de sistema ocultam acontecimentos relevantes. Além disso, o limite destrutivo do histórico reduz a rastreabilidade.

Esta spec consolida `AuditLogView` e `LogSearchView` em uma experiência de Auditoria Operacional, com leitura orientada a quem executou, o que aconteceu, onde ocorreu, qual foi o resultado e por quê.

## Constraints

- O harness permanece como autoridade sobre flow, gates, fases e critérios de aceite.
- A evidência bruta é canônica, append-only e não pode ser alterada ou descartada por agrupamento visual.
- Índices, agregações e modelos de leitura são artefatos derivados e podem ser reconstruídos a partir da evidência canônica.
- O armazenamento derivado, caso adotado, não pode transformar PGlite ou outra base local em fonte de verdade.
- Eventos legados devem continuar legíveis por meio de normalização compatível.
- A interface deve seguir shadcn-first, tokens semânticos e contraste WCAG nos temas light e dark.
- A página deve utilizar a largura disponível com responsividade, hierarquia visual e espaçamento consistentes.
- Ações humanas, de agentes e de automações devem permanecer distinguíveis e rastreáveis.
- Nenhuma automação pode avançar gates humanos silenciosamente.

## Exclusions

- Edição ou exclusão de eventos de auditoria.
- Exportação CSV ou JSON nesta fase.
- Plataforma remota de observabilidade ou telemetria SaaS.
- Substituição dos arquivos canônicos do workspace por banco de dados.
- Redesenho completo do cadastro de agentes, equipes ou permissões.

## Acceptance Criteria

- [x] **AC1 — Contrato unificado**: todo evento exposto pela auditoria possui identificador, timestamp, tipo, ação, ator, origem, status, assunto, resumo, detalhes e, quando aplicável, correlação e motivo.
- [x] **AC2 — Compatibilidade legada**: entradas existentes em `session-log.json` são normalizadas para o contrato unificado sem perda dos campos originais e sem exigir migração destrutiva.
- [x] **AC3 — Preservação append-only**: a escrita não remove eventos antigos ao atingir um limite de memória; retenção, rotação ou arquivamento preservam a evidência e permitem reconstruir a projeção.
- [x] **AC4 — Consulta consistente**: `GET /api/log` aplica busca textual, paginação, período, tipo, ação, ator, origem, status, item e spec, retornando itens, total, página, limite e facetas coerentes.
- [x] **AC5 — Taxonomia alinhada**: filtros e rótulos da interface utilizam a mesma taxonomia de ações do domínio, incluindo flow, critérios de aceite, gates, decisões, validações e execuções.
- [x] **AC6 — Redução de ruído sem perda**: repetições técnicas correlacionadas, como ciclos de watcher, podem ser agrupadas na projeção; o usuário consegue expandir o grupo e acessar todos os eventos brutos.
- [x] **AC7 — Visão operacional**: a página em largura total apresenta indicadores resumidos, filtros, categorias e timeline agrupada por data ou correlação, com estados de carregamento, vazio e erro.
- [x] **AC8 — Leitura explicativa**: cada ocorrência comunica quem executou, o que aconteceu, onde, resultado e motivo; assuntos conhecidos oferecem navegação para item, spec, AC, gate ou execução.
- [x] **AC9 — Investigação detalhada**: a seleção de um evento abre painel acessível com causa, efeito, parâmetros, detalhes brutos, eventos correlacionados e links profundos disponíveis.
- [x] **AC10 — Consolidação e qualidade**: as visões duplicadas são consolidadas sem regressão funcional, com testes de contrato, compatibilidade, busca, paginação, preservação, responsividade, teclado e temas light/dark.

## Success Signals

- Um evento relevante pode ser localizado por texto ou contexto sem inspecionar diretamente arquivos internos.
- Eventos humanos e falhas permanecem visíveis mesmo sob alta frequência de eventos técnicos.
- A API e a interface apresentam a mesma quantidade, taxonomia e semântica para uma consulta equivalente.
- Nenhuma evidência bruta é perdida por paginação, agrupamento ou retenção operacional.
