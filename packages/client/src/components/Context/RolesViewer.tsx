import { useEffect, useState } from "react";
import { Badge, Icon } from "@letra/ui";
import type { IconName } from "@letra/ui";
import { cn } from "../../lib/utils";

interface Role {
	id: string;
	label: string;
	description: string;
	allowedStages: string[];
	capabilities: string[];
}

const CAPABILITY_LABELS: Record<string, string> = {
	read_code: "Ler código",
	write_code: "Escrever código",
	run_tests: "Executar testes",
	write_spec: "Escrever especificações",
	generate_doc: "Gerar documentação",
	comment_pr: "Comentar PR",
	suggest_changes: "Sugerir alterações",
	scan_dependencies: "Escaneiar dependências",
	report_findings: "Reportar vulnerabilidades",
	create_pr: "Criar PR",
	assign_reviewers: "Atribuir revisores",
};

const ROLE_ICONS: Record<string, IconName> = {
	analyst: "search",
	builder: "code",
	reviewer: "info",
	security: "shield",
	"pr-bot": "user",
};

export default function RolesViewer() {
	const [roles, setRoles] = useState<Role[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		fetch("/api/harness/roles")
			.then((r) => r.json())
			.then((data) => {
				if (Array.isArray(data)) setRoles(data);
				setLoading(false);
			})
			.catch(() => {
				setRoles([]);
				setLoading(false);
			});
	}, []);

	if (loading) {
		return (
			<div className="flex h-full items-center justify-center p-6">
				<p className="animate-pulse text-sm text-[var(--color-text-secondary)]">
					Carregando papéis...
				</p>
			</div>
		);
	}

	if (roles.length === 0) {
		return (
			<div className="flex h-full items-center justify-center p-6 text-center">
				<p className="text-sm text-[var(--color-text-secondary)]">
					Nenhum papel configurado no harness.
				</p>
			</div>
		);
	}

	return (
		<div className="flex-1 overflow-y-auto p-4">
			<div className="mb-4">
				<h2 className="text-lg font-semibold">Papéis do Harness</h2>
				<p className="text-sm text-[var(--color-text-secondary)]">
					Agentes disponíveis no fluxo e suas capacidades.
				</p>
			</div>
			<div className="grid gap-3 sm:grid-cols-2">
				{roles.map((role) => (
					<div
						key={role.id}
						className="app-section-card p-4"
					>
						<div className="flex items-start gap-3">
							<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-bg-sunken)]">
								<Icon
									name={ROLE_ICONS[role.id] ?? "user"}
									size={16}
									className="text-[var(--color-text-secondary)]"
								/>
							</div>
							<div className="min-w-0 flex-1">
								<div className="flex items-center gap-2">
									<h3 className="text-sm font-medium">{role.label}</h3>
									<Badge variant="info" tone="soft" className="text-[10px]">
										{role.id}
									</Badge>
								</div>
								<p className="mt-1 text-xs text-[var(--color-text-secondary)]">
									{role.description}
								</p>
								<div className="mt-2 flex flex-wrap gap-1">
									{(role.allowedStages ?? []).map((stage) => (
										<Badge key={stage} variant="amber" tone="soft" className="text-[10px]">
											{stage}
										</Badge>
									))}
								</div>
								{(role.capabilities ?? []).length > 0 && (
									<div className="mt-2">
										<p className="mb-1 text-[10px] font-medium uppercase text-[var(--color-text-secondary)]">
											Capacidades
										</p>
										<div className="flex flex-wrap gap-1">
											{(role.capabilities ?? []).map((cap) => (
												<span
													key={cap}
													className="inline-flex items-center gap-1 rounded bg-[var(--color-bg-sunken)] px-1.5 py-0.5 text-[10px] text-[var(--color-text-secondary)]"
												>
													{CAPABILITY_LABELS[cap] || cap}
												</span>
											))}
										</div>
									</div>
								)}
							</div>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
