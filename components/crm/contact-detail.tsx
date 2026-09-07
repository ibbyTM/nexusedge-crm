"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeftIcon, ArrowUpRightIcon, CheckIcon, CircleAlertIcon, ClipboardListIcon, MailIcon, PhoneIcon, RefreshCwIcon, StickyNoteIcon, Trash2Icon, XIcon, ZapIcon } from "lucide-react";

import { api, errorMessage } from "@/lib/api";
import { useAppState } from "@/lib/app-state";
import { useToast } from "@/lib/toast";
import { contactDisplayName, formatDate, formatDateTime, highLevelContactUrl, initials, timeAgo } from "@/lib/format";
import type { AutomationRun, Contact, CustomField, Note, Task } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { NativeSelect } from "@/components/ui/native-select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, Eyebrow, Field, InlineError, Panel, Skeleton, StatusPill } from "@/components/crm/primitives";
import { RunAutomationMenu } from "@/components/crm/run-automation-menu";
import { RunsList } from "@/components/crm/runs-list";

type Detail = { contact: Contact; notes: Note[]; tasks: Task[]; runs: AutomationRun[]; warning: string | null };

const STANDARD_FIELDS: { key: keyof Contact; label: string; type?: string; span?: boolean }[] = [
	{ key: "firstName", label: "First name" },
	{ key: "lastName", label: "Last name" },
	{ key: "email", label: "Email", type: "email" },
	{ key: "phone", label: "Phone", type: "tel" },
	{ key: "companyName", label: "Company", span: true },
	{ key: "address1", label: "Address", span: true },
	{ key: "city", label: "City" },
	{ key: "state", label: "County or state" },
	{ key: "postalCode", label: "Postcode" },
	{ key: "country", label: "Country code" },
	{ key: "website", label: "Website", type: "url", span: true },
	{ key: "source", label: "Source" },
];

export function ContactDetail() {
	const params = useSearchParams();
	const id = params.get("id") ?? "";
	const router = useRouter();
	const { user, meta, location, setLocationId, locations, refreshMeta } = useAppState();
	const currentLocationId = location?.id;
	const { toast } = useToast();
	const [detail, setDetail] = useState<Detail | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [refreshing, setRefreshing] = useState(false);
	const [deleteOpen, setDeleteOpen] = useState(false);

	const load = useCallback(
		async (refresh = false) => {
			if (!id) return;
			setRefreshing(refresh);
			try {
				const d = await api.contacts.get(id, refresh);
				setDetail(d);
				setError(null);
				if (d.contact.locationId !== currentLocationId && locations.some((l) => l.id === d.contact.locationId)) setLocationId(d.contact.locationId);
			} catch (err) {
				setError(errorMessage(err));
			} finally {
				setRefreshing(false);
			}
		},
		[id, currentLocationId, locations, setLocationId]
	);

	useEffect(() => {
		// eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on mount; state is set after the request resolves
		void load();
	}, [load]);

	const reloadRuns = useCallback(async () => {
		const res = await api.automations.runs({ contactId: id, pageSize: 20 });
		setDetail((d) => (d ? { ...d, runs: res.runs } : d));
	}, [id]);

	const onDelete = async () => {
		try {
			await api.contacts.remove(id);
			toast({ tone: "ok", title: "Contact deleted" });
			router.push("/contacts");
		} catch (err) {
			toast({ tone: "bad", title: "Could not delete", detail: errorMessage(err) });
		}
	};

	if (!id) return <EmptyState icon={CircleAlertIcon} title="No contact id" action={<Button asChild><Link href="/contacts">Back to contacts</Link></Button>} />;
	if (error) return <EmptyState icon={CircleAlertIcon} title="Could not load this contact" description={error} action={<Button variant="outline" onClick={() => void load()}>Retry</Button>} />;
	if (!detail) return <DetailSkeleton />;

	const { contact } = detail;
	const name = contactDisplayName(contact);

	return (
		<div className="flex flex-col gap-6">
			<div>
				<Button variant="ghost" size="sm" asChild className="-ml-2">
					<Link href="/contacts">
						<ArrowLeftIcon data-icon="inline-start" />
						Contacts
					</Link>
				</Button>
			</div>

			<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
				<div className="flex items-start gap-4">
					<span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 font-heading text-lg text-primary">{initials(name)}</span>
					<div className="min-w-0">
						<Eyebrow>{location?.name ?? contact.locationId}</Eyebrow>
						<h1 className="mt-1 truncate font-heading font-medium text-2xl leading-tight tracking-tight">{name}</h1>
						<div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground text-sm">
							{contact.companyName && <span>{contact.companyName}</span>}
							{contact.email && (
								<a href={`mailto:${contact.email}`} className="inline-flex items-center gap-1 hover:text-foreground">
									<MailIcon className="size-3.5" />
									{contact.email}
								</a>
							)}
							{contact.phone && (
								<a href={`tel:${contact.phone}`} className="inline-flex items-center gap-1 font-mono text-xs hover:text-foreground">
									<PhoneIcon className="size-3.5" />
									{contact.phone}
								</a>
							)}
						</div>
						<div className="mt-2 flex flex-wrap items-center gap-1.5">
							{contact.dnd && <StatusPill tone="bad">Do not disturb</StatusPill>}
							<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Added {formatDate(contact.dateAdded)} · Updated {timeAgo(contact.dateUpdated)}</span>
						</div>
					</div>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<RunAutomationMenu contactIds={[contact.id]} onDone={() => void reloadRuns()} />
					<Button variant="outline" onClick={() => void load(true)} disabled={refreshing} aria-label="Refresh from HighLevel">
						<RefreshCwIcon data-icon="inline-start" className={refreshing ? "animate-spin" : ""} />
						Refresh
					</Button>
					<Button variant="outline" asChild>
						<a href={highLevelContactUrl(contact.locationId, contact.id)} target="_blank" rel="noreferrer">
							Open in HighLevel
							<ArrowUpRightIcon data-icon="inline-end" />
						</a>
					</Button>
					{user?.role === "admin" && (
						<Button variant="ghost" size="icon" aria-label="Delete contact" onClick={() => setDeleteOpen(true)}>
							<Trash2Icon />
						</Button>
					)}
				</div>
			</div>

			{detail.warning && (
				<p className="flex items-center gap-2 rounded-lg border border-[color:var(--dashboard-yellow)]/40 bg-card px-3 py-2 text-sm">
					<CircleAlertIcon className="size-4 text-[color:var(--dashboard-yellow)]" />
					Showing mirrored data. HighLevel said: {detail.warning}
				</p>
			)}

			<div className="grid gap-6 lg:grid-cols-5">
				<div className="flex flex-col gap-6 lg:col-span-3">
					<TagsEditor contact={contact} suggestions={(meta?.tags ?? []).map((t) => t.name)} onChange={(c) => { setDetail((d) => (d ? { ...d, contact: c } : d)); void refreshMeta(); }} />
					<DetailsForm
						key={`${contact.id}:${contact.dateUpdated}:${contact.syncedAt}`}
						contact={contact}
						customFields={meta?.customFields ?? []}
						users={meta?.users ?? []}
						onSaved={(c) => setDetail((d) => (d ? { ...d, contact: c } : d))}
					/>
				</div>
				<div className="flex flex-col gap-6 lg:col-span-2">
					<NotesPanel contactId={contact.id} notes={detail.notes} users={meta?.users ?? []} onChange={(notes) => setDetail((d) => (d ? { ...d, notes } : d))} />
					<TasksPanel tasks={detail.tasks} users={meta?.users ?? []} />
					<Panel>
						<div className="flex items-center justify-between border-b px-4 py-3">
							<h2 className="flex items-center gap-2 font-heading font-medium text-sm">
								<ZapIcon className="size-4 text-primary" />
								Automation runs
							</h2>
							<Button variant="ghost" size="xs" asChild>
								<Link href="/automations">All</Link>
							</Button>
						</div>
						<RunsList runs={detail.runs} compact showContact={false} emptyTitle="No automations run yet" emptyDescription="Use Run automation above to start one." />
					</Panel>
				</div>
			</div>

			<Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
				<DialogContent size="sm">
					<DialogHeader>
						<DialogTitle>Delete {name}?</DialogTitle>
						<DialogDescription>This deletes the contact in HighLevel as well. It cannot be undone.</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
						<Button variant="destructive" onClick={() => void onDelete()}>Delete contact</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

function DetailSkeleton() {
	return (
		<div className="flex flex-col gap-6">
			<Skeleton className="h-6 w-24" />
			<div className="flex items-center gap-4">
				<Skeleton className="size-14 rounded-xl" />
				<div className="flex flex-col gap-2">
					<Skeleton className="h-3 w-28" />
					<Skeleton className="h-7 w-56" />
					<Skeleton className="h-4 w-72" />
				</div>
			</div>
			<div className="grid gap-6 lg:grid-cols-5">
				<Skeleton className="h-96 lg:col-span-3" />
				<Skeleton className="h-96 lg:col-span-2" />
			</div>
		</div>
	);
}

function TagsEditor({ contact, suggestions, onChange }: { contact: Contact; suggestions: string[]; onChange: (c: Contact) => void }) {
	const { toast } = useToast();
	const [input, setInput] = useState("");
	const [busy, setBusy] = useState(false);

	const change = async (add: string[], remove: string[]) => {
		setBusy(true);
		try {
			const { contact: updated } = await api.contacts.tags(contact.id, add, remove);
			onChange(updated);
			setInput("");
		} catch (err) {
			toast({ tone: "bad", title: "Could not update tags", detail: errorMessage(err) });
		} finally {
			setBusy(false);
		}
	};

	const filtered = suggestions.filter((s) => !contact.tags.includes(s) && (!input || s.toLowerCase().includes(input.toLowerCase()))).slice(0, 8);

	return (
		<Panel className="p-4">
			<div className="flex items-center justify-between">
				<h2 className="font-heading font-medium text-sm">Tags</h2>
				<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">{contact.tags.length}</span>
			</div>
			<div className="mt-3 flex flex-wrap items-center gap-1.5">
				{contact.tags.map((t) => (
					<Badge key={t} variant="secondary" className="pr-1">
						{t}
						<button type="button" disabled={busy} onClick={() => void change([], [t])} aria-label={`Remove ${t}`} className="ml-0.5 rounded-full p-0.5 hover:bg-foreground/10 disabled:opacity-50">
							<XIcon className="size-3" />
						</button>
					</Badge>
				))}
				<form
					onSubmit={(e) => {
						e.preventDefault();
						if (input.trim()) void change([input.trim()], []);
					}}
					className="flex items-center gap-1"
				>
					<Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Add tag" disabled={busy} className="h-7 w-36 text-xs" list="tag-suggestions" />
					<datalist id="tag-suggestions">
						{filtered.map((s) => (
							<option key={s} value={s} />
						))}
					</datalist>
					<Button type="submit" size="icon-sm" variant="outline" disabled={busy || !input.trim()} aria-label="Add tag">
						<CheckIcon />
					</Button>
				</form>
			</div>
		</Panel>
	);
}

function DetailsForm({ contact, customFields, users, onSaved }: { contact: Contact; customFields: CustomField[]; users: { id: string; name: string | null; email: string | null }[]; onSaved: (c: Contact) => void }) {
	const { toast } = useToast();
	// The parent remounts this form (via key) whenever the contact changes, so
	// the initial snapshot only needs computing once per mount.
	const initial = useMemo(() => toFormState(contact, customFields), [contact, customFields]);
	const [form, setForm] = useState(initial);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const dirty = JSON.stringify(form) !== JSON.stringify(initial);

	const submit = async (e: FormEvent) => {
		e.preventDefault();
		if (!dirty) return;
		setSaving(true);
		setError(null);
		const patch: Record<string, unknown> = {};
		for (const f of STANDARD_FIELDS) {
			if (form.fields[f.key] !== initial.fields[f.key]) patch[f.key] = form.fields[f.key];
		}
		if (form.assignedTo !== initial.assignedTo) patch.assignedTo = form.assignedTo || null;
		if (form.dnd !== initial.dnd) patch.dnd = form.dnd;
		const changedCustom = customFields.filter((cf) => form.custom[cf.id] !== initial.custom[cf.id]).map((cf) => ({ id: cf.id, value: form.custom[cf.id] }));
		if (changedCustom.length) patch.customFields = changedCustom;
		try {
			const { contact: updated } = await api.contacts.update(contact.id, patch);
			onSaved(updated);
			toast({ tone: "ok", title: "Contact saved" });
		} catch (err) {
			setError(errorMessage(err));
		} finally {
			setSaving(false);
		}
	};

	return (
		<form onSubmit={submit}>
			<Panel>
				<div className="flex items-center justify-between border-b px-4 py-3">
					<h2 className="font-heading font-medium text-sm">Details</h2>
					<div className="flex items-center gap-2">
						{dirty && (
							<Button type="button" variant="ghost" size="sm" onClick={() => setForm(initial)} disabled={saving}>
								Discard
							</Button>
						)}
						<Button type="submit" size="sm" disabled={!dirty || saving}>
							{saving ? "Saving" : "Save changes"}
						</Button>
					</div>
				</div>
				<div className="grid gap-4 p-4 sm:grid-cols-2">
					{STANDARD_FIELDS.map((f) => (
						<Field key={f.key} label={f.label} htmlFor={`f-${f.key}`} className={f.span ? "sm:col-span-2" : undefined}>
							<Input id={`f-${f.key}`} type={f.type ?? "text"} value={form.fields[f.key]} onChange={(e) => setForm((s) => ({ ...s, fields: { ...s.fields, [f.key]: e.target.value } }))} />
						</Field>
					))}
					<Field label="Owner" htmlFor="f-owner">
						<NativeSelect id="f-owner" value={form.assignedTo} onChange={(e) => setForm((s) => ({ ...s, assignedTo: e.target.value }))}>
							<option value="">Unassigned</option>
							{users.map((u) => (
								<option key={u.id} value={u.id}>
									{u.name || u.email || u.id}
								</option>
							))}
							{form.assignedTo && !users.some((u) => u.id === form.assignedTo) && <option value={form.assignedTo}>Unknown user ({form.assignedTo})</option>}
						</NativeSelect>
					</Field>
					<div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 sm:mt-6">
						<div>
							<p className="font-medium text-sm">Do not disturb</p>
							<p className="text-muted-foreground text-xs">Stops every outbound channel.</p>
						</div>
						<Switch checked={form.dnd} onCheckedChange={(v) => setForm((s) => ({ ...s, dnd: v }))} aria-label="Do not disturb" />
					</div>
				</div>

				{customFields.length > 0 && (
					<>
						<div className="border-t px-4 py-3">
							<h3 className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">Custom fields</h3>
						</div>
						<div className="grid gap-4 px-4 pb-4 sm:grid-cols-2">
							{customFields.map((cf) => (
								<CustomFieldInput key={cf.id} field={cf} value={form.custom[cf.id] ?? ""} onChange={(v) => setForm((s) => ({ ...s, custom: { ...s.custom, [cf.id]: v } }))} />
							))}
						</div>
					</>
				)}
				{error && (
					<div className="border-t px-4 py-3">
						<InlineError message={error} />
					</div>
				)}
			</Panel>
		</form>
	);
}

type FormState = { fields: Record<string, string>; assignedTo: string; dnd: boolean; custom: Record<string, string> };

function toFormState(contact: Contact, customFields: CustomField[]): FormState {
	const fields: Record<string, string> = {};
	for (const f of STANDARD_FIELDS) fields[f.key] = (contact[f.key] as string | null) ?? "";
	const custom: Record<string, string> = {};
	const values = new Map(contact.customFields.map((v) => [v.id, v.value]));
	for (const cf of customFields) {
		const v = values.get(cf.id);
		custom[cf.id] = v === null || v === undefined ? "" : Array.isArray(v) ? v.join(", ") : typeof v === "object" ? JSON.stringify(v) : String(v);
	}
	return { fields, assignedTo: contact.assignedTo ?? "", dnd: contact.dnd, custom };
}

function CustomFieldInput({ field, value, onChange }: { field: CustomField; value: string; onChange: (v: string) => void }) {
	const id = `cf-${field.id}`;
	const type = (field.dataType ?? "").toUpperCase();
	if (type === "LARGE_TEXT" || type === "TEXTAREA") {
		return (
			<Field label={field.name} htmlFor={id} className="sm:col-span-2">
				<Textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder ?? undefined} rows={3} />
			</Field>
		);
	}
	if ((type === "SINGLE_OPTIONS" || type === "RADIO" || type === "SELECT") && field.picklistOptions?.length) {
		return (
			<Field label={field.name} htmlFor={id}>
				<NativeSelect id={id} value={value} onChange={(e) => onChange(e.target.value)}>
					<option value="">Not set</option>
					{field.picklistOptions.map((o) => (
						<option key={o} value={o}>
							{o}
						</option>
					))}
					{value && !field.picklistOptions.includes(value) && <option value={value}>{value}</option>}
				</NativeSelect>
			</Field>
		);
	}
	if (type === "CHECKBOX" || type === "MULTIPLE_OPTIONS") {
		return (
			<Field label={field.name} htmlFor={id} hint="Comma separated">
				<Input id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={field.picklistOptions?.join(", ")} />
			</Field>
		);
	}
	const inputType = type === "NUMERICAL" || type === "MONETORY" || type === "MONETARY" ? "number" : type === "DATE" ? "date" : type === "PHONE" ? "tel" : type === "EMAIL" ? "email" : "text";
	return (
		<Field label={field.name} htmlFor={id}>
			<Input id={id} type={inputType} value={value} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder ?? undefined} />
		</Field>
	);
}

function NotesPanel({ contactId, notes, users, onChange }: { contactId: string; notes: Note[]; users: { id: string; name: string | null }[]; onChange: (n: Note[]) => void }) {
	const { toast } = useToast();
	const [body, setBody] = useState("");
	const [busy, setBusy] = useState(false);
	const userName = (id: string | null) => (id ? users.find((u) => u.id === id)?.name ?? "Team" : "Team");

	const submit = async (e: FormEvent) => {
		e.preventDefault();
		if (!body.trim()) return;
		setBusy(true);
		try {
			const res = await api.contacts.addNote(contactId, body.trim());
			onChange(res.notes);
			setBody("");
		} catch (err) {
			toast({ tone: "bad", title: "Could not add the note", detail: errorMessage(err) });
		} finally {
			setBusy(false);
		}
	};

	return (
		<Panel>
			<div className="flex items-center justify-between border-b px-4 py-3">
				<h2 className="flex items-center gap-2 font-heading font-medium text-sm">
					<StickyNoteIcon className="size-4 text-primary" />
					Notes
				</h2>
				<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">{notes.length}</span>
			</div>
			<form onSubmit={submit} className="flex flex-col gap-2 border-b p-3">
				<Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Add a note. It is saved to the contact in HighLevel." rows={3} disabled={busy} />
				<div className="flex justify-end">
					<Button type="submit" size="sm" disabled={busy || !body.trim()}>
						{busy ? "Saving" : "Add note"}
					</Button>
				</div>
			</form>
			{notes.length === 0 ? (
				<p className="px-4 py-6 text-center text-muted-foreground text-sm">No notes yet.</p>
			) : (
				<ul className="max-h-96 divide-y overflow-y-auto">
					{notes.map((n) => (
						<li key={n.id} className="px-4 py-3">
							<p className="whitespace-pre-wrap text-sm">{n.body}</p>
							<p className="mt-1 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
								{userName(n.userId)} · <span title={formatDateTime(n.dateAdded)}>{timeAgo(n.dateAdded)}</span>
							</p>
						</li>
					))}
				</ul>
			)}
		</Panel>
	);
}

function TasksPanel({ tasks, users }: { tasks: Task[]; users: { id: string; name: string | null }[] }) {
	const userName = (id: string | null) => (id ? users.find((u) => u.id === id)?.name ?? null : null);
	return (
		<Panel>
			<div className="flex items-center justify-between border-b px-4 py-3">
				<h2 className="flex items-center gap-2 font-heading font-medium text-sm">
					<ClipboardListIcon className="size-4 text-primary" />
					Tasks
				</h2>
				<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">{tasks.filter((t) => !t.completed).length} open</span>
			</div>
			{tasks.length === 0 ? (
				<p className="px-4 py-6 text-center text-muted-foreground text-sm">No tasks. Create tasks in HighLevel; they show up here.</p>
			) : (
				<ul className="divide-y">
					{tasks.map((t) => (
						<li key={t.id} className="flex items-start gap-3 px-4 py-3">
							<span className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-sm border ${t.completed ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{t.completed && <CheckIcon className="size-3" />}</span>
							<div className="min-w-0 flex-1">
								<p className={`text-sm ${t.completed ? "text-muted-foreground line-through" : "font-medium"}`}>{t.title || "Untitled task"}</p>
								{t.body && <p className="mt-0.5 text-muted-foreground text-xs">{t.body}</p>}
								<p className="mt-1 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
									{t.dueDate ? `Due ${formatDate(t.dueDate)}` : "No due date"}
									{userName(t.assignedTo) && ` · ${userName(t.assignedTo)}`}
								</p>
							</div>
						</li>
					))}
				</ul>
			)}
		</Panel>
	);
}
