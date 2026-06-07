# Spec: flow export/import

## Outcome
Usuário exporta o workflow atual para stdout (compartilhar, versionar, migrar) e importa workflows de arquivos externos como versão nova.

## Constraints
- `flow export` imprime o workflow.json atual no stdout formatado
- `flow export --pretty` (default) vs `flow export --minified` para piping
- `flow import <file>` lê um arquivo .json e salva como nova versão copiando o atual para `.letra/workflow.v1.0.0.json` (backup)
- Import valida estrutura mínima (stages, name) antes de salvar
- Workflow atual é preservado como backup versionado

## Exclusions
- Import de formatos não-JSON (YAML, TOML, etc.)
- Merge automático entre workflows diferentes
- Validação de compatibilidade entre versões

## Acceptance Criteria
- [ ] `letra flow export` imprime JSON formatado no stdout
- [ ] `letra flow export --minified` imprime JSON sem indentação
- [ ] `letra flow import workflow.json` importa e cria backup
- [ ] Backup salvo como `.letra/workflow.v1.0.0.json`
- [ ] Import valida estrutura (rejeita JSON inválido ou sem stages)
- [ ] Testado localmente antes do PR

## Context
Feature P1 do Flow MVP. Portabilidade do workflow entre projetos.
