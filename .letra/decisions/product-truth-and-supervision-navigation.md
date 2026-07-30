# Product Truth and Supervision Navigation

**Data:** 2026-07-03
**Status:** Accepted
**Autores:** Product Design e Architecture

## Contexto

A navegação atual reflete objetos internos do produto, como harness, specifications, quadro e pipeline. Essa estrutura exige que o usuário compreenda previamente a implementação do Letra para descobrir o que precisa de atenção.

Também existem superfícies que sugerem capacidades mais amplas do que o estado real sustenta. Papéis são apresentados como agentes, posição de item é apresentada como execução e destinos distintos conduzem à mesma tela. Essa diferença entre promessa e comportamento reduz a confiança operacional.

## Decisão

O Letra será tratado como plano de controle local para desenvolvimento de software assistido por IA. Toda evolução do produto deverá priorizar as perguntas do usuário:

1. O que precisa da minha decisão?
2. O que está acontecendo agora?
3. O que está sendo construído?
4. Sob quais regras o trabalho ocorre?
5. Quais evidências comprovam o que aconteceu?

A arquitetura de informação de referência terá quatro destinos primários:

- **Supervisão**: decisões, bloqueios, atividade atual e saúde.
- **Trabalho**: itens e progressão, com Fluxo e Quadro como visualizações.
- **Conhecimento e Regras**: especificações, contexto, decisões, harness e papéis.
- **Atividade**: acontecimentos humanos e agênticos, evidências e auditoria.

Workspace, escopo ativo, saúde e decisões pendentes serão tratados como contexto global no cabeçalho. Administração de workspaces, adapters e detalhes técnicos permanecerá em superfícies secundárias.

O termo **Execuções** somente será adotado quando houver runs reais, com identidade, estado, eventos, atores, entradas, saídas e evidências persistidas. Até lá, a interface utilizará **Fluxo**.

## Consequências

- Menus e telas duplicados serão consolidados.
- Nomes tecnicamente corretos, mas pouco compreensíveis, serão substituídos por linguagem orientada à intenção.
- Ações sem efeito observável serão tratadas como defeitos prioritários.
- O Quadro deixará de ser o centro conceitual do produto.
- A atividade e as decisões humanas ganharão precedência visual sobre métricas e cards.
- Roadmaps anteriores que presumam autonomia não implementada deverão ser reinterpretados à luz desta decisão.

## Critério de Governança

Uma mudança não será considerada alinhada apenas por utilizar a nova nomenclatura. Ela deverá demonstrar que a informação apresentada é real, rastreável, relevante para uma decisão e coerente com a autoridade do harness.
