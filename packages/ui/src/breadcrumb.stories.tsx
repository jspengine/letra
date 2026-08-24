import "./index.css";
import {
	Breadcrumb,
	BreadcrumbEllipsis,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "./breadcrumb";

export const Basic = () => (
	<Breadcrumb>
		<BreadcrumbList>
			<BreadcrumbItem>
				<BreadcrumbLink href="#workspace">Workspace</BreadcrumbLink>
			</BreadcrumbItem>
			<BreadcrumbSeparator />
			<BreadcrumbItem>
				<BreadcrumbLink href="#specs">Specs</BreadcrumbLink>
			</BreadcrumbItem>
			<BreadcrumbSeparator />
			<BreadcrumbItem>
				<BreadcrumbPage>ux-release-readiness</BreadcrumbPage>
			</BreadcrumbItem>
		</BreadcrumbList>
	</Breadcrumb>
);

export const Collapsed = () => (
	<Breadcrumb>
		<BreadcrumbList>
			<BreadcrumbItem>
				<BreadcrumbLink href="#home">Letra</BreadcrumbLink>
			</BreadcrumbItem>
			<BreadcrumbSeparator />
			<BreadcrumbItem>
				<BreadcrumbEllipsis />
			</BreadcrumbItem>
			<BreadcrumbSeparator />
			<BreadcrumbItem>
				<BreadcrumbLink href="#flow">Flow</BreadcrumbLink>
			</BreadcrumbItem>
			<BreadcrumbSeparator />
			<BreadcrumbItem>
				<BreadcrumbPage>ITEM-74</BreadcrumbPage>
			</BreadcrumbItem>
		</BreadcrumbList>
	</Breadcrumb>
);

export default {
	title: "Components/Breadcrumb",
	tags: ["autodocs"],
	parameters: {
		docs: {
			description: {
				component:
					"Hierarchical navigation primitive for showing the current resource path without adding another navigation surface.",
			},
		},
		"x-ds": {
			category: "navigation",
			status: "ready",
			tokens: [
				"color-text-secondary",
				"color-text-primary",
				"color-text-muted",
				"focus-ring-color",
			],
			consumes: ["Icon"],
			surfaces: ["ContextView", "SpecsView", "FlowView"],
			a11y: ["nav-label", "aria-current", "focus-visible"],
			breakpoints: ["mobile", "desktop"],
		},
	},
};
