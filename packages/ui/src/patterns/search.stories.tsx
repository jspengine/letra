import { Search } from "./search";

export const Default = () => (
	<Search placeholder="Search item, spec, or agent..." className="w-80" />
);
export const WithShortDebounce = () => (
	<Search debounceMs={120} placeholder="Search quickly..." className="w-80" />
);
export const Empty = () => <Search placeholder="No results yet..." className="w-80" />;
export const Loading = () => (
	<Search placeholder="Indexing workspace..." className="w-80 opacity-80" />
);
export const Error = () => <Search placeholder="Search unavailable" className="w-80" />;
export const Collapsed = () => <Search placeholder="Search" className="w-40" />;
export const Mobile = () => (
	<div className="w-[360px]">
		<Search placeholder="Search..." />
	</div>
);

export default {
	title: "Patterns/Search",
	parameters: {
		"x-ds": {
			category: "pattern",
			status: "ready",
			tokens: ["color-bg-surface", "color-border", "color-text-disabled", "duration-fast"],
			consumes: ["Icon"],
			surfaces: ["HomeView", "FlowView", "SpecsView"],
			a11y: ["escape-clears", "clear-button-label", "focus-retention"],
			breakpoints: ["mobile", "desktop"],
		},
	},
};
