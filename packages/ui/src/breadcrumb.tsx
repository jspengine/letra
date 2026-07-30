import type { AnchorHTMLAttributes, HTMLAttributes, LiHTMLAttributes, ReactNode } from "react";
import { Icon } from "./icon";
import { cn } from "./utils";

function Breadcrumb({ className, ...props }: HTMLAttributes<HTMLElement>) {
	return (
		<nav
			data-slot="breadcrumb"
			aria-label="Breadcrumb"
			className={cn("text-sm text-[var(--color-text-secondary)]", className)}
			{...props}
		/>
	);
}

function BreadcrumbList({ className, ...props }: HTMLAttributes<HTMLOListElement>) {
	return (
		<ol
			data-slot="breadcrumb-list"
			className={cn("flex min-w-0 flex-wrap items-center gap-[var(--space-2)]", className)}
			{...props}
		/>
	);
}

function BreadcrumbItem({ className, ...props }: LiHTMLAttributes<HTMLLIElement>) {
	return (
		<li
			data-slot="breadcrumb-item"
			className={cn("inline-flex min-w-0 items-center gap-[var(--space-2)]", className)}
			{...props}
		/>
	);
}

function BreadcrumbLink({ className, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
	return (
		<a
			data-slot="breadcrumb-link"
			className={cn(
				"truncate rounded-[var(--radius-sm)] text-[var(--color-text-secondary)] underline-offset-4 transition-colors hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring-color)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-base)]",
				className,
			)}
			{...props}
		/>
	);
}

function BreadcrumbPage({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
	return (
		<span
			data-slot="breadcrumb-page"
			aria-current="page"
			className={cn("truncate font-medium text-[var(--color-text-primary)]", className)}
			{...props}
		/>
	);
}

function BreadcrumbSeparator({ className, children, ...props }: HTMLAttributes<HTMLLIElement> & { children?: ReactNode }) {
	return (
		<li
			data-slot="breadcrumb-separator"
			aria-hidden="true"
			className={cn("inline-flex items-center text-[var(--color-text-muted)]", className)}
			{...props}
		>
			{children ?? <Icon name="chevron-right" size={14} />}
		</li>
	);
}

function BreadcrumbEllipsis({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
	return (
		<span
			data-slot="breadcrumb-ellipsis"
			aria-label="More pages"
			className={cn("inline-flex h-6 items-center rounded-[var(--radius-sm)] px-[var(--space-1)] text-[var(--color-text-secondary)]", className)}
			{...props}
		>
			...
		</span>
	);
}

export {
	Breadcrumb,
	BreadcrumbList,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbPage,
	BreadcrumbSeparator,
	BreadcrumbEllipsis,
};
