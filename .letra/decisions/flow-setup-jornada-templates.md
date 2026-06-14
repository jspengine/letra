# ADR: Jornada de setup do Flow com templates

**Data:** 2026-06-08
**Contexto:** ITEM-13 — Flow Designer, ITEM-14 — SPA React
**Status:** Aceita

## Problema

O setup inicial do Flow (`letra flow init --quick`) gera um workflow.json genérico sem orientação ao usuário. Não-devs (persona crítica) não sabem o que é um stage, uma zona, ou como configurar o fluxo ideal pro seu time. Precisamos de uma jornada guiada que eduque e configure em segundos.

## Decisão

Adotar **jornada de templates** com 3 opções pré-definidas + 1 opção de personalização completa.

### Fluxo

```
letra init → workflow.json padrão → SPA abre na tela de Boas-Vindas
                                        ↓
                          ┌─────────────────────────────┐
                          │  Escolha um template:        │
                          │                              │
                          │  [Padrão] [Kanban] [Ágil]    │
                          │  [Personalizar do zero]      │
                          └─────────────────────────────┘
                                        ↓
               ┌────────────────────────┼────────────────────┐
               ↓                        ↓                    ↓
         Template escolhido       Personalizar          Personalizar
               ↓                        ↓                    ↓
         Salva workflow.json    Step 1: Stages        Step 2: Zonas
               ↓                        ↓                    ↓
         Dashboard pronto        Step 3: Review       Step 3: Review
                                       ↓                    ↓
                                 Salva workflow.json  Salva workflow.json
                                       ↓                    ↓
                                 Dashboard pronto     Dashboard pronto
```

### Templates

| Template | Stages | Quando usar |
|---|---|---|
| **Padrão** | backlog → design → code → review → tests → done | Time dev tradicional |
| **Kanban** | todo → doing → done | Time simples, não-dev |
| **Ágil** | backlog → sprint → review → done | Time com sprints |
| **Personalizar** | (passo a passo) | Nenhum template encaixa |

### Tela de Personalizar (3 steps)

1. **Stages** — editar nome, reordenar, adicionar/remover
2. **Zonas** — cada stage mapeado pra A fazer / Em andamento / Feito (dropdown)
3. **Review** — resumo visual + botão Finalizar

### Regras de UX

- Se escolher template → já cai no dashboard com dados
- Se personalizar → pode voltar steps, preview visível sempre
- Após finalizar setup → dashboard abre com call-to-action "Criar primeiro item"
- Configuração fica acessível depois via ⚙ no header (não é one-shot)

## Alternativas consideradas

| Alternativa | Motivo da rejeição |
|---|---|
| Questionário CLI (perguntas no terminal) | UX pobre para não-devs, sem preview visual |
| Config via JSON manual (editar workflow.json) | Persona não-dev não edita JSON |
| Setup one-shot sem templates | Muito atrito pro usuário comum |
| Apenas templates sem personalizar | Usuário com fluxo específico fica sem opção |

## Consequências

**Positivas:**
- Não-devs configuram sem ajuda técnica
- Templates educam sobre o conceito de stages/zones
- Personalização cobre casos complexos
- Preview visual reduz erros de configuração

**Negativas:**
- 4 fluxos pra implementar e testar
- Manter templates sync com features novas

## Próximos passos

- ITEM-14: SPA React — setup do monorepo + servir assets
- ITEM-18: Implementar tela de Boas-Vindas + templates
- ITEM-19: Implementar wizard de personalização (3 steps)
- ITEM-20: Integrar setup com `letra init` (redirecionar pra web)
