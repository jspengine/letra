import "./index.css";
import { useState } from "react";
import { ButtonGroup, ButtonGroupItem } from "./button-group";

const filters = [
	{ value: "all", label: "Todos", count: 13 },
	{ value: "attention", label: "Precisa de atenção", count: 1 },
	{ value: "running", label: "Em andamento", count: 2 },
	{ value: "queued", label: "Na fila", count: 7 },
	{ value: "done", label: "Concluídos", count: 3 },
];

export const WorkFilters = () => {
	const [active, setActive] = useState("all");

	return (
		<ButtonGroup ariaLabel="Filtrar trabalho">
			{filters.map((filter) => (
				<ButtonGroupItem
					key={filter.value}
					selected={active === filter.value}
					count={filter.count}
					onClick={() => setActive(filter.value)}
				>
					{filter.label}
				</ButtonGroupItem>
			))}
		</ButtonGroup>
	);
};

export default {
	title: "Components/ButtonGroup",
	tags: ["autodocs"],
	parameters: {
		docs: {
			description: {
				component:
					"Grouped button control for mutually related view filters. Use when choices refine the same surface and should not compete with primary actions.",
			},
		},
		"x-ds": {
			category: "primitive",
			status: "ready",
			tokens: ["color-bg-sunken", "color-bg-surface", "color-border", "color-text-secondary"],
			consumes: ["Button"],
			surfaces: ["FlowView"],
			a11y: ["aria-label", "aria-pressed", "focus-visible"],
			breakpoints: ["mobile", "desktop"],
		},
	},
};
