# Spec: validate-conflict

> Updated: 2026-06-22

## Outcome

`letra validate` detecta automaticamente acceptance criteria contraditórios entre diferentes specs, avisando o usuário sobre conflitos antes que virem bugs.

## Constraints

- Heurística puramente textual: busca padrões de contradição (negação, exclusão mútua) entre ACs de specs diferentes
- Opera 100% offline, sem LLM externo
- Conflitos reportados como warning (não quebram CI por padrão), configurável via `config.json`
- Escaneia todas as specs em `.letra/specs/` pairwise

## Exclusions

- **Não detecta conflitos semânticos profundos**: Apenas padrões textuais óbvios (ex: "usuário loga com email" vs "usuário loga só com Google")
- **Sem resolução automática**: Apenas alerta o conflito

## Acceptance Criteria

- [x] **Detecção de Exclusão Mútua**: "usuário faz login com email" vs "usuário faz login apenas com Google" → alerta de conflito.
- [x] **Detecção de Negação**: "sistema envia email" vs "sistema não envia email" → alerta de conflito.
- [x] **Report por Spec**: Mostra quais specs estão em conflito e o AC específico de cada uma.
- [x] **Severity Configurável**: `config.json` permite definir `"validate-conflict": "error" | "warning" | "off"`.
- [x] **Silêncio para Specs Irmãs**: Duas specs que compartilham prefixo (ex: `adapter-*`) têm tolerância maior (assume-se que são complementares).

## Context

Conforme o número de specs cresce, aumenta a chance de duas specs saying coisas opostas — especialmente em projetos grandes com múltiplos agentes ou times. Um AC diz "usuário faz login com email e senha", outro diz "usuário faz login apenas com Google OAuth". Nenhuma das duas está "errada" isoladamente, mas juntas são contraditórias. Essa heurística fecha mais um gap de qualidade, seguindo o mesmo padrão das outras 7 heurísticas já existentes.
