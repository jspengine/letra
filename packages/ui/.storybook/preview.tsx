import type { Preview } from "@storybook/react";
import { withThemeByClassName } from "@storybook/addon-themes";

import "./preview.css";

const preview: Preview = {
	parameters: {
		layout: "centered",
		controls: {
			matchers: {
				color: /(background|color)$/i,
				date: /Date$/i,
			},
		},
		backgrounds: {
			default: "dark",
			values: [
				{ name: "dark", value: "#0F1115" },
				{ name: "surface", value: "#171A20" },
				{ name: "sunken", value: "#1D2128" },
			],
		},
		a11y: {
			element: "#storybook-root",
		},
	},
	decorators: [
		withThemeByClassName({
			themes: {
				dark: "dark",
				light: "light",
			},
			defaultTheme: "dark",
		}),
		(Story) => (
			<div
				style={{
					minHeight: "100%",
					width: "100%",
					display: "flex",
					flexDirection: "column",
					gap: "var(--space-4, 16px)",
				}}
			>
				<Story />
			</div>
		),
	],
};

export default preview;
