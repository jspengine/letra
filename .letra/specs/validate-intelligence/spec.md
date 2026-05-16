# Spec — Validate Intelligence

## Outcome

O `letra validate` detecta drift semântico entre specs, alertando quando o conteúdo gerado não corresponde à intenção declarada na **Thin Spec**. Funciona como um **Validation Gate** adicional ao CI, seguindo as regras da **Constitution** do projeto.

## Constraints

- Não usar LLMs externos; análise heurística local primeiro.
- Detectar inconsistências de tom, vocabulário e estrutura.
- Não bloquear o CI por falsos positivos.

## Exclusions

- **Não é um linter de texto**: Foco em semântica da spec, não gramática.
- **Sem análise de código**: Só analisa specs `.md` e arquivos de adapter.

## Acceptance Criteria

- [x] **Verificação de Conteúdo Mínimo**: Specs com menos de 50 caracteres em Outcome são marcadas como FAIL.
- [x] **Consistência de Terminologia**: Se o glossary define um termo, a spec deve usá-lo.
- [x] **Detecção de Tom**: Specs marcadas como "formal" não devem conter gírias ou coloquialismos.
- [x] **Drift Temporal**: Alertar se a spec tem mais de 30 dias sem atualização.

## Context

Atualmente o validate só checa se arquivos existem. Para ser um produto SDD real, ele precisa validar se o conteúdo faz sentido. Começaremos com heurísticas simples antes de introduzir análise por IA. Este modelo é **Spec-Anchored** pois a spec vive junto com o código. O **Dogfood** é essencial: usamos o próprio `letra validate` para desenvolver o Letra. Em setups **Control Plane**, esta validação escala para múltiplos repos.
