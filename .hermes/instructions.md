# Gerado por letra sync. Nao edite manualmente.
# Letra Agent Bootstrap

Use the live execution contract for every task; this file contains no task assignment.

1. Query `get_direction` or run `letra direction --json` before acting. To act on an item, read `letra direction --item <ITEM-ID> --json` (or `--run <RUN-ID>`): its revision is the one the operations compare.
2. Follow only the selected Run. If assignment is unassigned or selection-required, acquire or select a Run explicitly.
3. Load only references listed by the direction and verify their SHA-256 values.
4. Include the current direction revision and an explicit target on every mutation.
5. Report evidence and completion through the Letra operation contract.

Workspace attention, generated prompts, and cached snapshots do not grant execution authority.