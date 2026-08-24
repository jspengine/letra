import type { DiagnosticEngine } from "../diagnostics/engine.js";
import type { DiagnosticResult } from "../diagnostics/types.js";
import { loadHealthRecord, mergeScanResults, saveHealthRecord } from "../health-record.js";

export interface DiagnosticsOutput {
	fixes: Array<unknown>;
	suggestions: Array<{
		id: string;
		type: "info" | "warning" | "error";
		title: string;
		description: string;
		detector: string;
	}>;
	errors: Array<unknown>;
}

export function diagnosticSuggestionsFromOutput(output: DiagnosticsOutput): DiagnosticResult[] {
	return output.suggestions.map((suggestion) => ({
		id: suggestion.id,
		type: suggestion.type,
		title: suggestion.title,
		description: suggestion.description,
		certainty: 0.8,
		detector: suggestion.detector,
	}));
}

export async function runDiagnosticsAndSyncHealth(
	engine: DiagnosticEngine,
	root: string,
): Promise<DiagnosticsOutput> {
	const output = (await engine.runAll()) as DiagnosticsOutput;
	const record = loadHealthRecord(root);
	mergeScanResults(record, diagnosticSuggestionsFromOutput(output));
	saveHealthRecord(root, record);
	return output;
}
