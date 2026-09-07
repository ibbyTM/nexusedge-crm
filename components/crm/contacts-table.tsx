"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon, SearchIcon, TagIcon, UsersIcon, XIcon } from "lucide-react";

import { api, errorMessage } from "@/lib/api";
import { useAppState } from "@/lib/app-state";
import { useToast } from "@/lib/toast";
import { contactDisplayName, initials, timeAgo } from "@/lib/format";
import type { Contact, ContactsPage, Location } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/native-select";
import { EmptyState, PageTitle, Panel, Skeleton } from "@/components/crm/primitives";
import { RunAutomationMenu } from "@/components/crm/run-automation-menu";
import { NewContactDialog } from "@/components/crm/new-contact-dialog";
import { TagPickerDialog } from "@/components/crm/tag-picker-dialog";

const PAGE_SIZE = 50;

export function ContactsTable() {
	const { location } = useAppState();
	if (!location) {
		return (
			<>
				<PageTitle eyebrow="Contacts" title="Contacts" />
				<Panel>
					<EmptyState icon={UsersIcon} title="No sub-account selected" description="Run a sync under Settings to mirror your first sub-account." />
				</Panel>
			</>
		);
	}
	// Keyed by sub-account so every filter, page and selection resets on switch.
	return <ContactsTableForLocation key={location.id} location={location} />;
}

function ContactsTableForLocation({ location }: { location: Location }) {
	const { meta, refreshMeta, refreshLocations } = useAppState();
	const { toast } = useToast();
	const [q, setQ] = useState("");
	const [debouncedQ, setDebouncedQ] = useState("");
	const [tag, setTagState] = useState("");
	const [assignedTo, setAssignedToState] = useState("");
	const [sort, setSortState] = useState<"updated" | "added" | "name">("updated");
	const [page, setPage] = useState(1);
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [seenQ, setSeenQ] = useState("");
	if (debouncedQ !== seenQ) {
		// A new search term always starts from page one.
		setSeenQ(debouncedQ);
		setPage(1);
		setSelected(new Set());
	}
	const resetPaging = () => {
		setPage(1);
		setSelected(new Set());
	};
	const setTag = (v: string) => {
		setTagState(v);
		resetPaging();
	};
	const setAssignedTo = (v: string) => {
		setAssignedToState(v);
		resetPaging();
	};
	const setSort = (v: "updated" | "added" | "name") => {
		setSortState(v);
		resetPaging();
	};
	const [data, setData] = useState<ContactsPage | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [tagDialog, setTagDialog] = useState<"add" | "remove" | null>(null);
	const [newOpen, setNewOpen] = useState(false);
	const requestId = useRef(0);

	useEffect(() => {
		const t = setTimeout(() => setDebouncedQ(q.trim()), 250);
		return () => clearTimeout(t);
	}, [q]);

	const load = useCallback(async () => {
		const id = ++requestId.current;
		setLoading(true);
		setError(null);
		try {
			const res = await api.contacts.list({ locationId: location.id, q: debouncedQ, tag, assignedTo, sort, dir: sort === "name" ? "asc" : "desc", page, pageSize: PAGE_SIZE });
			if (id === requestId.current) setData(res);
		} catch (err) {
			if (id === requestId.current) setError(errorMessage(err));
		} finally {
			if (id === requestId.current) setLoading(false);
		}
	}, [location, debouncedQ, tag, assignedTo, sort, page]);

	useEffect(() => {
		// eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on mount; state is set after the request resolves
		void load();
	}, [load]);

	const contacts = data?.contacts ?? [];
	const total = data?.total ?? 0;
	const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
	const allOnPageSelected = contacts.length > 0 && contacts.every((c) => selected.has(c.id));
	const usersById = useMemo(() => new Map((meta?.users ?? []).map((u) => [u.id, u])), [meta]);

	const toggleAll = () => {
		setSelected((prev) => {
			const next = new Set(prev);
			if (allOnPageSelected) contacts.forEach((c) => next.delete(c.id));
			else contacts.forEach((c) => next.add(c.id));
			return next;
		});
	};
	const toggleOne = (id: string) =>
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});

	const applyBulkTags = async (tags: string[]) => {
		if (!tagDialog) return;
		const ids = Array.from(selected);
		try {
			const { results } = await api.contacts.bulkTags(ids, tagDialog === "add" ? tags : [], tagDialog === "remove" ? tags : []);
			const failed = results.filter((r) => !r.ok);
			if (failed.length === 0) toast({ tone: "ok", title: `${tagDialog === "add" ? "Added" : "Removed"} ${tags.join(", ")} for ${ids.length} contacts` });
			else toast({ tone: "bad", title: `${failed.length} of ${ids.length} failed`, detail: failed[0].error });
			setTagDialog(null);
			setSelected(new Set());
			await Promise.all([load(), refreshMeta()]);
		} catch (err) {
			toast({ tone: "bad", title: "Could not update tags", detail: errorMessage(err) });
		}
	};

	return (
		<>
			<PageTitle
				eyebrow={location.name}
				title="Contacts"
				description={`${total.toLocaleString()} ${total === 1 ? "contact" : "contacts"} in the mirror. Changes you make here are written to HighLevel first.`}
				actions={
					<Button onClick={() => setNewOpen(true)}>
						<PlusIcon data-icon="inline-start" />
						New contact
					</Button>
				}
			/>

			<div className="flex flex-col gap-3">
				<div className="flex flex-col gap-2 md:flex-row md:items-center">
					<div className="relative flex-1">
						<SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
						<Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, phone or company" className="pl-8" aria-label="Search contacts" />
						{q && (
							<button type="button" onClick={() => setQ("")} aria-label="Clear search" className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground">
								<XIcon className="size-3.5" />
							</button>
						)}
					</div>
					<div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:flex">
						<NativeSelect value={tag} onChange={(e) => setTag(e.target.value)} aria-label="Filter by tag" className="md:w-44">
							<option value="">All tags</option>
							{(meta?.tagCounts ?? []).map((t) => (
								<option key={t.tag} value={t.tag}>
									{t.tag} ({t.count})
								</option>
							))}
						</NativeSelect>
						<NativeSelect value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} aria-label="Filter by owner" className="md:w-44">
							<option value="">Anyone</option>
							{(meta?.users ?? []).map((u) => (
								<option key={u.id} value={u.id}>
									{u.name || u.email || u.id}
								</option>
							))}
						</NativeSelect>
						<NativeSelect value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort" className="col-span-2 sm:col-span-1 md:w-40">
							<option value="updated">Recently updated</option>
							<option value="added">Recently added</option>
							<option value="name">Last name</option>
						</NativeSelect>
					</div>
				</div>

				{selected.size > 0 && (
					<div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
						<span className="font-mono text-primary text-xs uppercase tracking-wider">{selected.size} selected</span>
						<div className="ml-auto flex flex-wrap items-center gap-2">
							<Button variant="outline" size="sm" onClick={() => setTagDialog("add")}>
								<TagIcon data-icon="inline-start" />
								Add tag
							</Button>
							<Button variant="outline" size="sm" onClick={() => setTagDialog("remove")}>
								Remove tag
							</Button>
							<RunAutomationMenu contactIds={Array.from(selected).slice(0, 50)} size="sm" onDone={() => void load()} />
							<Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
								Clear
							</Button>
						</div>
						{selected.size > 50 && <p className="w-full text-muted-foreground text-xs">Automations run on the first 50 selected contacts per batch.</p>}
					</div>
				)}

				<Panel className="overflow-hidden">
					{error ? (
						<EmptyState icon={UsersIcon} title="Could not load contacts" description={error} action={<Button variant="outline" onClick={() => void load()}>Retry</Button>} />
					) : data && contacts.length === 0 && !loading ? (
						<EmptyState
							icon={UsersIcon}
							title={debouncedQ || tag || assignedTo ? "No contacts match" : "No contacts mirrored yet"}
							description={debouncedQ || tag || assignedTo ? "Try a different search or clear the filters." : "Run a contacts sync for this sub-account under Settings."}
						/>
					) : (
						<div className="overflow-x-auto">
							<table className="w-full min-w-[720px] text-sm">
								<thead>
									<tr className="border-b bg-muted/40 text-left font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
										<th className="w-10 px-3 py-2.5">
											<input type="checkbox" aria-label="Select all on page" checked={allOnPageSelected} onChange={toggleAll} className="size-4 accent-primary" />
										</th>
										<th className="px-3 py-2.5 font-medium">Name</th>
										<th className="px-3 py-2.5 font-medium">Contact</th>
										<th className="px-3 py-2.5 font-medium">Tags</th>
										<th className="px-3 py-2.5 font-medium">Owner</th>
										<th className="px-3 py-2.5 text-right font-medium">Updated</th>
									</tr>
								</thead>
								<tbody className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
									{!data && loading
										? Array.from({ length: 8 }).map((_, i) => (
												<tr key={i} className="border-b last:border-0">
													<td className="px-3 py-3" />
													<td className="px-3 py-3"><Skeleton className="h-4 w-40" /></td>
													<td className="px-3 py-3"><Skeleton className="h-4 w-48" /></td>
													<td className="px-3 py-3"><Skeleton className="h-4 w-24" /></td>
													<td className="px-3 py-3"><Skeleton className="h-4 w-20" /></td>
													<td className="px-3 py-3"><Skeleton className="ml-auto h-4 w-16" /></td>
												</tr>
											))
										: contacts.map((c) => <Row key={c.id} contact={c} selected={selected.has(c.id)} onToggle={() => toggleOne(c.id)} owner={c.assignedTo ? usersById.get(c.assignedTo)?.name ?? null : null} />)}
								</tbody>
							</table>
						</div>
					)}
					{total > 0 && (
						<div className="flex items-center justify-between border-t px-3 py-2 text-muted-foreground text-xs">
							<span>
								{(page - 1) * PAGE_SIZE + 1} to {Math.min(page * PAGE_SIZE, total)} of {total.toLocaleString()}
							</span>
							<div className="flex items-center gap-1">
								<Button variant="ghost" size="icon-sm" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)} aria-label="Previous page">
									<ChevronLeftIcon />
								</Button>
								<span className="font-mono">
									{page} / {pageCount}
								</span>
								<Button variant="ghost" size="icon-sm" disabled={page >= pageCount || loading} onClick={() => setPage((p) => p + 1)} aria-label="Next page">
									<ChevronRightIcon />
								</Button>
							</div>
						</div>
					)}
				</Panel>
			</div>

			<NewContactDialog
				open={newOpen}
				onOpenChange={setNewOpen}
				locationId={location.id}
				onCreated={async () => {
					await Promise.all([load(), refreshLocations()]);
				}}
			/>
			<TagPickerDialog
				key={tagDialog ?? "closed"}
				open={tagDialog !== null}
				onOpenChange={(o) => !o && setTagDialog(null)}
				mode={tagDialog ?? "add"}
				count={selected.size}
				suggestions={(meta?.tags ?? []).map((t) => t.name)}
				onSubmit={applyBulkTags}
			/>
		</>
	);
}

function Row({ contact: c, selected, onToggle, owner }: { contact: Contact; selected: boolean; onToggle: () => void; owner: string | null }) {
	const name = contactDisplayName(c);
	const visibleTags = c.tags.slice(0, 3);
	return (
		<tr className={`border-b transition-colors last:border-0 hover:bg-muted/40 ${selected ? "bg-primary/5" : ""}`}>
			<td className="px-3 py-2.5">
				<input type="checkbox" aria-label={`Select ${name}`} checked={selected} onChange={onToggle} className="size-4 accent-primary" />
			</td>
			<td className="px-3 py-2.5">
				<Link href={`/contacts/view?id=${encodeURIComponent(c.id)}`} className="group flex items-center gap-2.5">
					<span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 font-medium text-[10px] text-primary">{initials(name)}</span>
					<span className="min-w-0">
						<span className="block truncate font-medium group-hover:text-primary">{name}</span>
						{c.companyName && <span className="block truncate text-muted-foreground text-xs">{c.companyName}</span>}
					</span>
				</Link>
			</td>
			<td className="px-3 py-2.5">
				<span className="block truncate">{c.email || <span className="text-muted-foreground">No email</span>}</span>
				<span className="block truncate font-mono text-muted-foreground text-xs">{c.phone}</span>
			</td>
			<td className="px-3 py-2.5">
				<div className="flex flex-wrap items-center gap-1">
					{visibleTags.map((t) => (
						<Badge key={t} variant="secondary">
							{t}
						</Badge>
					))}
					{c.tags.length > 3 && <span className="font-mono text-[10px] text-muted-foreground">+{c.tags.length - 3}</span>}
					{c.dnd && <Badge variant="destructive">DND</Badge>}
				</div>
			</td>
			<td className="px-3 py-2.5 text-muted-foreground">{owner ?? (c.assignedTo ? "Unknown user" : "")}</td>
			<td className="px-3 py-2.5 text-right font-mono text-muted-foreground text-xs">{timeAgo(c.dateUpdated)}</td>
		</tr>
	);
}
