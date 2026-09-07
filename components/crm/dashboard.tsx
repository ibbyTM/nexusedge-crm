"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ActivityIcon, ArrowUpRightIcon, Building2Icon, RefreshCwIcon, TagIcon, UsersIcon, ZapIcon } from "lucide-react";

import { api } from "@/lib/api";
import { useAppState } from "@/lib/app-state";
import { highLevelLocationUrl, timeAgo } from "@/lib/format";
import { sectionContainer, sectionItem } from "@/lib/motion-variants";
import type { AutomationRun } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { GlowCard } from "@/components/glow-card";
import { Eyebrow, IconChip, PageTitle, Panel, StatusPill } from "@/components/crm/primitives";
import { RunsList } from "@/components/crm/runs-list";

export function Dashboard() {
	const { user, locations, location, meta, setLocationId } = useAppState();
	const [runs, setRuns] = useState<AutomationRun[] | null>(null);

	useEffect(() => {
		if (!location) return;
		let cancelled = false;
		api.automations
			.runs({ locationId: location.id, pageSize: 8 })
			.then((r) => !cancelled && setRuns(r.runs))
			.catch(() => !cancelled && setRuns([]));
		return () => {
			cancelled = true;
		};
	}, [location]);

	const contactSync = meta?.sync.contacts;
	const hour = new Date().getHours();
	const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

	return (
		<motion.div variants={sectionContainer} initial="hidden" animate="show" className="flex flex-col gap-6">
			<motion.div variants={sectionItem}>
				<PageTitle
					eyebrow="Dashboard"
					title={`${greeting}, ${user?.name.split(" ")[0] ?? ""}`}
					description={location ? `You are working in ${location.name}. Switch sub-accounts from the sidebar.` : "Sync a sub-account to get started."}
					actions={
						location && (
							<Button asChild>
								<Link href="/contacts">
									<UsersIcon data-icon="inline-start" />
									Open contacts
								</Link>
							</Button>
						)
					}
				/>
			</motion.div>

			{location && (
				<motion.div variants={sectionItem} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
					<Stat icon={UsersIcon} label="Contacts" value={location.contactCount.toLocaleString()} hint={`Mirrored ${timeAgo(contactSync?.last_finished_at)}`} />
					<Stat icon={TagIcon} label="Tags in use" value={String(meta?.tagCounts.length ?? 0)} hint={`${meta?.tags.length ?? 0} defined in HighLevel`} />
					<Stat icon={ZapIcon} label="Automations" value={String(meta?.buttons.length ?? 0)} hint={`${meta?.workflows.filter((w) => w.status === "published").length ?? 0} published workflows`} />
					<Stat
						icon={RefreshCwIcon}
						label="Sync"
						value={contactSync?.status === "running" ? "Running" : contactSync?.status === "error" ? "Error" : contactSync?.status === "done" ? "Healthy" : "Not run"}
						hint={contactSync?.last_error ?? `Metadata ${timeAgo(meta?.sync.meta.last_finished_at)}`}
						tone={contactSync?.status === "error" ? "bad" : contactSync?.status === "done" ? "ok" : "muted"}
					/>
				</motion.div>
			)}

			<div className="grid gap-6 lg:grid-cols-5">
				<motion.section variants={sectionItem} className="flex flex-col gap-3 lg:col-span-3">
					<div className="flex items-center justify-between">
						<Eyebrow>Sub-accounts</Eyebrow>
						<Button variant="ghost" size="sm" asChild>
							<Link href="/settings/sync">Manage</Link>
						</Button>
					</div>
					{locations.length === 0 ? (
						<Panel className="p-8 text-center">
							<IconChip icon={Building2Icon} size="lg" className="mx-auto" />
							<p className="mt-3 font-heading font-medium">No sub-accounts mirrored yet</p>
							<p className="mt-1 text-muted-foreground text-sm">Run the first sync to pull your sub-accounts, tags, custom fields and contacts.</p>
							<Button className="mt-4" asChild>
								<Link href="/settings/sync">Go to sync</Link>
							</Button>
						</Panel>
					) : (
						<div className="grid gap-3 sm:grid-cols-2">
							{locations.map((l) => {
								const active = l.id === location?.id;
								return (
									<GlowCard key={l.id} className={`rounded-xl border bg-card p-4 transition-colors ${active ? "border-primary/40" : ""}`}>
										<div className="flex items-start justify-between gap-3">
											<div className="flex items-center gap-3">
												<IconChip icon={Building2Icon} />
												<div className="min-w-0">
													<p className="truncate font-heading font-medium">{l.name}</p>
													<p className="truncate text-muted-foreground text-xs">{[l.city, l.country].filter(Boolean).join(", ") || l.timezone || l.id}</p>
												</div>
											</div>
											{active && <StatusPill tone="ok">Active</StatusPill>}
										</div>
										<div className="mt-4 flex items-end justify-between">
											<div>
												<p className="font-heading text-2xl leading-none">{l.contactCount.toLocaleString()}</p>
												<p className="mt-1 font-mono text-[10px] text-muted-foreground uppercase tracking-widest">contacts</p>
											</div>
											<div className="flex items-center gap-1">
												{!active && (
													<Button variant="outline" size="sm" onClick={() => setLocationId(l.id)}>
														Switch
													</Button>
												)}
												<Button variant="ghost" size="icon-sm" asChild>
													<a href={highLevelLocationUrl(l.id)} target="_blank" rel="noreferrer" aria-label="Open in HighLevel">
														<ArrowUpRightIcon />
													</a>
												</Button>
											</div>
										</div>
									</GlowCard>
								);
							})}
						</div>
					)}
				</motion.section>

				<motion.section variants={sectionItem} className="flex flex-col gap-3 lg:col-span-2">
					<div className="flex items-center justify-between">
						<Eyebrow>Recent automation runs</Eyebrow>
						<Button variant="ghost" size="sm" asChild>
							<Link href="/automations">All runs</Link>
						</Button>
					</div>
					<Panel>
						<RunsList runs={runs} compact emptyIcon={ActivityIcon} emptyTitle="No runs yet" emptyDescription="Open a contact and use Run automation to start one." />
					</Panel>
				</motion.section>
			</div>
		</motion.div>
	);
}

function Stat({ icon, label, value, hint, tone }: { icon: typeof UsersIcon; label: string; value: string; hint?: string; tone?: "ok" | "bad" | "muted" }) {
	return (
		<GlowCard className="rounded-xl border bg-card p-4">
			<div className="flex items-center justify-between">
				<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">{label}</span>
				<IconChip icon={icon} size="sm" />
			</div>
			<p className={`mt-3 font-heading text-2xl leading-none ${tone === "bad" ? "text-destructive" : ""}`}>{value}</p>
			{hint && <p className="mt-1.5 truncate text-muted-foreground text-xs">{hint}</p>}
		</GlowCard>
	);
}
