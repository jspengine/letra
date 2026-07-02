# ExecutionView & AgentDetail

**Arquivos**: `packages/client/src/components/Execution/ExecutionView.tsx`, `AgentDetail.tsx`
**Propósito**: Visualização da execução de agentes — pipeline de estágios em tempo real.

## Layout (ExecutionView)
- Pipeline vertical de estágios com status
- Cada estágio: agente, status, duração, output
- Agentes com animação de "thinking"
- Botões de ação (rejeitar, aprovar, reiniciar)

## Layout (AgentDetail)
- Cards de agente com informações detalhadas
- Estatísticas: runs, taxa de sucesso, última execução
- Lista de execuções recentes

## Elementos principais
- `AgentThinking` — shimmer animation
- Stage cards com ícone de status
- Botões de ação por gate
- Métricas de agente

## Tokens usados
`--border`, `--error`, `--gate-blocked`, `--gate-waiting`, `--muted`, `--muted-foreground`, `--primary`, `--success`, `--warning`

## Conformidade LDL
- [x] Stage colors seguem semântica (success=green, error=red, running=amber)
- [x] `AgentThinking` animation — alinhado com brand motion (feedback operacional)
- [x] Pipeline visual com nós → estágios → entrega
- [ ] Ícone de estágio usa `Icon` de `@letra/ui` — verificar consistência
- [ ] Raw `<button>` nos botões de ação — migrar
- [ ] AgentDetail com dados mockados — sem spec de API real
