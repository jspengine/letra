# Mockup Kanban Board - Propostas de Melhoria

## Estado Atual

```
╔══════════════════════════════════════════════════════════════════════════╗
║  MENU ADMIN                    BUSCA                                    ║
║  [Ocultar]                 [___________________________]                ║
╠══════════════════════════════════════════════════════════════════════════╣
║                                                                          ║
║  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐         ║
║  │ BACKLOG │  │ TODO    │  │ REVIEW  │  │ DONE    │  │ CLOSED  │         ║
║  │ [Item1] │  │ [Item2] │  │ [Item6] │  │ [Item8] │  │ [Item13]│         ║
║  │ [Item3] │  │ [Item4] │  │         │  │ [Item9] │  │         │         ║
║  └─────────┘  └─────────┘  └─────────┘  └─────────┘  └─────────┘         ║
║                                                                          ║
║  ┌─────────┐                                                          ║
║  │ OBServações                                                         ║
║  │ [Conteúdo...]                                                      ║
║  └─────────┘                                                          ║
╚══════════════════════════════════════════════════════════════════════════╝
```

## Proposta Melhorada

```
╔══════════════════════════════════════════════════════════════════════════╗
║                                                                          ║
║  ┌───────────────────────┐  ┌─────────────────────────────────────────┐ ║
║  │  MENU ADMIN (OCULTO)  │  │ BUSCA                                 │ ║
║  │  [Mostrar]            │  │  [___________________________]        │ ║
║  └───────────────────────┘  └─────────────────────────────────────────┘ ║
║                                                                          ║
╠══════════════════════════════════════════════════════════════════════════╣
║                                                                          ║
║  VISUALIZAÇÃO DO KANBAN (sem configuração de esteira separate)        ║
║                                                                          ║
║  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐         ║
║  │ BACKLOG │  │ TODO    │  │ REVIEW  │  │ DONE    │  │ CLOSED  │         ║
║  │ 5 itens │  │ 3 itens │  │ ⚠️ 2    │  │ ✅ 7    │  │ 1 item  │         ║
║  │         │  │         │  │        │  │        │  │         │         ║
║  │ [Item1] │  │ [Item2] │  │[Item6]  │  │[Item8]  │  │[Item13] │         ║
║  │ [Item3] │  │ [Item4] │  │[Item7]  │  │[Item9]  │  │         │         ║
║  │         │  │ [Item5] │  │  ○ Gate │  │[Item10] │  │         │         ║
║  │         │  │         │  │  [Item6]│  │[Item11] │  │         │         ║
║  │         │  │         │  │  [Item7]│  │[Item12] │  │         │         ║
║  └─────────┘  └─────────┘  └─────────┘  └─────────┘  └─────────┘         ║
║        │         │          │          │          │                      ║
║        ▼         ▼          ▼          ▼          ▼                      ║
║  ┌────┬─────────┬─┴────┬───┴────┬───┴────┬───┴────┐                      ║
║  │ ℹ️ │ STATUS  │ ℹ️ │ STATUS │ ℹ️ │ STATUS │...   │                      ║
║  │INFO│         │INFO│        │INFO│        │      │                      ║
║  │    │         │    │        │    │        │      │                      ║
║  └────┴─────────┴─┴────┴───┴────┴───┴────┴───────┘                      ║
║                          │                                                  ║
║                          ▼                                                  ║
║                   ┌────────────────────┐                                    ║
║                   │ POPUP STATUS COL   │                                    ║
║                   │ Nome: Design       │                                    ║
║                   │ Tipo: Processo     │                                    ║
║                   │ Cor: #3b82f6       │                                    ║
║                   │ Itens: 3           │                                    ║
║                   │ Status: Ativo      │                                    ║
║                   │                    │                                    ║
║                   │ Ativa: Analyst     │                                    ║
║                   │ Capabilities:      │                                    ║
║                   │  • read_code       │                                    ║
║                   │  • write_spec      │                                    ║
║                   │  • generate_doc    │                                    ║
║                   │                    │                                    ║
║                   │ Executor: opencode │                                    ║
║                   │                    │                                    ║
║                   │ Fases:             │                                    ║
║                   │  Analyze → define  │                                    ║
║                   │  Define ACs → handoff│                                  ║
║                   │                    │                                    ║
║                   │ [Fechar]           │                                    ║
║                   └────────────────────┘                                    ║
║                                                                          ║
╠══════════════════════════════════════════════════════════════════════════╣
║                                                                          ║
║  ┌─────────────────────────────────────────────────────────────────────┐ ║
║  │  🎯 Métricas Estratégicas (cards de progresso úteis)               │ ║
║  ├─────────────────────────────────────────────────────────────────────┤ ║
║  │                                                                     │ ║
║  │  ▶ Velocidade (Velocity)          ████████░░ 80% (4/5 dias úteis)  │ ║
║  │  ▶ Lead Time (Tempo no Sistema)   ▇▇▇▇▇ 2.3 dias média          │ ║
║  │  ▶ Taxa de Conversão              ▇▇▇▇▇▇▇▇▇▇ 85% (17/20 itens)      │ ║
║  │  ▶ Block Rate (Itens Bloqueados)  ▇▇ 20% (2/10 itens)            │ ║
║  │  ▶ Risco (Risco Prioritário)      ██████░░░░░░░░░░ 45% média     │ ║
║  │                                                                     │ ║
║  │  [Ver detalhes] [Exportar]                                        │ ║
║  └─────────────────────────────────────────────────────────────────────┘ ║
║                                                                          ║
╠══════════════════════════════════════════════════════════════════════════╣
║                                                                          ║
║  ┌─────────────────────────────────────────────────────────────────────┐ ║
║  │  🔍 Filtros (sem cards de contagem redundantes)                    │ ║
║  ├─────────────────────────────────────────────────────────────────────┤ ║
║  │  [Todos] [Aguardando] [Em andamento] [Bloqueado] [Concluído]        │ ║
║  │          ▼                                                        │ ║
║  │  ┌───────────────────────────────────────────────────────────────┐  │ ║
║  │  │  Filtro avançado: Salvar filtro como vista personalizada     │  │ ║
║  │  │                                                              │  │ ║
║  │  │  • "Itens críticos"    → Bloqueados ou com vencimento próximo │  │ ║
║  │  │  • "Alta prioridade"   → Tag: crítico OU urgente              │  │ ║
║  │  │  • "Pendentes revisão" → Stage: READY_FOR_REVIEW              │  │ ║
║  │  │                                                              │  │ ║
║  │  │  [Salvar como] [Cancelar]                                     │  │ ║
║  │  └───────────────────────────────────────────────────────────────┘  │ ║
║  └─────────────────────────────────────────────────────────────────────┘ ║
║                                                                          ║
╠══════════════════════════════════════════════════════════════════════════╣
║                                                                          ║
║  ┌──────────────────────────────────────────────────────────────────┐  ║
║  │  📋 OBSERVAÇÕES (movido para perto do board, colapsável)       │  ║
║  ├──────────────────────────────────────────────────────────────────┤  ║
║  │  [+] Collapsar    (Estado salvo no localStorage)                 │  ║
║  │  ────────────────────────────────────────────────────────────────│  ║
║  │  Comentários sobre itens aparecerão aqui quando selecionados    │  ║
║  │  ou quando houver observações de revisão.                       │  ║
║  │                                                                │  ║
║  │  ⚠️ Últimas observações:                                       │  ║
║  │  - Item-45: "Verificar requisitos de segurança" (2h atrás)     │  ║
║  │  - Item-38: "Ajustar UI conforme mockup v2" (1d atrás)         │  ║
║  └──────────────────────────────────────────────────────────────────┘  ║
║                                                                          ║
╚══════════════════════════════════════════════════════════════════════════╝

╔══════════════════════════════════════════════════════════════════════════╗
║  SCROLL HORIZONTAL ATIVO (quando colunas > largura da tela)            ║
║  ┌──────────────────────────────────────────────────────────────────┐  ║
║  │<──▶ Arraste para ver mais colunas ──▶                         │  ║
║  └──────────────────────────────────────────────────────────────────┘  ║
╚══════════════════════════════════════════════════════════════════════════╝
```

## Mudanças Implementadas

| Item | Antes | Depois |
|------|-------|--------|
| Menu Admin | Visível permanentemente | Pode ser ocultado/movido |
| Configuração de esteira | Seção separada | Integrada no header da coluna |
| Próximo trabalho | Seção visível | **REMOVIDO** - sem valor |
| Cards de contagem | Exibidos como badges | Informação já nos headers |
| Métricas | Cards de contagem simples | **Novas métricas estratégicas** |
| Filtros | Cards redundantes | **Melhor UX** - filtro avançado |
| Observações | Topo da página | **Movido** para perto do board, colapsável |
| Scroll | Vertical apenas | **Horizontal adicionado** para flows grandes |

## Métricas Propostas

1. **Velocidade (Velocity)** - Itens concluídos por período
2. **Lead Time** - Tempo médio no sistema
3. **Taxa de Conversão** - % de itens sem bloqueios
4. **Block Rate** - % de itens bloqueados
5. **Risk Score** - Predictor de atrasos

## Próximos Passos

- [ ] Validar UX das novas métricas com usuários
- [ ] Implementar popup de status das colunas
- [ ] Adicionar suporte a filtros personalizados
- [ ] Implementar scroll horizontal no board
- [ ] Mover seção de observações para posição final