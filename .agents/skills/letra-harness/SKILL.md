---
name: letra-harness
description: Consulte e siga a direção vigente do harness Letra ao implementar, revisar, validar ou avançar trabalho no workspace.
---

# Letra Harness

1. Consulte `get_direction` antes de planejar a atividade.
2. Confirme a spec e o AC vigente antes da primeira escrita.
3. Proteja o comportamento existente com teste de regressão.
4. Trabalhe somente dentro das permissões e proibições retornadas.
5. Consulte novamente `get_direction` antes de concluir ou solicitar transição.
6. Use apenas ferramentas de mutação fornecidas pelo Letra para alterar o estado canônico.

## Fallback quando o MCP estiver indisponível

1. Execute `letra direction --json` e trate a resposta como modo degradado.
2. Use a revisão retornada ao executar `letra operation validate --expected-revision <REVISION> --reason "<MOTIVO>"`.
3. Para concluir ou avançar, use os subcomandos controlados de `letra operation`; nunca contorne o harness.
4. Execute novamente `letra direction --json` antes de cada mutação.

Esta skill define procedimento. Item, stage, AC e próxima ação sempre vêm do contexto vivo.
