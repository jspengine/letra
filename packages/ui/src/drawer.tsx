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
				className="fixed inset-0 z-50 bg-black/50 transition-opacity data-ending-style:opacity-0 data-starting-style:opacity-0"
			/>
			<DrawerPrimitive.Viewport className="fixed inset-0 z-50 flex items-end">
				<DrawerPrimitive.Popup
					data-slot="drawer-content"
					className={cn(
						"max-h-[90vh] w-full rounded-t-2xl border bg-card text-card-foreground shadow-xl outline-none transition-transform data-ending-style:translate-y-full data-starting-style:translate-y-full",
						className,
					)}
					{...props}
				>
					<div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-muted" aria-hidden="true" />
					<DrawerPrimitive.Content>{children}</DrawerPrimitive.Content>
				</DrawerPrimitive.Popup>
			</DrawerPrimitive.Viewport>
		</DrawerPrimitive.Portal>
	);
}

function DrawerHeader({ className, ...props }: React.ComponentProps<"div">) {
	return <div data-slot="drawer-header" className={cn("grid gap-1.5 p-4 text-center sm:text-left", className)} {...props} />;
}

function DrawerFooter({ className, ...props }: React.ComponentProps<"div">) {
	return <div data-slot="drawer-footer" className={cn("mt-auto grid gap-2 p-4", className)} {...props} />;
}

function DrawerTitle({ className, ...props }: DrawerPrimitive.Title.Props) {
	return (
		<DrawerPrimitive.Title
			data-slot="drawer-title"
			className={cn("text-lg font-semibold", className)}
			{...props}
		/>
	);
}

function DrawerDescription({ className, ...props }: DrawerPrimitive.Description.Props) {
	return (
		<DrawerPrimitive.Description
			data-slot="drawer-description"
			className={cn("text-sm text-muted-foreground", className)}
			{...props}
		/>
	);
}

export { Drawer, DrawerTrigger, DrawerClose, DrawerContent, DrawerHeader, DrawerFooter, DrawerTitle, DrawerDescription };
