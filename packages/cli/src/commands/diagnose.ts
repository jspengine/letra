import { resolve } from "node:path";
import { DiagnosticEngine } from "../diagnostics/engine.js";
import type { DiagnosticResult } from "../diagnostics/types.js";
import { loadHealthRecord, saveHealthRecord, mergeScanResults } from "../health-record.js";
import { logEntry } from "../session-log.js";

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

	const suggestions: DiagnosticResult[] = output.suggestions.map((s) => ({
		id: s.id,
		type: s.type,
		title: s.title,
		description: s.description,
		certainty: 0.8,
		detector: s.detector,
	}));

	const record = loadHealthRecord(root);
	mergeScanResults(record, suggestions);
	saveHealthRecord(root, record);

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

	logEntry(
		root,
		"diagnose",
		`Diagnóstico executado — ${output.fixes.length} auto-correção(ões), ${output.suggestions.length} sugestão(ões), ${output.errors.length} erro(s)`,
		{
			details: {
				fixes: output.fixes.length,
				suggestions: output.suggestions.length,
				errors: output.errors.length,
			},
		},
	);
}
