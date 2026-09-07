import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/** The mono uppercase eyebrow the site uses above every heading. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
	return <span className={cn("font-mono text-primary text-xs uppercase tracking-widest", className)}>{children}</span>;
}

/** Lucide glyph in the tinted chip from the brief: bg-primary/10, primary glyph, line weight 2. */
export function IconChip({ icon: Icon, className, size = "md" }: { icon: LucideIcon; className?: string; size?: "sm" | "md" | "lg" }) {
	return (
		<span
			className={cn(
				"inline-flex shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary",
				size === "sm" && "size-6 [&_svg]:size-3.5",
				size === "md" && "size-8 [&_svg]:size-4",
				size === "lg" && "size-10 [&_svg]:size-5",
				className
			)}
		>
			<Icon strokeWidth={2} />
		</span>
	);
}

export function PageTitle({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode }) {
	return (
		<div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
			<div className="flex flex-col gap-1.5">
				{eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
				<h1 className="font-heading font-medium text-2xl leading-tight tracking-tight">{title}</h1>
				{description && <p className="max-w-2xl text-muted-foreground text-sm">{description}</p>}
			</div>
			{actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
		</div>
	);
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
	return <div className={cn("rounded-xl border bg-card", className)}>{children}</div>;
}

export function EmptyState({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description?: string; action?: ReactNode }) {
	return (
		<div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
			<IconChip icon={Icon} size="lg" />
			<p className="font-heading font-medium">{title}</p>
			{description && <p className="max-w-sm text-muted-foreground text-sm">{description}</p>}
			{action && <div className="mt-1">{action}</div>}
		</div>
	);
}

export function StatusPill({ tone, children }: { tone: "ok" | "warn" | "bad" | "muted"; children: ReactNode }) {
	return (
		<span
			className={cn(
				"inline-flex h-5 items-center gap-1.5 rounded-sm border px-1.5 font-mono text-[10px] uppercase tracking-wider",
				tone === "ok" && "border-primary/30 bg-primary/10 text-primary",
				tone === "warn" && "border-[color:var(--dashboard-yellow)]/40 text-[color:var(--dashboard-yellow)]",
				tone === "bad" && "border-destructive/30 bg-destructive/10 text-destructive",
				tone === "muted" && "text-muted-foreground"
			)}
		>
			{children}
		</span>
	);
}

export function Field({ label, htmlFor, hint, children, className }: { label: string; htmlFor?: string; hint?: string; children: ReactNode; className?: string }) {
	return (
		<div className={cn("flex flex-col gap-1.5", className)}>
			<label htmlFor={htmlFor} className="font-medium text-sm">
				{label}
			</label>
			{children}
			{hint && <p className="text-muted-foreground text-xs">{hint}</p>}
		</div>
	);
}

export function InlineError({ message }: { message: string | null }) {
	if (!message) return null;
	return (
		<p role="alert" className="text-destructive text-sm">
			{message}
		</p>
	);
}

export function Skeleton({ className }: { className?: string }) {
	return <div aria-hidden className={cn("animate-pulse rounded-md bg-muted", className)} />;
}
