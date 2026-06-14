export interface TemplateStage {
	id: string;
	name: string;
	zone?: "todo" | "doing" | "done";
}

import type { IconName } from "@letra/ui";

export interface WorkflowTemplate {
	id: string;
	name: string;
	description: string;
	stages: TemplateStage[];
	icon: IconName;
}

export const TEMPLATES: WorkflowTemplate[] = [
	{
		id: "padrao",
		name: "Padrão",
		description:
			"Fluxo linear clássico: da ideia à entrega, passando por design, código e revisão.",
		icon: "cross",
		stages: [
			{ id: "backlog", name: "Backlog", zone: "todo" },
			{ id: "design", name: "Design", zone: "doing" },
			{ id: "code", name: "Code", zone: "doing" },
			{ id: "review", name: "Review", zone: "doing" },
			{ id: "done", name: "Done", zone: "done" },
		],
	},
	{
		id: "kanban",
		name: "Kanban",
		description:
			"Fluxo simplificado em 3 colunas: A Fazer, Fazendo, Feito. Ideal para times enxutos.",
		icon: "list-three",
		stages: [
			{ id: "todo", name: "A Fazer", zone: "todo" },
			{ id: "doing", name: "Fazendo", zone: "doing" },
			{ id: "done", name: "Feito", zone: "done" },
		],
	},
	{
		id: "agil",
		name: "Ágil",
		description:
			"Scrum-like: backlog do produto, sprint backlog, desenvolvimento, revisão e entrega.",
		icon: "star",
		stages: [
			{ id: "product-backlog", name: "Product Backlog", zone: "todo" },
			{ id: "sprint-backlog", name: "Sprint Backlog", zone: "todo" },
			{ id: "in-progress", name: "In Progress", zone: "doing" },
			{ id: "review", name: "Review", zone: "doing" },
			{ id: "done", name: "Done", zone: "done" },
		],
	},
	{
		id: "personalizado",
		name: "Personalizar",
		description:
			"Monte seu próprio fluxo: defina os estágios e como eles se organizam em zonas.",
		icon: "settings",
		stages: [],
	},
];
