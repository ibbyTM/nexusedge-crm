"use client";

import * as React from "react";
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";
import { CheckIcon } from "lucide-react";

import { cn } from "@/lib/utils";

function DropdownMenu(props: React.ComponentProps<typeof DropdownMenuPrimitive.Root>) {
	return <DropdownMenuPrimitive.Root data-slot="dropdown-menu" {...props} />;
}

function DropdownMenuTrigger(props: React.ComponentProps<typeof DropdownMenuPrimitive.Trigger>) {
	return <DropdownMenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />;
}

function DropdownMenuContent({ className, sideOffset = 6, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
	return (
		<DropdownMenuPrimitive.Portal>
			<DropdownMenuPrimitive.Content
				data-slot="dropdown-menu-content"
				sideOffset={sideOffset}
				className={cn(
					"z-50 min-w-44 max-h-[var(--radix-dropdown-menu-content-available-height)] overflow-y-auto rounded-lg border bg-popover p-1 text-popover-foreground text-sm shadow-md ring-1 ring-foreground/5",
					"data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
					className
				)}
				{...props}
			/>
		</DropdownMenuPrimitive.Portal>
	);
}

function DropdownMenuItem({ className, inset, destructive, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & { inset?: boolean; destructive?: boolean }) {
	return (
		<DropdownMenuPrimitive.Item
			data-slot="dropdown-menu-item"
			className={cn(
				"relative flex cursor-default select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none focus:bg-muted focus:text-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
				inset && "pl-8",
				destructive && "text-destructive focus:bg-destructive/10 focus:text-destructive",
				className
			)}
			{...props}
		/>
	);
}

function DropdownMenuCheckboxItem({ className, children, checked, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem>) {
	return (
		<DropdownMenuPrimitive.CheckboxItem
			data-slot="dropdown-menu-checkbox-item"
			className={cn(
				"relative flex cursor-default select-none items-center gap-2 rounded-md py-1.5 pr-2 pl-8 text-sm outline-none focus:bg-muted data-disabled:pointer-events-none data-disabled:opacity-50",
				className
			)}
			checked={checked}
			{...props}
		>
			<span className="absolute left-2 flex size-4 items-center justify-center">
				<DropdownMenuPrimitive.ItemIndicator>
					<CheckIcon className="size-3.5" />
				</DropdownMenuPrimitive.ItemIndicator>
			</span>
			{children}
		</DropdownMenuPrimitive.CheckboxItem>
	);
}

function DropdownMenuLabel({ className, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Label>) {
	return <DropdownMenuPrimitive.Label data-slot="dropdown-menu-label" className={cn("px-2 py-1.5 font-mono text-[10px] text-muted-foreground uppercase tracking-widest", className)} {...props} />;
}

function DropdownMenuSeparator({ className, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
	return <DropdownMenuPrimitive.Separator data-slot="dropdown-menu-separator" className={cn("-mx-1 my-1 h-px bg-border", className)} {...props} />;
}

export { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator };
