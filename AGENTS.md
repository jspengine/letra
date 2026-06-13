# Gerado por letra flow move. Nao edite manualmente.
# Letra Context — Letra Spec Driven

## Workflow

**Estagio atual:** Done

### Itens neste estagio

- ITEM-1: Branding: header Letra no flow serve + 3 opções de logo
- ITEM-7: Automações leves — notificar Slack/Webhook ao mover itens entre estágios
- ITEM-9: Web UI — letra flow ui para não-devs
- ITEM-12: Modelo de dados resiliente — workflow.json como registro central com specs{}, tasks[], vínculo spec↔item por ID estável, desacoplado do filesystem. Documento: .letra/docs/conceitos-e-arquitetura.md
- ITEM-13: Flow Designer — evoluir flow serve de kanban para ferramenta visual de design de fluxo de trabalho: configurar stages (allow, validate), drag & drop, tasks, vínculo visual de specs. Repensar UX e system design. Avaliar product-market fit.
- ITEM-14: SPA React — setup monorepo packages/cli + packages/client, Vite build, servir assets estáticos via flow serve, migrar roteamento REST
- ITEM-15: Flow Setup — implementar tela de Boas-Vindas com seleção de templates (Padrão, Kanban, Ágil, Personalizar)
- ITEM-16: Flow Setup — implementar wizard de personalização (3 steps: Stages, Zonas, Review)
- ITEM-17: Flow Setup — integrar setup com letra init (abrir web UI após init)
- ITEM-18: Design System — setup shadcn/ui + Tailwind + theme toggle dark/light
- ITEM-19: Design System — migrar componentes existentes para shadcn/ui
- ITEM-20: UX Redesign — shell de navegação com 4 abas (Home, Specs, Flow, Context) + Header simplificado + NavTabs
- ITEM-21: UX Redesign — Home health check: métricas (specs, items, stale), breakdown por zona, specs recentes
- ITEM-22: Flow Hub Redesign — kanban único, detail panel header+Markdown, cards enriquecidos, remover toggle Pipe/Kanban
- ITEM-23: UX Redesign — Specs view com CRUD visual: criar/editar specs, marcar ACs, busca e filtros
- ITEM-24: UX Redesign — Context view com tabs (context.md, constitution.md, glossary.md, decisões)
- ITEM-26: UX Redesign — Home rica: drift detection, foco atual, pipeline visual, decisões recentes, métricas avançadas

### Regras

- Leia as specs em .letra/specs/ antes de codificar
- Execute `letra validate` para verificar acceptance criteria
- Siga a constitution.md rigorosamente
- Ao concluir, mova o item com `letra flow move <id> --to <proximo_estagio>`
