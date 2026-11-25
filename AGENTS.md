# Gerado por letra sync. Nao edite manualmente.
# Letra Agent Bootstrap

Use the live execution contract for every task; this file contains no task assignment.

1. Query `get_direction` or run `letra direction --json` before acting. To act on an item, read `letra direction --item <ITEM-ID> --json` (or `--run <RUN-ID>`): its revision is the one the operations compare.
2. Follow only the selected Run. If assignment is unassigned or selection-required, acquire or select a Run explicitly.
3. Load only references listed by the direction and verify their SHA-256 values.
4. Include the current direction revision and an explicit target on every mutation.
5. Report evidence and completion through the Letra operation contract.

Workspace attention, generated prompts, and cached snapshots do not grant execution authority.

## When an operation is refused

- A refused operation answers `outcome: "rejected"` with `reasonCode`, `reason`, `nextCommand` and `humanRequired`, and the CLI exits with code 1.
- `humanRequired: false`: run `nextCommand` as given; it already carries the accepted actor, capability and current revision.
- `humanRequired: true`: stop and ask the human. Never retry with a human identity or `--actor human:...`.
- Do not read Letra source code, `--help` output or workflow.json to find the next step: the refusal already names it.

## Contexto vivo do Letra para Codex

- Consulte `get_direction` antes de planejar, antes da primeira escrita e antes de concluir.
- A resposta com revisão mais recente prevalece sobre snapshots textuais deste arquivo.
- Não use `context.md` como estado vivo; ele é memória humana curada e deve ser lido apenas por seção quando a direção pedir contexto narrativo.
- Se `get_direction` estiver indisponível, execute `letra direction --json`; a resposta declara modo degradado e mantém a autoridade do harness.
- No fallback, valide e altere estado somente por `letra operation`, sempre com a revisão retornada.
- Não conclua AC nem solicite transição por caminhos que contornem o harness.
