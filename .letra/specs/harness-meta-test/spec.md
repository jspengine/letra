# Spec: harness-meta-test

> Updated: 2026-06-22

## Outcome

O próprio harness de diagnóstico não é validado automaticamente. Se um detector quebra ou um AC do self-diagnosis-core fica defasado, ninguém percebe. Este detector valida o próprio estado do harness contra o spec self-diagnosis-core.

> **Dev-only**: Este detector só faz sentido no repositório do Letra (dogfooding). Projetos de usuário final não têm um spec self-diagnosis-core para validar — o detector nunca produz resultados para eles. Implementado via `devOnly: true`.

## Constraints

- Certeza 1.0 (auto-fix) — validações são determinísticas (arquivo existe, constante tem valor X)
- Roda como primeiro detector (garantir que o harness está íntegro antes de diagnosticar o projeto)
- Não depende de rede externa ou LLM

## Exclusions

- Validação de qualidade dos detectores (só verifica presença e formato)
- Testes de integração (cada detector tem seus próprios testes)
- Performance dos detectores (fora de escopo)

## Acceptance Criteria

- [x] **Detectores registrados**: engine.ts tem todos os 6 detectores do schema
- [x] **TTL correto**: snapshot.ts TTL_MS == 30 dias
- [x] **Consistência certeza/autoFix**: Todo detector com certainty ≥ 0.9 tem autoFix; < 0.9 não tem
- [x] **Auto-fix**: Se detector faltando, adiciona placeholder comentado (para desenvolvedor implementar)
- [x] **Testes**: Meta-teste verifica que harness-meta-test detecta intencionalmente um detector removido
- [x] **DevOnly filter**: Meta-teste verifica que detectores com `devOnly: true` são pulados quando `isLetraRepo()` retorna `false`

## Context

Este detector fecha o ciclo do auto-diagnóstico: o harness que valida o projeto agora valida a si mesmo. Se alguém remove um detector sem atualizar o schema, o meta-test alerta. Se o TTL muda sem atualizar o spec, o meta-test alerta. É o detector que garante que os outros detectores estão funcionando.
