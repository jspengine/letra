import { defineConfig } from "tsup";

export default defineConfig({
	entry: ["src/index.ts", "src/index.css"],
	format: ["esm"],
	dts: true,
	clean: true,
	external: ["react", "react-dom"],
});
