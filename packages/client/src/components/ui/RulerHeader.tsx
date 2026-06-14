import type { ReactNode } from "react";
import { Icon } from "@letra/ui";

interface Section {
	id: string;
	label: string;
}

interface RulerHeaderProps {
	title: string;
	description?: string;
	progress: number;
	sections: Section[];
	activeSection: string | null;
	actions?: ReactNode;
}

export function RulerHeader({
	title,
	description,
	progress,
	sections,
	activeSection,
	actions,
}: RulerHeaderProps) {
	const progPct = Math.round(progress * 100);

	return (
		<div
			className="border-b shrink-0"
			style={{
				borderColor: "var(--border)",
				background: "var(--card)",
			}}
		>
			<div className="flex items-center gap-2.5 px-4 py-2">
				<Icon name="specs" size={16} className="text-primary shrink-0" />
				<div className="flex-1 min-w-0">
					<h2 className="text-sm font-semibold truncate">{title}</h2>
					{description && (
						<p
							className="text-xs truncate"
							style={{ color: "var(--muted-foreground)" }}
						>
							{description}
						</p>
					)}
				</div>
				<span
					className="text-xs tabular-nums shrink-0"
					style={{ color: "var(--muted-foreground)" }}
				>
					{progPct}%
				</span>
				{actions}
			</div>

			<div className="relative px-4 pb-2">
				<div
					className="relative h-1 rounded-full overflow-hidden"
					style={{ background: "var(--border)" }}
				>
					<div
						className="h-full rounded-full"
						style={{
							width: `${progPct}%`,
							background: "var(--primary)",
						}}
					/>
				</div>

				{sections.length > 0 && (
					<div className="relative flex justify-between mt-1">
						{sections.map((sec, i) => {
							const isActive = activeSection === sec.id;
							const leftPct =
								sections.length > 1 ? (i / (sections.length - 1)) * 100 : 50;
							return (
								<div
									key={sec.id}
									className="absolute"
									style={{
										left: `${leftPct}%`,
										transform: "translateX(-50%)",
									}}
								>
									<div
										className="rounded-full"
										style={{
											width: isActive ? 8 : 4,
											height: isActive ? 8 : 4,
											background: isActive
												? "var(--primary)"
												: "var(--muted-foreground)",
											opacity: isActive ? 1 : 0.5,
											margin: "0 auto",
										}}
									/>
								</div>
							);
						})}
					</div>
				)}

				{activeSection && (
					<div className="text-center mt-1">
						<span
							className="text-[10px] font-medium"
							style={{ color: "var(--primary)" }}
						>
							{sections.find((s) => s.id === activeSection)?.label ?? activeSection}
						</span>
					</div>
				)}
			</div>
		</div>
	);
}
