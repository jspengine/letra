import { cn } from "../../lib/utils";

export function Skeleton({ className }: { className?: string }) {
	return (
		<div
			className={cn("animate-pulse rounded-lg", className)}
			style={{ background: "var(--muted)" }}
		/>
	);
}

export function SkeletonCard({ className }: { className?: string }) {
	return (
		<div
			className={cn("rounded-xl border p-4 flex flex-col gap-3", className)}
			style={{ background: "var(--card)", borderColor: "var(--border)" }}
		>
			<Skeleton className="h-3 w-20" />
			<Skeleton className="h-8 w-12" />
			<Skeleton className="h-3 w-32" />
		</div>
	);
}
