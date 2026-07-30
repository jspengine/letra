import type { HTMLAttributes, RefObject, useImperativeHandle, useRef } from "react";
import { cn } from "./utils";

interface ScrollAreaProps extends HTMLAttributes<HTMLDivElement> {
	type?: "always" | "auto" | "hover" | "scroll";
}

export function ScrollArea({
	className,
	type = "auto",
	children,
	...props
}: ScrollAreaProps) {
	return (
		<div
			data-slot="scroll-area"
			className={cn(
				"relative h-full min-h-0 overflow-hidden rounded-[inherit]",
				type === "always" && "scrollbar",
				type === "auto" && "scrollbar-auto",
				type === "hover" && "scrollbar-hover",
				className,
			)}
			{...props}
		>
			<div className="h-full min-h-0 w-full overflow-auto rounded-[inherit]">{children}</div>
		</div>
	);
}

interface ScrollBarProps extends HTMLAttributes<HTMLDivElement> {
	orientation?: "horizontal" | "vertical";
}

function ScrollBar({ className, orientation = "vertical", ...props }: ScrollBarProps) {
	return (
		<div
			className={cn(
				"flex touch-none select-none transition-opacity",
				orientation === "vertical" && "h-full w-2.5 border-l border-l-transparent p-[1px]",
				orientation === "horizontal" && "h-2.5 flex-col border-t border-t-transparent p-[1px]",
				className,
			)}
			{...props}
		>
			<div
				className={cn(
					"relative flex-1 rounded-full bg-border/50",
					orientation === "vertical" && "min-h-[20px]",
					orientation === "horizontal" && "min-w-[20px]",
				)}
			/>
		</div>
	);
}

export function ScrollAreaViewport({
	className,
	children,
	...props
}: HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			className={cn("min-h-full w-full rounded-[inherit]", className)}
			data-slot="scroll-area-viewport"
			{...props}
		>
			{children}
		</div>
	);
}

export function ScrollAreaBar({
	className,
	orientation = "vertical",
	...props
}: ScrollBarProps) {
	return (
		<ScrollBar orientation={orientation} className={className} {...props} />
	);
}
