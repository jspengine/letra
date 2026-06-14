# Product reflection: Letra product-market fit

**Date**: 2026-06-08
**Status**: draft

## Context

Letra começou como um framework de Specification-Driven Development (SDD) — um formato `.letra/` para capturar direção, intenção e contexto. Evoluiu para incluir CLI de fluxo de trabalho (backlog, stages, kanban, tasks) e agora estamos considerando um Flow Designer visual.

Antes de continuar evoluindo, precisamos responder perguntas fundamentais:

1. **Quem é o usuário?** Não-devs? Devs? Times? Empresas?
2. **Qual a dor real?** Falta de rastreabilidade entre spec e código? Dificuldade de onboarding de agentes? Ausência de ferramentas leves de workflow?
3. **Letra resolve um problema real ou cria um?** Estamos adicionando complexidade que o usuário não pediu?
4. **Qual o mínimo que valida a tese?** Qual o menor produto que alguém pagaria (tempo/dinheiro) para usar?
5. **Concorrência indireta:** ADRs, Notion, Linear, Jira, GitHub Projects — cada um resolve um pedaço. Onde Letra é único?
6. **Risco de escopo infinito:** Workflow, kanban, designer visual, skills engine, marketplace — onde paramos?

## Signal from the field (Jun 2026)

Observação direta de um time multinacional usando Letra em cenário real:

**O problema observado:**
- Times têm **múltiplos harnesses de IA** (Cursor, Kiro, Codex, OpenCode) — cada dev usa o seu
- Cada dev tem **seu próprio fluxo de desenvolvimento** — A codifica e testa, B especifica e codifica, sem padrão de time
- **Vibe coding sem processo** é comum, especialmente entre não-devs usando ferramentas de IA
- Quem tenta seguir processo **não consegue acompanhar o estado real das atividades**
- **Retrabalho massivo e gasto desnecessário de tokens LLM** — harness mal configurado ou sem insumo suficiente de contexto

**O gargalo real:**
- Mesmo com chat, as pessoas **não sabem fazer as perguntas certas** para acompanhar o estado do trabalho
- Também **não têm visão geral** do progresso
- O maior problema de entrega é **juntar trabalhos individuais** (cada um com seu processo/ferramenta) em **uma entrega coesa de time**
- A UX visual não é "enfeite" — é o que **mostra o que queremos ver mas não sabemos perguntar**, ou não queremos seguir um fluxo padronizado e organizado

**Tese validada:**
Letra resolve um problema real **se** atacar:
- **Padronização sem rigidez** — cada dev mantém sua ferramenta, mas o processo/contexto é compartilhado via `.letra/`
- **Visão de estado visual** — kanban/flow como camada de entendimento compartilhado, não só de organização
- **Redução de retrabalho e tokens** — contexto estruturado reduz LLM waste
- **Unificação de times multi-ferramenta** — o `.letra/` como fonte única de verdade independente do harness

## Hypothesis

Letra é valioso **se**:
- Times de produto/engenharia gastam tempo mantendo docs que ninguém lê
- Agentes de código precisam de contexto estruturado que não está no repositório
- O custo de setup de workflow (Jira/Linear) é proibitivo para projetos pequenos/médios
- **(validado)** Times multi-ferramenta (Cursor, Kiro, Codex, OpenCode) não têm padrão de processo e sofrem com retrabalho e tokens desperdiçados

## Anti-hypothesis (por que pode não valer a pena)

- "Só mais um formato" — times já têm muitos formatos (markdown, ADRs, README)
- "Ferramenta para um problema que não existe" — devs não sentem falta de spec SDD
- "Over-engineered" — o que começa simples vira complexo rápido (como estamos vendo)
- "Ninguém quer mais uma CLI" — o mercado está saturado
- **(risco real)** UX visual é crítica e fazer bem é caro — meia-entrega não resolve

## Insights for direction

1. **Letra não compete com Jira/Linear** — compete com "não ter processo nenhum"
2. **O `.letra/` é o barramento** — o harness enxerga o contexto independente de quem/what gerou
3. **Visual-first para consumo, CLI-first para automação** — devs usam CLI, não-devs/noobs usam UI, ambos compartilham o mesmo estado
4. **O maior valor imediato pode ser "mostrar o estado do time"** mais do que "definir o processo ideal"
5. **Métrica principal: redução de retrabalho/tokens desperdiçados** — não quantidade de specs criadas

## Questions to resolve

- [ ] Validar com 3-5 potenciais usuários reais (fora de nós mesmos)
- [ ] Definir qual o *job-to-be-done* primário
- [ ] Decidir: CLI pura, CLI + visual, ou visual-first?
- [ ] Qual o estágio ideal do produto hoje (v0.3.0) — feature complete ou focused?
- [ ] Devemos considerar pivot ou kill antes de evoluir?
- [ ] **(novo)** UX visual do flow é feature ou é o produto? Se for o produto, precisamos de designer
- [ ] **(novo)** Devs aceitariam adotar `.letra/` se o benefício imediato for "menos retrabalho e tokens"?

## Next steps

1. Escrever mini product brief com JTBD primário
2. Identificar 3-5 pessoas para entrevista de discovery
3. Decidir entre Keep / Pivot / Kill antes do v0.4.0
