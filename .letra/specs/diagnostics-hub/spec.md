# Spec: diagnostics-hub

> Updated: 2026-07-25

## Outcome

O supervisor entende a saude operacional do workspace em uma central unica: quais sinais existem, qual impacto eles tem na entrega, por que importam, qual evidencia sustenta cada sinal e qual proxima acao segura pode ser tomada. A experiencia reduz a necessidade de interpretar comandos tecnicos de diagnostico e transforma alertas em decisoes supervisionaveis.

## Product Truth

- A central mostra apenas estado real vindo de `health-record`, diagnosticos persistidos, workflow, specs e log de atividade.
- A UI nao deve sugerir que corrigiu, moveu ou resolveu algo sem uma acao registrada e rastreavel.
- A linguagem prioriza impacto operacional antes de origem tecnica: "bloqueia conclusao", "pede investigacao", "pode aguardar", "descartado" e "resolvido".
- Dados tecnicos continuam acessiveis como evidencia, mas nao sao a primeira camada de leitura.

## Constraints

- Deve reutilizar as APIs existentes de saude e diagnostico (`/api/health`, `/api/health/alerts`, `/api/health/scan`, `/api/health/ack`, `/api/health/dismiss`, `/api/diagnostics` e snapshots quando aplicavel).
- Acoes de Ack, Dismiss e Scan devem ser explicitas, com feedback visivel de sucesso ou erro, sem bloquear navegacao.
- Nenhuma correcao automatica destrutiva ou modificacao de codigo pode ocorrer a partir desta central sem confirmacao humana explicita.
- A interface deve seguir o Design System v2 e usar componentes canonicos de `@letra/ui` ou shadcn.
- A central deve ser consistente em desktop e mobile, mantendo leitura, filtros e detalhes acessiveis.
- Eventos relevantes devem permanecer auditaveis na Atividade/session log.

## Exclusions

- Reescrever o motor de diagnosticos ou criar novos detectores.
- Implementar claim/persona de agentes para assumir itens.
- Criar dashboard analitico de metricas de produto.
- Auto-fix de codigo, specs ou workflow sem confirmacao explicita.
- Substituir a pagina de Atividade; esta central referencia evidencias, mas nao duplica toda a trilha operacional.

## Acceptance Criteria

- [x] **AC1 — Central de saude operacional**: Existe uma superficie principal para os sinais de saude do workspace com resumo de novos, em acompanhamento, resolvidos e descartados.
- [x] **AC2 — Priorizacao por impacto**: Cada sinal e classificado em linguagem de supervisao por impacto e urgencia, evitando depender de termos internos como detector, tipo ou severidade como leitura primaria.
- [x] **AC3 — Linha de sinal padronizada**: A lista usa um padrao reutilizavel do DS para item acionavel, com titulo, impacto, origem resumida, idade, estado e acao primaria sem duplicar status visual.
- [x] **AC4 — Detalhe com evidencia**: Abrir um sinal mostra detalhe em sheet/drawer padronizado, com contexto, evidencia, origem tecnica recolhida, historico e proxima acao segura.
- [x] **AC5 — Acoes supervisionadas**: Ack, Dismiss e Scan usam as APIs existentes, exibem retorno claro, atualizam a lista sem recarregar a pagina e registram evidencia operacional.
- [x] **AC6 — Alertas de drift com diff**: Quando houver snapshot/diff relacionado, o detalhe exibe a comparacao; quando nao houver, mostra fallback honesto com a evidencia disponivel.
- [x] **AC7 — Integracao com header e Supervisao**: Header e Supervisao apontam para a central usando contagem e linguagem de impacto, sem transformar o alerta em ruído tecnico.
- [x] **AC8 — Estados vazios e saudaveis**: A tela comunica com clareza quando nao ha sinais ativos, quando a saude esta indisponivel e quando uma varredura esta em andamento.
- [x] **AC9 — Responsividade e acessibilidade**: A experiencia funciona em mobile e desktop, com foco, teclado, labels acessiveis e sem overflow dos elementos.
- [x] **AC10 — Regressao protegida**: Testes cobrem mapeamento dos dados de health/diagnostics, acoes de Ack/Dismiss/Scan, estados vazios, detalhe do sinal e build do client.

## Context

O Letra ja possui diagnosticos, health-record, endpoints web e alguns sinais no Header/Supervisao. O problema de produto nao e ausencia de dados; e que a leitura ainda tende a parecer tecnica demais para quem esta supervisionando uma entrega. O ITEM-29 deve consolidar esse material em uma central de saude do workspace, com foco em decisao humana, rastreabilidade e proxima acao segura.

## Regression Baseline

- Preservar os contratos existentes de `/api/health`, `/api/health/alerts`, `/api/health/scan`, `/api/health/ack`, `/api/health/dismiss`, `/api/diagnostics` e `/api/diagnostics/snapshots`.
- Preservar a exibicao atual de contagem de alertas no Header enquanto a central evolui.
- Preservar a inbox de Supervisao como entrada principal da experiencia, apenas melhorando o destino e a explicacao dos sinais.
- Rodar `letra validate`, testes relevantes do client/CLI e build antes de concluir ACs.
