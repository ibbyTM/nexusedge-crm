import * as React from "react";
import { ChevronDownIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/** A styled native <select>: keyboard and mobile friendly, matches Input. */
function NativeSelect({ className, children, ...props }: React.ComponentProps<"select">) {
	return (
		<div className="relative">
			<select
				data-slot="native-select"
				className={cn(
					"h-8 w-full appearance-none rounded-lg border border-input bg-transparent py-1 pr-8 pl-2.5 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30",
					className
				)}
				{...props}
			>
				{children}
			</select>
			<ChevronDownIcon className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
		</div>
	);
}

export { NativeSelect };
