"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ActivityIcon } from "lucide-react";

import { formatDateTime, timeAgo } from "@/lib/format";
import type { AutomationRun } from "@/lib/types";
import { EmptyState, Skeleton, StatusPill } from "@/components/crm/primitives";

export function RunsList({
	runs,
	compact = false,
	showContact = true,
	emptyIcon = ActivityIcon,
	emptyTitle = "No runs",
	emptyDescription,
}: {
	runs: AutomationRun[] | null;
	compact?: boolean;
	showContact?: boolean;
	emptyIcon?: LucideIcon;
	emptyTitle?: string;
	emptyDescription?: string;
}) {
	if (runs === null) {
		return (
			<div className="flex flex-col gap-3 p-4">
				{Array.from({ length: 4 }).map((_, i) => (
					<Skeleton key={i} className="h-10" />
				))}
			</div>
		);
	}
	if (runs.length === 0) return <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} />;

	return (
		<ul className="divide-y">
			{runs.map((r) => (
				<li key={r.id} className={`flex items-start gap-3 ${compact ? "px-4 py-2.5" : "px-4 py-3"}`}>
					<StatusPill tone={r.status === "success" ? "ok" : "bad"}>{r.status === "success" ? "ok" : "failed"}</StatusPill>
					<div className="min-w-0 flex-1">
						<p className="truncate text-sm">
							<span className="font-medium">{r.buttonLabel}</span>
							{showContact && r.contactId && (
								<>
									<span className="text-muted-foreground"> for </span>
									<Link href={`/contacts/view?id=${encodeURIComponent(r.contactId)}`} className="text-primary hover:underline">
										{r.contactName || "contact"}
									</Link>
								</>
							)}
						</p>
						<p className="truncate text-muted-foreground text-xs">
							{r.userName} · <span title={formatDateTime(r.createdAt)}>{timeAgo(r.createdAt)}</span>
							{r.detail && !compact && <> · {r.detail}</>}
						</p>
						{r.detail && r.status === "failed" && compact && <p className="mt-0.5 truncate text-destructive text-xs">{r.detail}</p>}
					</div>
					{r.responseCode !== null && !compact && <span className="font-mono text-[10px] text-muted-foreground">{r.responseCode}</span>}
				</li>
			))}
		</ul>
	);
}
