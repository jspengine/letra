import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer";
import type * as React from "react";
import { cn } from "./utils";

function Drawer(props: DrawerPrimitive.Root.Props) {
	return <DrawerPrimitive.Root data-slot="drawer" {...props} />;
}

function DrawerTrigger(props: DrawerPrimitive.Trigger.Props) {
	return <DrawerPrimitive.Trigger data-slot="drawer-trigger" {...props} />;
}

function DrawerClose(props: DrawerPrimitive.Close.Props) {
	return <DrawerPrimitive.Close data-slot="drawer-close" {...props} />;
}

function DrawerContent({
	className,
	children,
	...props
}: DrawerPrimitive.Popup.Props & { children?: React.ReactNode }) {
	return (
		<DrawerPrimitive.Portal>
			<DrawerPrimitive.Backdrop
				data-slot="drawer-overlay"
				className="fixed inset-0 bg-[var(--overlay)] backdrop-blur-sm transition-opacity data-ending-style:opacity-0 data-starting-style:opacity-0"
			/>
			<DrawerPrimitive.Viewport className="fixed inset-0 flex items-end">
				<DrawerPrimitive.Popup
					data-slot="drawer-content"
					className={cn(
						"max-h-[90vh] w-full rounded-t-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] shadow-xl outline-none transition-transform data-ending-style:translate-y-full data-starting-style:translate-y-full",
						className,
					)}
					{...props}
				>
					{children}
				</DrawerPrimitive.Popup>
			</DrawerPrimitive.Viewport>
		</DrawerPrimitive.Portal>
	);
}

function DrawerHeader({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="drawer-header"
			className={cn(
				"grid gap-[var(--space-1)] p-[var(--space-4)] text-center sm:text-left",
				className,
			)}
			{...props}
		/>
	);
}

function DrawerFooter({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="drawer-footer"
			className={cn("mt-auto grid gap-[var(--space-2)] p-[var(--space-4)]", className)}
			{...props}
		/>
	);
}

function DrawerTitle({ className, ...props }: DrawerPrimitive.Title.Props) {
	return (
		<DrawerPrimitive.Title
			data-slot="drawer-title"
			className={cn("text-h3 text-[var(--color-text-primary)]", className)}
			{...props}
		/>
	);
}

function DrawerDescription({ className, ...props }: DrawerPrimitive.Description.Props) {
	return (
		<DrawerPrimitive.Description
			data-slot="drawer-description"
			className={cn("text-body-sm text-[var(--color-text-secondary)]", className)}
			{...props}
		/>
	);
}

export {
	Drawer,
	DrawerTrigger,
	DrawerClose,
	DrawerContent,
	DrawerHeader,
	DrawerFooter,
	DrawerTitle,
	DrawerDescription,
};
