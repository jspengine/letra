import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	plugins: [react(), tailwindcss()],
	base: "./",
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
	build: {
		outDir: "dist",
	},
	server: {
		proxy: {
			"/api": "http://localhost:3000",
			"/events": {
				target: "http://localhost:3000",
				changeOrigin: true,
				headers: {
					Accept: "text/event-stream",
				},
			},
		},
	},
});
