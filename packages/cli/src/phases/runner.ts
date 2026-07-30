import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { logEntry } from "../session-log.js";
import type { PhaseDef } from "../harness/types.js";
import type { Item } from "../commands/flow-init.js";
import { GateChecker } from "../harness/gate-checker.js";

export interface PhaseActionResult {
	ok: boolean;
	actions: string[];
	error?: string;
}

export class PhaseActionRunner {
	execPhase(root: string, item: Item, phaseDef: PhaseDef): PhaseActionResult {
		if (!phaseDef.actions || phaseDef.actions.length === 0) {
			return { ok: true, actions: [] };
		}

		const checker = new GateChecker(root);
		const results: string[] = [];
		for (const action of phaseDef.actions) {
			try {
				switch (action.type) {
					case "command": {
						const output = execSync(action.cmd, {
							cwd: root,
							timeout: 30000,
							stdio: "pipe",
						});
						const label = `command: ${action.cmd}`;
						results.push(label);
						logEntry(root, "system", `action:${label}`, { itemId: item.id, details: { phase: phaseDef.id } });
						break;
					}
					case "agent-prompt": {
						const promptDir = join(root, ".letra");
						if (!existsSync(promptDir)) mkdirSync(promptDir, { recursive: true });
						const content = [
							`# Phase Prompt: ${phaseDef.label}`,
							"",
							action.prompt,
							"",
							"---",
							`Item: ${item.id}`,
							`Phase: ${phaseDef.id}`,
						].join("\n");
						writeFileSync(join(root, ".letra", "phase-prompt.md"), content, "utf-8");
						const label = `agent-prompt: ${action.prompt}`;
						results.push(label);
						logEntry(root, "system", `action:${label}`, { itemId: item.id, details: { phase: phaseDef.id } });
						break;
					}
					case "generate-report": {
						const reportDir = join(root, ".letra", "reports");
						if (!existsSync(reportDir)) mkdirSync(reportDir, { recursive: true });
						const reportContent = [
							`# Report: ${item.id} - ${phaseDef.label}`,
							`Generated: ${new Date().toISOString()}`,
							`Template: ${action.template}`,
						].join("\n");
						const reportPath = join(reportDir, `${item.id}-${phaseDef.id}.md`);
						writeFileSync(reportPath, reportContent, "utf-8");
						const label = `generate-report: ${action.template}`;
						results.push(label);
						logEntry(root, "system", `action:${label}`, { itemId: item.id, details: { phase: phaseDef.id } });
						break;
					}
					case "notify-human": {
						logEntry(root, "system", `action:notify-human: ${action.message}`, {
							itemId: item.id,
							details: { phase: phaseDef.id },
						});
						const notifyPath = join(root, ".letra", "human-notify.md");
						writeFileSync(
							notifyPath,
							`# Human Notification\n\n${action.message}\n\nItem: ${item.id}\nPhase: ${phaseDef.id}`,
							"utf-8",
						);
						const label = `notify-human: ${action.message}`;
						results.push(label);
						break;
					}
					case "wait-human": {
						const gateId = action.gate ?? "";
						const gateResult = checker.check(gateId, item);
						if (!gateResult.allowed) {
							logEntry(root, "system", `action:wait-human gate "${gateId}" blocking`, {
								itemId: item.id,
								details: { gate: gateId, phase: phaseDef.id },
							});
							return {
								ok: false,
								error: gateResult.reason?.includes("humana")
									? `Gate "${gateId}" not approved`
									: gateResult.reason ?? `Gate "${gateId}" not approved`,
								actions: results,
							};
						}
						const label = `wait-human: ${gateId} (approved)`;
						results.push(label);
						break;
					}
				}
			} catch (e: any) {
				const msg = `Action "${action.type}" failed: ${e.message}`;
				logEntry(root, "system", `action:error ${msg}`, { itemId: item.id, details: { phase: phaseDef.id } });
				return { ok: false, error: msg, actions: results };
			}
		}
		return { ok: true, actions: results };
	}
}

export function loadGate(root: string, gateId: string): { blocking: boolean; status: string } | null {
	const harnessDir = join(root, ".letra", "harness");
	if (!existsSync(harnessDir)) return null;
	const files = [join(harnessDir, "gates", `${gateId}.yaml`), join(harnessDir, "gates", `${gateId}.yml`)];
	for (const f of files) {
		if (existsSync(f)) {
			const raw = readFileSync(f, "utf-8");
			const blocking = raw.includes("blocking: true");
			const status = raw.includes("status: approved") ? "approved" : "pending";
			return { blocking, status };
		}
	}
	return null;
}
