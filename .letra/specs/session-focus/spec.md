# Spec — Session Focus

## Outcome

Usuário roda `letra focus <spec>` e o CLI escreve `.letra/focus.md` com o nome e caminho da spec ativa. O adapter (AGENTS.md, CLAUDE.md, .cursorrules etc.) referencia esse arquivo, fazendo o agente saber exatamente qual spec importa nesta sessão.

## Constraints

- `focus.md` é um arquivo Markdown simples com nome da spec + caminho + resumo do Outcome
- `letra focus` sem argumento mostra a spec em foco atual (se existir)
- `letra focus --clear` remove o arquivo de foco
- Adapters já existentes passam a referenciar `.letra/focus.md` nos templates de init
- Zero dependências externas — só leitura/escrita de arquivo

## Exclusions

- **Não integra com agenda/task list**: Apenas indica *qual spec*, não *o que fazer nela*
- **Sem foco múltiplo**: Apenas uma spec por vez

## Acceptance Criteria

- [ ] **`letra focus <spec>`**: Cria `.letra/focus.md` com nome, caminho e outcome da spec.
- [ ] **`letra focus`**: Exibe o conteúdo do foco atual (ou "Nenhum foco definido").
- [ ] **`letra focus --clear`: Remove `.letra/focus.md`**.
- [ ] **Adapter referencia focus.md**: `AGENTS.md` gerado pelo init inclui referência a `.letra/focus.md`.
- [ ] **Fallback silencioso**: Se `focus.md` não existe, agente comporta-se normalmente (lê todas specs).

## Context

Agentes hoje leem o contexto inteiro do projeto a cada sessão — incluindo specs que não são relevantes para a tarefa atual. Isso desperdiça tokens e dilui a atenção. Um arquivo `focus.md` permite ao agente saber rapidamente "o que importa agora". A ideia é similar a um `@workspace` no OpenCode ou um pinned context no Claude Code, mas implementado de forma genérica — funciona com qualquer adapter, qualquer ferramenta.
