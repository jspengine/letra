import "./index.css";
import { NavigationMenu, NavigationMenuList, NavigationMenuItem, NavigationMenuTrigger, NavigationMenuContent, NavigationMenuLink, NavigationMenuViewport } from "./navigation-menu";

export const Default = () => (
	<NavigationMenu className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-[var(--space-1)]">
		<NavigationMenuList>
			<NavigationMenuItem>
				<NavigationMenuTrigger>Getting started</NavigationMenuTrigger>
				<NavigationMenuViewport>
					<NavigationMenuContent>
						<NavigationMenuLink href="#">Installation</NavigationMenuLink>
						<NavigationMenuLink href="#">Quick start</NavigationMenuLink>
						<NavigationMenuLink href="#">Configuration</NavigationMenuLink>
					</NavigationMenuContent>
				</NavigationMenuViewport>
			</NavigationMenuItem>
			<NavigationMenuItem>
				<NavigationMenuTrigger>Components</NavigationMenuTrigger>
				<NavigationMenuViewport>
					<NavigationMenuContent>
						<NavigationMenuLink href="#">Button</NavigationMenuLink>
						<NavigationMenuLink href="#">Card</NavigationMenuLink>
						<NavigationMenuLink href="#">Dialog</NavigationMenuLink>
					</NavigationMenuContent>
				</NavigationMenuViewport>
			</NavigationMenuItem>
			<NavigationMenuItem>
				<NavigationMenuLink href="#">Docs</NavigationMenuLink>
			</NavigationMenuItem>
		</NavigationMenuList>
	</NavigationMenu>
);

export default {
	title: "Components/NavigationMenu",
	tags: ["autodocs"],
	parameters: {
		docs: {
			description: {
				component:
					"Hierarchical navigation primitive for compact grouped destinations. Use sparingly in Letra surfaces because primary navigation should stay intent-oriented.",
			},
		},
		"x-ds": {
			category: "primitive",
			status: "ready",
			tokens: ["color-bg-surface", "color-border", "color-text-primary", "shadow-md"],
			consumes: [],
			surfaces: ["HomeView", "SpecsView"],
			a11y: ["navigation-semantics", "keyboard-navigation", "dismissible"],
			breakpoints: ["desktop"],
		},
	},
};
