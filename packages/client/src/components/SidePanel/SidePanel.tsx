import type { Item, Workflow } from "@letra/types";
import { useState } from "react";
import { Badge, Button, Checkbox, Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@letra/ui";

interface Props {
	workflow: Workflow | null;
	itemId: string | null;
	onClose: () => void;
}

function daysSince(dateStr: string): number {
	return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

function SidePanelContent({ item, workflow }: { item: Item; workflow: Workflow }) {
	const [selectedStage, setSelectedStage] = useState(item.stage);
	const stageName = workflow.stages.find((s) => s.id === item.stage)?.name || item.stage;

	function handleMove() {
		fetch(`/api/items/${item.id}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ stage: selectedStage }),
		}).then(() => location.reload());
	}

	return (
		<div className="p-3 flex flex-col gap-3">
			<div>
				<h2 className="text-base font-semibold">{item.id}</h2>
			</div>

			<div>
				<p className="text-sm">{item.description}</p>
			</div>

			<div>
				<Badge variant="info">{stageName}</Badge>
			</div>

			<div>
				<span className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
					{daysSince(item.createdAt) === 0
						? "created today"
						: `created ${daysSince(item.createdAt)}d ago`}
				</span>
			</div>

			{item.spec && (
				<div>
					<a
						href={`/specs/${item.spec}`}
						className="text-xs underline"
						style={{ color: "var(--color-text-primary)" }}
					>
						View Spec
					</a>
				</div>
			)}

			{item.tasks && item.tasks.length > 0 && (
				<div>
					<h3 className="text-sm font-semibold mb-1">Tasks</h3>
					<div className="flex flex-col gap-1">
						{item.tasks.map((t) => (
							<label
								key={t.id}
								className="flex items-center gap-2 text-xs cursor-pointer"
							>
								<Checkbox
									checked={t.done}
									onChange={() => {
										fetch(`/api/items/${item.id}/tasks/${t.id}`, {
											method: "PATCH",
											headers: { "Content-Type": "application/json" },
											body: JSON.stringify({ done: !t.done }),
										}).then(() => location.reload());
									}}
								/>
								{t.done ? (
									<s style={{ color: "var(--color-text-secondary)" }}>
										{t.description}
									</s>
								) : (
									t.description
								)}
							</label>
						))}
					</div>
				</div>
			)}

			<div>
				<h3 className="text-sm font-semibold mb-1">Move</h3>
				<div className="flex gap-2">
					<Select value={selectedStage} onValueChange={(value) => setSelectedStage(value)}>
					<SelectTrigger className="flex-1 rounded px-2 py-1 text-xs" style={{ background: "var(--color-bg-base)", border: "1px solid var(--color-border)", color: "var(--color-text-primary)" }}>
						<SelectValue placeholder="Select stage" />
					</SelectTrigger>
					<SelectContent>
						{workflow.stages.map((s) => (
							<SelectItem key={s.id} value={s.id}>
								{s.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
					<Button variant="primary" size="sm" onClick={handleMove}>
						Move
					</Button>
				</div>
			</div>
		</div>
	);
}

export default function SidePanel({ workflow, itemId, onClose }: Props) {
	if (!itemId || !workflow) return null;

	const item = workflow.items.find((it) => it.id === itemId);
	if (!item) return null;

	return (
		<div
			className="w-64 border-l overflow-y-auto relative"
			style={{
				borderColor: "var(--color-border)",
				background: "var(--color-bg-surface)",
				color: "var(--color-text-primary)",
			}}
		>
			<Button
				type="button"
				onClick={onClose}
				className="absolute top-2 right-2 p-1 rounded text-xs leading-none"
				style={{
					background: "var(--color-bg-surface)",
					color: "var(--color-text-secondary)",
					border: "none",
					cursor: "pointer",
				}}
				title="Close"
			>
				✕
			</Button>
			<SidePanelContent item={item} workflow={workflow} />
		</div>
	);
}
