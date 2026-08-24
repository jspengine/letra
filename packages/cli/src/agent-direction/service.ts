import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type {
	AgentDirectionAction,
	AgentDirectionCommand,
	AgentDirectionSnapshot,
	FlowActivityHint,
	GovernanceReference,
	ResolvedFlowDefinition,
	ResolvedFlowStage,
} from "@letra/types";
import { readFocusFile } from "../adapters/focus-sync.js";
import type { Item, Workflow } from "../commands/flow-init.js";
import { resolveActiveFlow } from "../flow-definition/resolve.js";
import { getLetraDir } from "./../workspace/resolver.js";

export interface CreateAgentDirectionSnapshotInput {
	workspaceRoot: string;
	workflow: Workflow | null;
	flow: ResolvedFlowDefinition | null;
	specContent: string | null;
	currentItemId?: string | null;
	now?: string;
	constitutionVersion?: string | null;
}

function slug(value: string): string {
	return (
		value
			.normalize("NFD")
			.replace(/[\u0300-\u036f]/g, "")
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "") || "action"
	);
}

function findCurrentItem(workflow: Workflow, currentItemId?: string | null): Item | null {
	if (currentItemId) {
		const explicit = workflow.items.find((item) => item.id === currentItemId);
		if (explicit) return explicit;
	}
	if (workflow.primaryItemId) {
		const primary = workflow.items.find((item) => item.id === workflow.primaryItemId);
		if (primary) return primary;
	}
	const doingStages = new Set(
		workflow.stages
			.filter(
				(stage, index) =>
					stage.zone === "doing" ||
					(!stage.zone && index > 0 && index < workflow.stages.length - 1),
			)
			.map((stage) => stage.id),
	);
	return workflow.items.find((item) => doingStages.has(item.stage)) ?? null;
}

function firstPendingAC(content: string | null): AgentDirectionSnapshot["pendingAC"] {
	if (!content) return null;
	const match = content.match(/-\s*\[ \]\s*\*\*([^*]+)\*\*\s*:?\s*([^\r\n]*)/);
	if (!match) return null;
	const id = match[1].match(/\bAC[\s-]?(\d+)\b/i);
	if (!id) return null;
	return {
		id: `AC${id[1]}`,
		description: match[2].trim() || match[1].replace(/^AC[\s-]?\d+\s*[—-]?\s*/i, "").trim(),
	};
}

function activeHint(stage: ResolvedFlowStage | null): FlowActivityHint | null {
	if (!stage?.activity) return null;
	return (
		stage.activity.design ??
		stage.activity.implement ??
		stage.activity.review ??
		stage.activity.diagnose ??
		stage.activity.gate ??
		null
	);
}

function commandMutates(command: string): boolean {
	return /\bletra\s+(?:ac\s+done|flow\s+move|focus|sitrep|health\s+(?:ack|dismiss|scan))\b/i.test(
		command,
	);
}

function resolveCommands(
	hint: FlowActivityHint | null,
	item: Item | null,
	pendingAC: AgentDirectionSnapshot["pendingAC"],
	nextStageId: string | null,
): AgentDirectionCommand[] {
	return (hint?.commands ?? []).flatMap((entry) => {
		let command = entry.command;
		if (command.includes("<AC-ID>")) {
			if (!pendingAC) return [];
			command = command.replaceAll("<AC-ID>", pendingAC.id);
		}
		if (command.includes("<ITEM-ID>")) {
			if (!item) return [];
			command = command.replaceAll("<ITEM-ID>", item.id);
		}
		if (command.includes("<NEXT-STAGE>")) {
			if (!nextStageId) return [];
			command = command.replaceAll("<NEXT-STAGE>", nextStageId);
		}
		return [
			{
				id: slug(entry.label || command),
				command,
				label: entry.label || command,
				mutates: commandMutates(command),
			},
		];
	});
}

function resolveActions(hint: FlowActivityHint | null): AgentDirectionAction[] {
	return (hint?.nextActions ?? []).map((action) => ({
		id: slug(action.label),
		label: action.label,
		reason: action.description,
	}));
}

function semanticRevision(
	snapshot: Omit<AgentDirectionSnapshot, "revision" | "generatedAt">,
): string {
	return `sha256:${createHash("sha256").update(JSON.stringify(snapshot)).digest("hex")}`;
}

export function createAgentDirectionSnapshot(
	input: CreateAgentDirectionSnapshotInput,
): AgentDirectionSnapshot {
	const item = input.workflow ? findCurrentItem(input.workflow, input.currentItemId) : null;
	const stage = item
		? (input.flow?.stages.find((candidate) => candidate.id === item.stage) ?? null)
		: null;
	const sortedStages = input.flow ? [...input.flow.stages].sort((a, b) => a.order - b.order) : [];
	const stageIndex = stage
		? sortedStages.findIndex((candidate) => candidate.id === stage.id)
		: -1;
	const nextStageId = stageIndex >= 0 ? (sortedStages[stageIndex + 1]?.id ?? null) : null;
	const hint = activeHint(stage);
	const pendingAC = firstPendingAC(input.specContent);
	const warnings = (input.flow?.warnings ?? []).map((warning) => ({
		code: warning.code,
		message: warning.message,
	}));
	const mode: AgentDirectionSnapshot["mode"] = !input.workflow
		? "unconfigured"
		: !input.flow || input.flow.source !== "workflow-template" || warnings.length > 0
			? "degraded"
			: "active";
	const allowedStageIds = [...new Set(stage?.roles.flatMap((role) => role.allowedStages) ?? [])];
	const gateEvidence = stage?.activity?.gate?.evidence;

	// Constitution governance
	const constitutionPath = join(getLetraDir(input.workspaceRoot), "constitution.md");
	const constitutionAvailable = existsSync(constitutionPath);
	const constitutionVersion =
		input.constitutionVersion ??
		(constitutionAvailable ? readConstitutionVersion(input.workspaceRoot) : null);
	const governanceReferences: GovernanceReference[] = [];
	if (constitutionAvailable) {
		governanceReferences.push({
			path: "constitution.md",
			version: constitutionVersion ?? "unknown",
			available: true,
			source: "workspace",
		});
	} else {
		governanceReferences.push({
			path: "constitution.md",
			version: "unknown",
			available: false,
			source: "workspace",
		});
		warnings.push({
			code: "CONSTITUTION_MISSING",
			message: "Constitution file not found in workspace",
		});
	}

	const semantic = {
		schemaVersion: "1" as const,
		source: {
			harnessVersion: input.flow?.harnessVersion ?? input.workflow?.harnessVersion ?? null,
			flowId: input.flow?.id ?? null,
			workspaceRoot: resolve(input.workspaceRoot).replace(/\\/g, "/"),
		},
		mode,
		item: item
			? {
					id: item.id,
					description: item.description,
					stage: item.stage,
					spec: item.spec ?? null,
				}
			: null,
		roleIds: stage ? [...stage.roleIds] : [],
		allowedStageIds,
		objective: hint?.objective ?? null,
		pendingAC,
		commands: resolveCommands(hint, item, pendingAC, nextStageId),
		prohibitions: [...(hint?.mustNotDo ?? [])],
		requiredEvidence: gateEvidence ? [gateEvidence] : [],
		nextActions: resolveActions(hint),
		warnings,
		governanceReferences,
		constitutionVersion: constitutionVersion ?? undefined,
	};
	return {
		...semantic,
		revision: semanticRevision(semantic),
		generatedAt: input.now ?? new Date().toISOString(),
	};
}

function readActiveSpec(root: string, specName: string | null): string | null {
	if (!specName) return null;
	const specDir = join(getLetraDir(root), "specs", specName);
	const acceptancePath = join(specDir, "acceptance.md");
	const specPath = join(specDir, "spec.md");
	if (existsSync(acceptancePath)) return readFileSync(acceptancePath, "utf-8");
	if (existsSync(specPath)) return readFileSync(specPath, "utf-8");
	return null;
}

function readConstitutionVersion(root: string): string | null {
	const constitutionPath = join(getLetraDir(root), "constitution.md");
	if (!existsSync(constitutionPath)) return null;
	const content = readFileSync(constitutionPath, "utf-8");
	const versionMatch = content.match(/\*\*Version:\*\*\s*(.+)/);
	return versionMatch ? versionMatch[1].trim() : null;
}

export function resolveAgentDirection(root: string): AgentDirectionSnapshot {
	const resolution = resolveActiveFlow(root);
	const focus = readFocusFile(root);
	const workflow = resolution.workflow;
	const focusedItem =
		workflow && focus?.itemId
			? (workflow.items.find((item) => item.id === focus.itemId) ?? null)
			: null;
	const selectedItem = focusedItem ?? (workflow ? findCurrentItem(workflow) : null);
	const specName = selectedItem?.spec ?? focus?.specName ?? null;
	return createAgentDirectionSnapshot({
		workspaceRoot: root,
		workflow,
		flow: resolution.flow,
		specContent: readActiveSpec(root, specName),
		currentItemId: selectedItem?.id ?? null,
	});
}
