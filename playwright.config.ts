import { defineConfig } from "@playwright/test";

export default defineConfig({
	testDir: "./e2e",
	timeout: 30000,
	expect: { timeout: 10000 },
	fullyParallel: false,
	retries: 1,
	reporter: "list",
	use: {
		baseURL: "http://localhost:3000",
		headless: true,
		screenshot: "only-on-failure",
	},
	projects: [
		{
			name: "chromium",
			use: { browserName: "chromium" },
		},
	],
});
