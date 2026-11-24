import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		// AC6 (ITEM-3): no test may read or write the real home directory.
		setupFiles: ["./src/test/isolate-home.ts"],
	},
});
