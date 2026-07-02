# Spec: diagnostics-ui

> Updated: 2026-06-22

## Outcome

O usuário nunca vê um alerta de diagnóstico a menos que haja algo ambíguo ou que ele explicitamente queira revisar. Quando tudo está bem, a UI não muda. Quando há sugestões, um badge discreto aparece no header. Quando há correções automáticas, o usuário só descobre se abrir o histórico. O undo está sempre a 2 cliques de distância.

## Constraints

- Zero output visual quando não há sugestões pendentes — silêncio é sucesso
- Badge no header deve ser discreto (ponto amarelo de 8px, sem texto)
- Undo não pede confirmação — executa na hora e mostra toast de sucesso
- Para cada auto-correção, o histórico mostra: o que mudou, quais arquivos, botão "Desfazer"
- O histórico de correções vive em Settings (engrenagem no header), não polui as abas principais

## Exclusions

- Diagnóstico como aba principal (Home, Specs, Flow, Context, Settings) — settings é suficiente
- Notificações desktop ou sonoras
- Modo "não perturbe" para desligar diagnósticos — a engine continua rodando, só a UI some
- Página dedicada de diagnóstico completo — o histórico cobre

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

## Context

A filosofia central: **o usuário não é o sysadmin da ferramenta.** Se o Letra pode corrigir sozinho, ele corrige e avisa depois (mas sem interromper). Se a correção é ambígua, ele sugere com 1 clique. O undo está sempre disponível mas nunca é imposto. Isso contrasta com ferramentas que mostram 47 warnings no terminal e pedem decisão do usuário — esse não é o contrato do Letra com o usuário.
