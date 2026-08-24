import "./index.css";
import { Badge } from "./badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table";

export const Default = () => (
	<Table>
		<TableHeader>
			<TableRow>
				<TableHead>Agent</TableHead>
				<TableHead>Status</TableHead>
				<TableHead>Uptime</TableHead>
			</TableRow>
		</TableHeader>
		<TableBody>
			<TableRow>
				<TableCell>agent-triage-01</TableCell>
				<TableCell>
					<Badge variant="agent">reasoning</Badge>
				</TableCell>
				<TableCell>4h 12m</TableCell>
			</TableRow>
			<TableRow>
				<TableCell>pipeline-onboarding</TableCell>
				<TableCell>
					<Badge variant="success">complete</Badge>
				</TableCell>
				<TableCell>--</TableCell>
			</TableRow>
			<TableRow>
				<TableCell>agent-release-02</TableCell>
				<TableCell>
					<Badge variant="amber">waiting</Badge>
				</TableCell>
				<TableCell>2h 08m</TableCell>
			</TableRow>
		</TableBody>
	</Table>
);

export default {
	title: "Components/Table",
	tags: ["autodocs"],
	parameters: {
		docs: {
			description: {
				component:
					"Structured data primitive for scan-heavy operational records. Use native table semantics, clear headers, and horizontal overflow instead of shrinking content below legibility.",
			},
		},
		"x-ds": {
			category: "primitive",
			status: "ready",
			tokens: ["color-border", "surface-hover", "surface-selected", "text-caption"],
			consumes: ["Badge"],
			surfaces: ["ExecutionView", "LogsView", "WorkspacesView"],
			a11y: ["native-table", "responsive-overflow"],
			breakpoints: ["mobile", "desktop"],
		},
	},
};
