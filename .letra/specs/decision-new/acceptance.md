# Acceptance Criteria — decision-new

- [ ] **Comando `letra decision new <titulo>`**: Cria `.letra/decisions/<slug>.md` com template ADR.
- [ ] **Template ADR**: Contém seções Contexto, Decisão, Consequências, Status, Data.
- [ ] **Sanitização**: Título vira slug (ex: "Usar Commander ou Yargs" → `usar-commander-ou-yargs.md`).
- [ ] **Listagem**: `letra decision list` lista todos ADRs existentes.
- [ ] **Data automática**: Preenche data atual no frontmatter do ADR.
