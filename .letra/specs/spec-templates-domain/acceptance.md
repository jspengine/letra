# Acceptance Criteria — spec-templates-domain

- [ ] **Flag --template**: `letra spec new <nome> --template web-api` usa template específico.
- [ ] **3 Built-ins**: `web-api`, `cli-tool`, `mobile-feature` disponíveis por padrão.
- [ ] **Templates Customizados**: Arquivos `.md` em `.letra/templates/` aparecem como opções.
- [ ] **Default Template**: Sem `--template`, usa o template `_default` (comportamento atual).
- [ ] **Placeholders**: Template pode conter `{{name}}` que é substituído pelo nome da spec.
