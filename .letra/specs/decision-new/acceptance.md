# Acceptance Criteria — decision-new

- [x] **Comando `letra decision new <titulo>`**: Cria `.letra/decisions/<slug>.md` com template ADR.
- [x] **Template ADR**: Contém seções Contexto, Decisão, Consequências, Status, Data.
- [x] **Sanitização**: Título vira slug (ex: "Usar Commander ou Yargs" → `usar-commander-ou-yargs.md`).
- [x] **Listagem**: `letra decision list` lista todos ADRs existentes.
- [x] **Data automática**: Preenche data atual no frontmatter do ADR.
