"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon, SettingsIcon } from "lucide-react";

import { api, errorMessage } from "@/lib/api";
import { useAppState } from "@/lib/app-state";
import type { AutomationRun } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { PageTitle, Panel } from "@/components/crm/primitives";
import { RunsList } from "@/components/crm/runs-list";

const PAGE_SIZE = 50;

export function AutomationRuns() {
	const { location, user } = useAppState();
	const locationId = location?.id;
	const [status, setStatusState] = useState("");
	const [scope, setScopeState] = useState<"location" | "all">("location");
	const [page, setPage] = useState(1);
	const [seenLocationId, setSeenLocationId] = useState(locationId);
	if (locationId !== seenLocationId) {
		// Sub-account changed: back to the first page (React's "adjust state on prop change" pattern).
		setSeenLocationId(locationId);
		setPage(1);
	}
	const setStatus = (v: string) => {
		setStatusState(v);
		setPage(1);
	};
	const setScope = (v: "location" | "all") => {
		setScopeState(v);
		setPage(1);
	};
	const [runs, setRuns] = useState<AutomationRun[] | null>(null);
	const [total, setTotal] = useState(0);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(async () => {
		try {
			const res = await api.automations.runs({ locationId: scope === "location" ? locationId : undefined, status, page, pageSize: PAGE_SIZE });
			setRuns(res.runs);
			setTotal(res.total);
			setError(null);
		} catch (err) {
			setError(errorMessage(err));
			setRuns([]);
		}
	}, [locationId, status, scope, page]);

	useEffect(() => {
		// eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on mount; state is set after the request resolves
		void load();
	}, [load]);

	const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

	return (
		<>
			<PageTitle
				eyebrow="Automations"
				title="Automation runs"
				description="Every automation triggered from this CRM, who ran it, and what HighLevel replied."
				actions={
					user?.role === "admin" && (
						<Button variant="outline" asChild>
							<Link href="/settings/automations">
								<SettingsIcon data-icon="inline-start" />
								Manage buttons
							</Link>
						</Button>
					)
				}
			/>
			<div className="flex flex-col gap-3">
				<div className="flex flex-wrap gap-2">
					<NativeSelect value={scope} onChange={(e) => setScope(e.target.value as typeof scope)} className="w-48" aria-label="Scope">
						<option value="location">{location ? location.name : "Current sub-account"}</option>
						<option value="all">All sub-accounts</option>
					</NativeSelect>
					<NativeSelect value={status} onChange={(e) => setStatus(e.target.value)} className="w-40" aria-label="Status">
						<option value="">Any outcome</option>
						<option value="success">Succeeded</option>
						<option value="failed">Failed</option>
					</NativeSelect>
				</div>
				<Panel>
					<RunsList runs={runs} emptyTitle={error ? "Could not load runs" : "No runs yet"} emptyDescription={error ?? "Runs appear here as soon as someone uses Run automation on a contact."} />
					{total > PAGE_SIZE && (
						<div className="flex items-center justify-between border-t px-3 py-2 text-muted-foreground text-xs">
							<span>{total.toLocaleString()} runs</span>
							<div className="flex items-center gap-1">
								<Button variant="ghost" size="icon-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Previous page">
									<ChevronLeftIcon />
								</Button>
								<span className="font-mono">
									{page} / {pageCount}
								</span>
								<Button variant="ghost" size="icon-sm" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)} aria-label="Next page">
									<ChevronRightIcon />
								</Button>
							</div>
						</div>
					)}
				</Panel>
			</div>
		</>
	);
}
