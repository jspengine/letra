## Acceptance Criteria

- [x] **Badge oculto por padrão**: Sem sugestões, sem badge — header idêntico ao de hoje
- [x] **Badge aparece com sugestões**: Quando GET /api/diagnostics retorna `suggestions.length > 0`, badge âmbar aparece no header
- [x] **Dropdown ao clicar no badge**: Mostra lista de sugestões com título, descrição e botão de ação (ex: "Mover para done")
- [x] **Ação de sugestão**: Clicar no botão executa a ação via POST /api/diagnostics/scan e fecha o dropdown
- [x] **Badge some após ação**: Se após a ação não há mais sugestões, badge desaparece sem animação
- [x] **Link "Ver histórico"** no dropdown leva ao Settings > Histórico de Correções
- [x] **Histórico de correções**: Lista todas as auto-correções e sugestões aceitas, agrupadas por data, com timestamp, descrição, arquivos afetados, e botão "Desfazer"
- [x] **Undo com toast**: Clicar "Desfazer" restaura o snapshot via POST /api/diagnostics/undo/:id e exibe toast "Correção desfeita" com botão "Refazer"
- [x] **Refazer**: O toast de undo inclui botão "Refazer" que reaplica a correção (dura 10s, depois some)
- [x] **Snapshot inválido no histórico**: Se snapshot foi limpo pelo TTL, exibe "Expirou" em vez de botão "Desfazer"
- [x] **Live updates via SSE**: Quando SSE recebe `diagnostics-updated`, badge/dropdown/histórico atualizam sem refresh da página
