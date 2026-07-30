import "./index.css";
import { AvatarWithStatus } from "./avatar-with-status";
import { AvatarFallback, AvatarImage } from "./avatar";

export const Default = () => (
	<div className="flex items-end gap-[var(--space-4)]">
		<AvatarWithStatus size="lg" status="online">
			<span className="font-semibold">RN</span>
		</AvatarWithStatus>
		<AvatarWithStatus size="md" status="busy">
			<span className="font-semibold">AI</span>
		</AvatarWithStatus>
		<AvatarWithStatus size="md" status="thinking">
			<span className="font-semibold">AG</span>
		</AvatarWithStatus>
		<AvatarWithStatus size="sm" status="away">
			<span className="font-semibold">JD</span>
		</AvatarWithStatus>
		<AvatarWithStatus size="md" status="offline">
			<span className="font-semibold">--</span>
		</AvatarWithStatus>
	</div>
);

export const WithImage = () => (
	<div className="flex items-end gap-[var(--space-4)]">
		<AvatarWithStatus size="lg" status="online">
			<AvatarImage src="https://github.com/shadcn.png" alt="User avatar" />
			<AvatarFallback>SC</AvatarFallback>
		</AvatarWithStatus>
		<AvatarWithStatus size="md" status="busy">
			<AvatarFallback>AB</AvatarFallback>
		</AvatarWithStatus>
	</div>
);

export default {
	title: "Components/AvatarWithStatus",
	tags: ["autodocs"],
	parameters: {
		docs: {
			description: {
				component:
					"Actor avatar pattern with presence state. Status should support textual context nearby when it communicates workflow-critical availability.",
			},
		},
		"x-ds": {
			category: "primitive",
			status: "ready",
			tokens: ["color-success", "color-warning", "color-danger", "color-agent", "color-border"],
			consumes: ["Avatar", "AvatarImage", "AvatarFallback"],
			surfaces: ["ExecutionView", "HomeView"],
			a11y: ["fallback-required", "status-not-color-only"],
			breakpoints: ["mobile", "desktop"],
		},
	},
};
