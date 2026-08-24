import "./index.css";
import { Avatar, AvatarFallback, AvatarImage } from "./avatar";

export const Sm = () => (
	<Avatar size="sm">
		<AvatarFallback>AL</AvatarFallback>
	</Avatar>
);

export const Md = () => (
	<Avatar size="md">
		<AvatarFallback>AL</AvatarFallback>
	</Avatar>
);

export const Lg = () => (
	<Avatar size="lg">
		<AvatarFallback>AL</AvatarFallback>
	</Avatar>
);

export const WithImage = () => (
	<Avatar size="lg">
		<AvatarImage src="https://i.pravatar.cc/150?u=al" alt="User" />
		<AvatarFallback>AL</AvatarFallback>
	</Avatar>
);

export default {
	title: "Components/Avatar",
	tags: ["autodocs"],
	parameters: {
		docs: {
			description: {
				component:
					"Identity primitive for humans, agents, and workspace actors. Always include AvatarFallback when an image is used.",
			},
		},
		"x-ds": {
			category: "primitive",
			status: "ready",
			tokens: ["color-bg-sunken", "color-border", "color-text-primary", "icon-sm"],
			consumes: [],
			surfaces: ["HomeView", "ExecutionView", "WorkspacesView"],
			a11y: ["fallback-required", "image-alt"],
			breakpoints: ["mobile", "desktop"],
		},
	},
};
