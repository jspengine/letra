item: ITEM-100
updated: 2026-09-27
status: ready
spec: kanban-refactor-ui
version: 0.2.0
acCount: 16
acResolved: 0

# Kanban UI Refactor - Propostas de Melhoria

## Objetivo
Refatorar a interface do Kanban Board para melhorar experiência do usuário, corrigir problemas de layout e adicionar funcionalidades de busca e configuração.

## Problemas Atuais Identificados

1. **Overflow do container principal** - `overflow-x-auto` e `min-w-max` causam elementos "vazarem" visualmente
2. **Hardcoded actors** - `human:cli` em múltiplos comandos
3. **Busca textual inexistente** - não há filtro de texto para items
4. **Popup de informações limitado** - não mostra configuração completa do estágio (roles, executors, fases, transições)
5. **Cards de métricas redundantes** - informações duplicadas nos headers
6. **Filtros com UI confusa** - cards de contagem redundantes

## Mudanças Propostas

### AC-1: Corrigir overflow do KanbanBoard
- [ ] Remover `overflow-x-auto` do container principal
- [ ] Substituir `min-w-max` por `min-w-0`
- [ ] Garantir que botões de gate fiquem dentro dos cards

### AC-2: Implementar busca textual
- [ ] Adicionar campo de busca no header
- [ ] Filtrar items por ID, descrição, tags
- [ ] Mostrar contador de resultados
- [ ] Limpar busca com botão

### AC-3: Popup de informações do estágio
- [ ] Botão ℹ️ no header de cada coluna
- [ ] Mostrar nome do estágio
- [ ] Exibir papéis ativos com capabilities
- [ ] Exibir executor preferido
- [ ] Mostrar fases e transições do workflow
- [ ] Mostrar descrição do estágio

### AC-4: Remover elementos redundantes
- [ ] Remover cards de contagem dos filtros
- [ ] Remover cards de métricas simples (já informados nos headers)
- [ ] Remover seção "Próximo trabalho"

### AC-5: Melhorar filtros
- [ ] Implementar filtro avançado como dropdown
- [ ] Permitir salvar filtros como views personalizadas
- [ ] Traduzir filtros para português: Todos, Aguardando, Em andamento, Bloqueado, Concluído

### AC-6: Redesign do painel de observações
- [ ] Mover para perto do Kanban
- [ ] Tornar colapsável por padrão
- [ ] Persistir estado no localStorage

### AC-7: Scroll horizontal
- [ ] Implementar scroll horizontal quando colunas > largura da tela
- [ ] Adicionar indicador visual de scroll disponível
- [ ] Políticas: arrastar, seta, rolagem automática

### AC-8: Busca de texto para items
- [ ] Campo de busca ativo (não somente header)
- [ ] Busca por ID, descrição, specs
- [ ] Destacar resultados na interface

### AC-9: Métricas estratégicas
- [ ] Substituir cards de contagem por cards de progresso
- [ ] Adicionar: Velocidade, Lead Time, Taxa de conversão
- [ ] Adicionar: Block Rate, Risk Score
- [ ] Botões de detalhes e exportação

### AC-10: Performance
- [ ] Virtualização de cards para listas grandes
- [ ] Lazy loading de stage info
- [ ] Cache de direção do agente

### AC-11: Acessibilidade
- [ ] Manter `role="group"` nos cards
- [ ] Tab navigation entre colunas
- [ ] Aria-labels em botões de gate

### AC-12: Estado
- [ ] Persistir posição de observações
- [ ] Salvar preferências de filtro
- [ ] Restaurar estado entre sessões

## Critérios de Aceitação Detalhados

### AC-13: Hardcoded Actors Removidos
- [ ] `flow.ts` usa `resolveLocalIdentity()` dinamicamente
- [ ] `flow-handoff.ts` resolve identity localmente
- [ ] `operation.ts` tem import de `resolveLocalIdentity`

### AC-14: Layout do Kanban
- [ ] Cards não saem do container visual
- [ ] Botões Aprovar/Solicitar/Rejeitar dentro dos cards
- [ ] Scroll horizontal funcional

### AC-15: Busca Textual
- [ ] Campo busca no header superior direito
- [ ] Filtra itens em tempo real
- [ ] Suporta pesquisa por ID e texto

### AC-16: Popup de Informações
- [ ] Informações são de configuração do workflow.json
- [ ] Mostra roles, capabilities, executor, phases, transitions

## Fluxos

```
User opens column -> Clicks ℹ️ button -> Modal opens with stage info
User types in search -> Items filtered in real-time
User scrolls horizontally -> Can see all columns in wide workflow
```

## Considerações Técnicas

- Usar `resolveAgentDirection` para informações do estágio
- Manter compatibilidade com workflow versions
- Usar portal para modais
- State management: useState/localStorage

## Conexões com outros specs

- ITEM-97 (External executor protocol)
- visual-workflow-versioning-editor

## Riscos

- Mudanças de layout podem quebrar existência
- Botões de gate podem precisar de ajustes de z-index
- Performance com muitos items filtrados

## Definições de Terms

- **Stage**: Uma etapa no workflow que pode ter itens
- **Gate**: Ponto de decisão (automático ou humano)
- **Role**: Papel no workflow com capabilities específicas
- **Executor**: Agente/ferramenta que executa operações
- **Phase**: Etapa dentro de um stage com transições definidas