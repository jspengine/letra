import { resolve } from "node:path";
import { DiagnosticEngine } from "../diagnostics/engine.js";

export async function diagnose(targetPath?: string): Promise<void> {
	const root = resolve(process.cwd(), targetPath ?? ".");
	const engine = new DiagnosticEngine(root);
	engine.ensureDirs();

	console.log("\n🔍 Auto-diagnóstico do Letra\n");

	const output = await engine.runAll();

	if (output.fixes.length > 0) {
		console.log(`✅ ${output.fixes.length} auto-correção(ões) aplicada(s):\n`);
		for (const fix of output.fixes) {
			console.log(`  • ${fix.title}`);
		}
		console.log();
	}

	if (output.suggestions.length > 0) {
		console.log(`💡 ${output.suggestions.length} sugestão(ões):\n`);
		for (const s of output.suggestions) {
			console.log(`  • [${s.type}] ${s.title}`);
			console.log(`    ${s.description}`);
		}
		console.log();
	}

	if (output.errors.length > 0) {
		console.log(`❌ ${output.errors.length} erro(s) nos detectores:\n`);
		for (const err of output.errors) {
			console.log(`  • ${err}`);
		}
		console.log();
	}

	if (
		output.fixes.length === 0 &&
		output.suggestions.length === 0 &&
		output.errors.length === 0
	) {
		console.log("  Nenhum problema detectado. Tudo ok.\n");
	}

	const snapshots = engine.listSnapshots();
	if (snapshots.length > 0) {
		console.log(`📦 ${snapshots.length} snapshots disponíveis para undo:`);
		for (const snap of snapshots.slice(0, 5)) {
			console.log(
				`  • ${snap.id} — ${snap.diagnosticTitle} (${new Date(snap.timestamp).toLocaleString()})`,
			);
		}
		if (snapshots.length > 5) {
			console.log(`  ... e mais ${snapshots.length - 5}`);
		}
		console.log();
	}
}
