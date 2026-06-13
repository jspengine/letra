import type { Item, Workflow } from "@letra/types";
import { Badge } from "../ui/badge";
import { Card, CardContent } from "../ui/card";

const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

function zoneForStage(
	stageId: string,
	wf: Workflow,
): "todo" | "doing" | "done" {
	const stage = wf.stages.find((s) => s.id === stageId);
	if (stage?.zone) return stage.zone;
	const idx = wf.stages.findIndex((s) => s.id === stageId);
	if (idx === 0) return "todo";
	if (idx === wf.stages.length - 1) return "done";
	return "doing";
}

function daysSince(dateStr: string): number {
	return Math.floor(
		(Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24),
	);
}

function zoneItems(wf: Workflow, zone: "todo" | "doing" | "done"): Item[] {
	return wf.items.filter((it) => {
		const z = zoneForStage(it.stage, wf);
		if (zone === "done") {
			return (
				z === "done" &&
				Date.now() - new Date(it.createdAt).getTime() <= SEVEN_DAYS
			);
		}
		return z === zone;
	});
}

function tasksBar(item: Item): string {
	if (!item.tasks || item.tasks.length === 0) return "";
	const done = item.tasks.filter((t) => t.done).length;
	const total = item.tasks.length;
	const pct = Math.round((done / total) * 100);
	const bars = Math.round(pct / 10);
	let barStr = "[";
	for (let i = 0; i < 10; i++) barStr += i < bars ? "#" : ".";
	barStr += `] ${done}/${total}`;
	return barStr;
}

interface ColumnProps {
	title: string;
	items: Item[];
	stages: Workflow["stages"];
	onSelectItem: (id: string) => void;
}

function DashColumn({ title, items, stages, onSelectItem }: ColumnProps) {
	return (
		<div className="flex-1 min-w-0 p-3">
			<h2 className="text-base font-semibold mb-3">
				{title}{" "}
				<span style={{ color: "var(--muted-foreground)" }}>
					({items.length})
				</span>
			</h2>
			{items.length === 0 && (
				<p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
					(empty)
				</p>
			)}
			<div className="flex flex-col gap-2">
				{items.map((it) => {
					const stageName =
						stages.find((s) => s.id === it.stage)?.name || it.stage;
					return (
						<Card key={it.id} onClick={() => onSelectItem(it.id)}>
							<CardContent className="p-3">
								<div className="font-medium">{it.id}</div>
								<div className="truncate">{it.description}</div>
								<div className="flex items-center gap-2 mt-1 text-xs">
									<Badge variant="secondary">{stageName}</Badge>
									{tasksBar(it) && <span>{tasksBar(it)}</span>}
									<span style={{ color: "var(--muted-foreground)" }}>
										{daysSince(it.createdAt) === 0
											? "today"
											: `${daysSince(it.createdAt)}d ago`}
									</span>
								</div>
							</CardContent>
						</Card>
					);
				})}
			</div>
		</div>
	);
}

interface Props {
	workflow: Workflow;
	onSelectItem: (id: string) => void;
}

export default function DashboardView({ workflow, onSelectItem }: Props) {
	const todo = zoneItems(workflow, "todo");
	const doing = zoneItems(workflow, "doing");
	const done = zoneItems(workflow, "done");

	return (
		<div className="flex h-full">
			<DashColumn
				title="A fazer"
				items={todo}
				stages={workflow.stages}
				onSelectItem={onSelectItem}
			/>
			<DashColumn
				title="Em andamento"
				items={doing}
				stages={workflow.stages}
				onSelectItem={onSelectItem}
			/>
			<DashColumn
				title="Feito"
				items={done}
				stages={workflow.stages}
				onSelectItem={onSelectItem}
			/>
		</div>
	);
}
