import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";

export function StarBorder({
	children,
	className,
	color,
}: {
	children: ReactNode;
	className?: string;
	color?: string;
}) {
	return (
		<div
			className={cn("star-border-container", className)}
			style={color ? ({ "--star-color": color } as CSSProperties) : undefined}
		>
			<div aria-hidden="true" className="star-border-gradient-bottom" />
			<div aria-hidden="true" className="star-border-gradient-top" />
			<div className="relative z-10">{children}</div>
		</div>
	);
}
