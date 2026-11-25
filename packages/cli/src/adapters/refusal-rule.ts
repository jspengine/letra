/**
 * The one rule every agent instruction file carries about refused operations
 * (ITEM-55, spec bootstrap-ensina-recusas). Generators import it; none writes
 * its own version, so the guidance cannot drift between AGENTS.md, CLAUDE.md,
 * the Codex skill and the other formats.
 *
 * It is task-free on purpose: it belongs to the stable bootstrap (ITEM-19).
 */
export const REFUSAL_RULE_HEADING = "When an operation is refused";

export const REFUSAL_RULE_LINES: readonly string[] = [
	'- A refused operation answers `outcome: "rejected"` with `reasonCode`, `reason`, `nextCommand` and `humanRequired`, and the CLI exits with code 1.',
	"- `humanRequired: false`: run `nextCommand` as given; it already carries the accepted actor, capability and current revision.",
	"- `humanRequired: true`: stop and ask the human. Never retry with a human identity or `--actor human:...`.",
	"- Do not read Letra source code, `--help` output or workflow.json to find the next step: the refusal already names it.",
];

/** The rule as a Markdown section at the given heading level. */
export function refusalRuleSection(level = 2): string {
	return [`${"#".repeat(level)} ${REFUSAL_RULE_HEADING}`, "", ...REFUSAL_RULE_LINES].join("\n");
}
