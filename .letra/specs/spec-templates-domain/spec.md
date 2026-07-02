# Spec: spec-templates-domain

> Updated: 2026-06-22

## Outcome

`letra spec new <nome> --template web-api` gera uma spec pré-preenchida com ACs típicos daquele domínio (ex: web API já vem com "CRUD implementado", "autenticação", "rate limiting"), reduzindo o trabalho de escrever specs do zero.

## Constraints

- Templates em `.letra/templates/` como arquivos Markdown simples
- Usuário pode criar templates customizados na mesma pasta
- Template `_default` é usado quando `--template` não é especificado
- Mínimo 3 templates built-in: `web-api`, `cli-tool`, `mobile-feature`

## Exclusions

- **Sem validação de template**: Qualquer `.md` em `.letra/templates/` é aceito
- **Sem parser de variáveis**: Placeholders são substituídos por regex simples, sem template engine

## Acceptance Criteria

- [x] **Flag --template**: `letra spec new <nome> --template web-api` usa template específico.
- [x] **3 Built-ins**: `web-api`, `cli-tool`, `mobile-feature` disponíveis por padrão.
- [x] **Templates Customizados**: Arquivos `.md` em `.letra/templates/` aparecem como opções.
- [x] **Default Template**: Sem `--template`, usa o template `_default` (comportamento atual).
- [x] **Placeholders**: Template pode conter `{{name}}` que é substituído pelo nome da spec.

## Context

Escrever uma spec do zero toda vez é custoso. Um template de web API já vem com: "Endpoint GET /resource retorna 200 com lista", "POST /resource retorna 201 com resource criado", "Autenticação via Bearer token". O usuário só remove o que não precisa e ajusta detalhes. Isso reduz drasticamente a barreira pra não-devs e acelera devs experientes.
