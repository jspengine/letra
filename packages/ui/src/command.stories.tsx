import "./index.css";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, CommandShortcut } from "./command";

const items = [
	{ value: "settings", label: "Settings" },
	{ value: "users", label: "Users" },
	{ value: "roles", label: "Roles" },
	{ value: "audit", label: "Audit log" },
];

export const Default = () => (
	<Command className="max-w-[320px]">
		<CommandInput placeholder="Search commands..." />
		<CommandList>
			<CommandEmpty>No results found.</CommandEmpty>
			<CommandGroup heading="Navigation">
				{items.map((item) => (
					<CommandItem key={item.value} value={item.value}>
						{item.label}
						<CommandShortcut>Ctrl {item.value[0].toUpperCase()}</CommandShortcut>
					</CommandItem>
				))}
			</CommandGroup>
			<CommandSeparator />
			<CommandGroup heading="Actions">
				<CommandItem value="export">Export</CommandItem>
				<CommandItem value="import">Import</CommandItem>
			</CommandGroup>
		</CommandList>
	</Command>
);

export default {
	title: "Components/Command",
	tags: ["autodocs"],
	parameters: {
		docs: {
			description: {
				component:
					"Command-list primitive for searchable actions and navigation. Group related commands and keep shortcuts textual, stable, and optional.",
			},
		},
		"x-ds": {
			category: "primitive",
			status: "ready",
			tokens: ["color-bg-surface", "color-border", "color-text-primary", "space-3"],
			consumes: ["Icon"],
			surfaces: ["HomeView", "FlowView", "ExecutionView"],
			a11y: ["search-input", "grouped-options", "empty-state", "keyboard-navigation"],
			breakpoints: ["mobile", "desktop"],
		},
	},
};
