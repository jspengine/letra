export interface DiagnosticResult {
	id: string;
	type: "info" | "warning" | "error";
	title: string;
	description: string;
	certainty: number;
	detector: string;
	devOnly?: boolean;
	autoFix?: () => Promise<DiagnosticFix>;
}

export interface DiagnosticFix {
	files: { path: string; before: string; after: string }[];
	snapshotId: string;
}

export interface Snapshot {
	id: string;
	timestamp: string;
	diagnosticId: string;
	diagnosticTitle: string;
	files: { path: string; before: string; after: string }[];
}

export interface Detector {
	name: string;
	devOnly?: boolean;
	run: (rootDir: string) => Promise<DiagnosticResult[]>;
}
