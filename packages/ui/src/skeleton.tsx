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

export function SkeletonPipeline() {
	return (
		<div className="flex flex-col gap-4 p-6 max-w-3xl mx-auto w-full">
			<Skeleton className="h-6 w-48" />
			<Skeleton className="h-3 w-32" />
			{[1, 2, 3, 4, 5].map((i) => (
				<div key={i} className="flex gap-3">
					<Skeleton className="w-10 h-10 rounded-full shrink-0" />
					<div className="flex-1">
						<Skeleton className="h-24 w-full rounded-xl" />
					</div>
				</div>
			))}
		</div>
	);
}

export function SkeletonTable() {
	return (
		<div className="flex flex-col gap-3">
			<Skeleton className="h-8 w-full rounded-lg" />
			{[1, 2, 3, 4, 5].map((i) => (
				<Skeleton key={i} className="h-10 w-full rounded-lg" />
			))}
		</div>
	);
}

export function SkeletonAgentList() {
	return (
		<div className="flex flex-col gap-3">
			<Skeleton className="h-6 w-32" />
			<Skeleton className="h-3 w-48" />
			{[1, 2, 3].map((i) => (
				<Skeleton key={i} className="h-24 w-full rounded-xl" />
			))}
		</div>
	);
}

export function SkeletonKanban() {
	return (
		<div className="flex flex-col gap-4">
			<div className="grid grid-cols-4 gap-4">
				{[1, 2, 3, 4].map((i) => (
					<div key={i} className="flex flex-col gap-2">
						<Skeleton className="h-5 w-24" />
						<Skeleton className="h-32 w-full rounded-xl" />
					</div>
				))}
			</div>
			<div className="grid grid-cols-5 gap-4">
				{[1, 2, 3, 4, 5].map((i) => (
					<div key={i} className="flex flex-col gap-2">
						<Skeleton className="h-5 w-24" />
						<Skeleton className="h-32 w-full rounded-xl" />
					</div>
				))}
			</div>
		</div>
	);
}
