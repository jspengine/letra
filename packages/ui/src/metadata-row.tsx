import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./utils";

export interface MetadataRowItem {
	label: ReactNode;
	value: ReactNode;
	icon?: ReactNode;
}

interface MetadataRowProps extends HTMLAttributes<HTMLDListElement> {
	items: MetadataRowItem[];
}

export function MetadataRow({ items, className, ...props }: MetadataRowProps) {
	if (items.length === 0) return null;

	return (
		<dl
			className={cn(
				"grid gap-[var(--layout-inline-gap)] sm:grid-cols-[repeat(auto-fit,minmax(8rem,1fr))]",
				className,
			)}
			{...props}
		>
			{items.map((item, index) => (
				<div
					key={index}
					className="grid gap-[var(--space-1)] rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg-sunken)] p-[var(--space-3)]"
				>
					<dt className="ds-cluster text-caption font-medium uppercase text-[var(--color-text-tertiary)]">
						{item.icon}
						<span>{item.label}</span>
					</dt>
					<dd className="min-w-0 break-words text-body-sm font-medium text-[var(--color-text-primary)]">
						{item.value}
					</dd>
				</div>
			))}
		</dl>
	);
}
