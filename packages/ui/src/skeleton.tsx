import type { HTMLAttributes } from "react";
import { cn } from "./utils";

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {}

export function Skeleton({ className, ...props }: SkeletonProps) {
	return (
		<div
			className={cn("rounded-lg animate-pulse", className)}
			style={{ background: "var(--muted)" }}
			{...props}
		/>
	);
}

export function SkeletonCard() {
	return (
		<div
			className="rounded-xl border p-4 flex flex-col gap-3"
			style={{ background: "var(--card)", borderColor: "var(--border)" }}
		>
			<Skeleton className="h-4 w-1/3" />
			<Skeleton className="h-3 w-full" />
			<Skeleton className="h-3 w-2/3" />
		</div>
	);
}
