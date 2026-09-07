"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckIcon, CopyIcon, RefreshCwIcon, WebhookIcon } from "lucide-react";

import { api, errorMessage } from "@/lib/api";
import { useAppState } from "@/lib/app-state";
import { useToast } from "@/lib/toast";
import { formatDateTime, timeAgo } from "@/lib/format";
import type { SyncState, WebhookEvent } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Eyebrow, PageTitle, Panel, StatusPill } from "@/components/crm/primitives";

type LogLine = { at: string; text: string; tone?: "ok" | "bad" };

export function SyncSettings() {
	const { user, refreshLocations, refreshMeta } = useAppState();
	const { toast } = useToast();
	const isAdmin = user?.role === "admin";
	const [states, setStates] = useState<SyncState[]>([]);
	const [events, setEvents] = useState<WebhookEvent[]>([]);
	const [allLocations, setAllLocations] = useState<{ id: string; name: string; enabled: boolean; contactCount: number; syncedAt: string | null }[]>([]);
	const [running, setRunning] = useState(false);
	const [log, setLog] = useState<LogLine[]>([]);
	const [copied, setCopied] = useState(false);
	const stopRef = useRef(false);

	const load = useCallback(async () => {
		try {
			const [status, locs] = await Promise.all([api.sync.status(), api.locations.list(isAdmin)]);
			setStates(status.states);
			setEvents(status.recentWebhooks);
			setAllLocations(locs.locations);
		} catch (err) {
			toast({ tone: "bad", title: "Could not load sync status", detail: errorMessage(err) });
		}
	}, [isAdmin, toast]);

	useEffect(() => {
		// eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on mount; state is set after the request resolves
		void load();
	}, [load]);

	const append = (text: string, tone?: LogLine["tone"]) => setLog((l) => [...l, { at: new Date().toLocaleTimeString("en-GB"), text, tone }]);

	const runFull = async (onlyLocationId?: string) => {
		setRunning(true);
		stopRef.current = false;
		setLog([]);
		try {
			if (!onlyLocationId) {
				const r = await api.sync.step({ step: "locations" });
				append(`Sub-accounts: ${r.synced as number} found`, "ok");
				await refreshLocations();
			}
			const targets = (await api.locations.list(isAdmin)).locations.filter((l) => l.enabled && (!onlyLocationId || l.id === onlyLocationId));
			for (const loc of targets) {
				if (stopRef.current) break;
				try {
					const m = await api.sync.step({ step: "meta", locationId: loc.id });
					const s = m.synced as Record<string, unknown>;
					append(`${loc.name}: ${s.tags} tags, ${s.customFields} custom fields, ${s.workflows} workflows`, "ok");
				} catch (err) {
					append(`${loc.name}: metadata failed. ${errorMessage(err)}`, "bad");
				}
				let restart = true;
				let total = 0;
				while (!stopRef.current) {
					try {
						const r = await api.sync.step({ step: "contacts", locationId: loc.id, pages: 5, restart });
						restart = false;
						total = r.total ?? total + (r.synced as number);
						append(`${loc.name}: ${total} contacts so far`);
						if (r.done) {
							append(`${loc.name}: contacts complete (${total})`, "ok");
							break;
						}
					} catch (err) {
						append(`${loc.name}: contacts failed. ${errorMessage(err)}`, "bad");
						break;
					}
				}
			}
			append(stopRef.current ? "Stopped" : "Sync finished", stopRef.current ? undefined : "ok");
		} catch (err) {
			append(`Sync failed. ${errorMessage(err)}`, "bad");
		} finally {
			setRunning(false);
			await Promise.all([load(), refreshLocations(), refreshMeta()]);
		}
	};

	const toggleEnabled = async (id: string, enabled: boolean) => {
		try {
			await api.locations.setEnabled(id, enabled);
			await Promise.all([load(), refreshLocations()]);
		} catch (err) {
			toast({ tone: "bad", title: "Could not update", detail: errorMessage(err) });
		}
	};

	const stateFor = (locationId: string, resource: string) => states.find((s) => s.locationId === locationId && s.resource === resource);
	const webhookUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/api/webhooks/ghl?key=YOUR_GHL_WEBHOOK_KEY`;

	const copy = async () => {
		try {
			await navigator.clipboard.writeText(webhookUrl);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			toast({ tone: "bad", title: "Could not copy" });
		}
	};

	return (
		<>
			<PageTitle
				eyebrow="Settings"
				title="Sync and webhooks"
				description="The CRM keeps a mirror of HighLevel so pages load instantly. Sync pulls everything; webhooks keep individual contacts fresh in between."
				actions={
					isAdmin && (
						<>
							{running ? (
								<Button variant="outline" onClick={() => (stopRef.current = true)}>
									Stop after this step
								</Button>
							) : (
								<Button onClick={() => void runFull()}>
									<RefreshCwIcon data-icon="inline-start" />
									Sync everything now
								</Button>
							)}
						</>
					)
				}
			/>

			<div className="grid gap-6 lg:grid-cols-5">
				<div className="flex flex-col gap-6 lg:col-span-3">
					<section className="flex flex-col gap-3">
						<Eyebrow>Sub-accounts</Eyebrow>
						<Panel className="overflow-hidden">
							{allLocations.length === 0 ? (
								<p className="px-4 py-8 text-center text-muted-foreground text-sm">Nothing mirrored yet. {isAdmin ? "Run the first sync." : "Ask an admin to run the first sync."}</p>
							) : (
								<ul className="divide-y">
									{allLocations.map((l) => {
										const c = stateFor(l.id, "contacts");
										const m = stateFor(l.id, "meta");
										return (
											<li key={l.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
												<div className="min-w-0 flex-1">
													<p className="truncate font-medium text-sm">{l.name}</p>
													<p className="truncate text-muted-foreground text-xs">
														{l.contactCount.toLocaleString()} contacts · contacts {c ? `${c.status}, ${timeAgo(c.lastFinishedAt ?? c.lastStartedAt)}` : "never"} · metadata {m ? timeAgo(m.lastFinishedAt) : "never"}
													</p>
													{(c?.lastError || m?.lastError) && <p className="mt-0.5 truncate text-destructive text-xs">{c?.lastError || m?.lastError}</p>}
												</div>
												{c?.status === "error" ? <StatusPill tone="bad">error</StatusPill> : c?.status === "done" ? <StatusPill tone="ok">synced</StatusPill> : c?.status === "running" ? <StatusPill tone="warn">running</StatusPill> : <StatusPill tone="muted">pending</StatusPill>}
												{isAdmin && (
													<>
														<Button variant="outline" size="sm" disabled={running || !l.enabled} onClick={() => void runFull(l.id)}>
															Sync
														</Button>
														<Switch checked={l.enabled} onCheckedChange={(v) => void toggleEnabled(l.id, v)} aria-label={`Show ${l.name}`} />
													</>
												)}
											</li>
										);
									})}
								</ul>
							)}
						</Panel>
						{isAdmin && <p className="text-muted-foreground text-xs">Switch a sub-account off to hide it from the team. Its data stays mirrored.</p>}
					</section>

					{(running || log.length > 0) && (
						<section className="flex flex-col gap-3">
							<Eyebrow>Sync log</Eyebrow>
							<Panel className="max-h-72 overflow-y-auto p-3 font-mono text-xs">
								{log.map((l, i) => (
									<p key={i} className={l.tone === "bad" ? "text-destructive" : l.tone === "ok" ? "text-primary" : "text-muted-foreground"}>
										<span className="mr-2 opacity-60">{l.at}</span>
										{l.text}
									</p>
								))}
								{running && <p className="animate-pulse text-muted-foreground">Working</p>}
							</Panel>
						</section>
					)}
				</div>

				<div className="flex flex-col gap-6 lg:col-span-2">
					<section className="flex flex-col gap-3">
						<Eyebrow>Keep it fresh</Eyebrow>
						<Panel className="flex flex-col gap-4 p-4 text-sm">
							<div className="flex items-start gap-3">
								<span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
									<WebhookIcon className="size-4" />
								</span>
								<div>
									<p className="font-medium">Live updates from HighLevel</p>
									<p className="mt-1 text-muted-foreground text-xs leading-relaxed">
										In each sub-account create a workflow with the triggers Contact Created, Contact Changed and Contact Tag Added, then add a Webhook action that POSTs to the address below. Replace the key with the value of GHL_WEBHOOK_KEY from config.php.
									</p>
								</div>
							</div>
							<div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
								<code className="min-w-0 flex-1 truncate font-mono text-xs">{webhookUrl}</code>
								<Button variant="ghost" size="icon-sm" onClick={() => void copy()} aria-label="Copy webhook address">
									{copied ? <CheckIcon /> : <CopyIcon />}
								</Button>
							</div>
							<div>
								<p className="font-medium">Nightly full sync</p>
								<p className="mt-1 text-muted-foreground text-xs leading-relaxed">Add a cPanel cron job that runs cron/sync.php (see README.md). It reconciles anything a webhook missed.</p>
							</div>
						</Panel>
					</section>

					<section className="flex flex-col gap-3">
						<Eyebrow>Recent webhooks</Eyebrow>
						<Panel>
							{events.length === 0 ? (
								<p className="px-4 py-6 text-center text-muted-foreground text-sm">None received yet.</p>
							) : (
								<ul className="max-h-80 divide-y overflow-y-auto">
									{events.map((e) => (
										<li key={e.id} className="flex items-center gap-3 px-4 py-2 text-xs">
											<StatusPill tone={e.processed ? "ok" : "bad"}>{e.processed ? "ok" : "failed"}</StatusPill>
											<span className="min-w-0 flex-1 truncate">
												<span className="font-medium">{e.type ?? "update"}</span> <span className="text-muted-foreground">· {e.source} · {e.contactId ?? "no contact"}</span>
												{e.error && <span className="block truncate text-destructive">{e.error}</span>}
											</span>
											<span className="font-mono text-muted-foreground" title={formatDateTime(e.receivedAt)}>
												{timeAgo(e.receivedAt)}
											</span>
										</li>
									))}
								</ul>
							)}
						</Panel>
					</section>
				</div>
			</div>
		</>
	);
}
