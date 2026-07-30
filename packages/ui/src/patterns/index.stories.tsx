import { MarchingBorder } from "./marching-border";
import { Search } from "./search";
import { ValidatingBar } from "./validating-bar";

export const Default = () => (
	<div className="flex flex-col gap-[var(--space-4)] p-[var(--space-4)]">
		<ValidatingBar label="Validating manifest..." />
		<ValidatingBar />
		<MarchingBorder>
			<div className="p-[var(--space-4)] text-sm text-[var(--color-text-primary)]">
				Live transition active
			</div>
		</MarchingBorder>
		<Search placeholder="Search repository..." onChange={(value) => console.log(value)} />
	</div>
);

export default {
	title: "Patterns/Index",
	tags: ["autodocs"],
	parameters: {
		docs: {
			description: {
				component:
					"Compact pattern overview for smoke-checking DS interaction patterns in one Storybook surface.",
			},
		},
		"x-ds": {
			category: "pattern",
			status: "ready",
			tokens: ["space-4", "color-text-primary", "color-primary"],
			consumes: ["ValidatingBar", "MarchingBorder", "Search"],
			surfaces: ["Storybook"],
			a11y: ["pattern-overview", "labels-visible"],
			breakpoints: ["mobile", "desktop"],
		},
	},
};
