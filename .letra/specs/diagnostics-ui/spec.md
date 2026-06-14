# Spec: Diagnostics UI

> Updated: 2026-06-14

## Outcome

O usuário nunca vê um alerta de diagnóstico a menos que haja algo ambíguo ou que ele explicitamente queira revisar. Quando tudo está bem, a UI não muda. Quando há sugestões, um badge discreto aparece no header. Quando há correções automáticas, o usuário só descobre se abrir o histórico. O undo está sempre a 2 cliques de distância.

## Constraints

- Zero output visual quando não há sugestões pendentes — silêncio é sucesso
- Badge no header deve ser discreto (ponto amarelo de 8px, sem texto)
- Undo não pede confirmação — executa na hora e mostra toast de sucesso
- Para cada auto-correção, o histórico mostra: o que mudou, quais arquivos, botão "Desfazer"
- O histórico de correções vive em Settings (engrenagem no header), não polui as abas principais

## Visual Design

### Badge (apenas quando há sugestões)

```
[Header] Letra • meu-projeto  ⚙  🟡
                                  ┌──── sugestões ────┐
                                  │ ITEM-19 pronto     │
                                  │  pra "done"?       │
                                  │ [✓ Mover]          │
                                  │                    │
                                  │ Ver histórico →    │
                                  └────────────────────┘
```

O badge 🟡 é um `span` de 8px, `border-radius: 9999px`, cor `--warning` (âmbar). Clicar abre o dropdown de sugestões. O dropdown é uma lista fina de ações de 1 clique.

### Histórico (via Settings)

```
Settings > Histórico de Correções

Hoje às 14:32
  ├ 📁 .letra/templates/ — diretório criado (auto)
  │  [Desfazer]
  ├ 📝 flow-mvp/spec.md — AC "flow visualize" [ ] → [x] (auto)
  │  [Desfazer]
  └ 📦 ITEM-19 — movido de "review" para "done" (sugestão aceita)
     [Desfazer]

Ontem
  └ 🎨 icon.tsx — ícone "check-circle" adicionado (auto)
     [Desfazer]
```

## Acceptance Criteria

- [ ] **Badge oculto por padrão**: Sem sugestões, sem badge — header idêntico ao de hoje
- [ ] **Badge aparece com sugestões**: Quando GET /api/diagnostics retorna `suggestions.length > 0`, badge âmbar aparece no header
- [ ] **Dropdown ao clicar no badge**: Mostra lista de sugestões com título, descrição e botão de ação (ex: "Mover para done")
- [ ] **Ação de sugestão**: Clicar no botão executa a ação via POST /api/diagnostics/undo/... ou POST /api/workflow (dependendo do tipo) e fecha o dropdown
- [ ] **Badge some após ação**: Se após a ação não há mais sugestões, badge desaparece sem animação
- [ ] **Link "Ver histórico"** no dropdown leva ao Settings > Histórico de Correções
- [ ] **Histórico de correções**: Lista todas as auto-correções e sugestões aceitas, agrupadas por data, com timestamp, descrição, arquivos afetados, e botão "Desfazer"
- [ ] **Undo com toast**: Clicar "Desfazer" restaura o snapshot via POST /api/diagnostics/undo/:id e exibe toast "Correção desfeita" com botão "Refazer"
- [ ] **Refazer**: O toast de undo inclui botão "Refazer" que reaplica a correção (dura 10s, depois some)
- [ ] **Snapshot inválido no histórico**: Se snapshot foi limpo pelo TTL de 30 dias, exibe "Expirou" em vez de botão "Desfazer"
- [ ] **Live updates via SSE**: Quando SSE recebe `diagnostics-updated`, badge/dropdown/histórico atualizam sem refresh da página

## Exclusions

- Diagnóstico como aba principal (Home, Specs, Flow, Context, Settings) — settings é suficiente
- Notificações desktop ou sonoras
- Modo "não perturbe" para desligar diagnósticos — a engine continua rodando, só a UI some
- Página dedicada de diagnóstico completo — o histórico cobre

## Context

A filosofia central: **o usuário não é o sysadmin da ferramenta.** Se o Letra pode corrigir sozinho, ele corrige e avisa depois (mas sem interromper). Se a correção é ambígua, ele sugere com 1 clique. O undo está sempre disponível mas nunca é imposto. Isso contrasta com ferramentas que mostram 47 warnings no terminal e pedem decisão do usuário — esse não é o contrato do Letra com o usuário.
