"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { PencilIcon, PlusIcon, Trash2Icon, ZapIcon } from "lucide-react";

import { api, errorMessage } from "@/lib/api";
import { useAppState } from "@/lib/app-state";
import { useToast } from "@/lib/toast";
import type { AutomationButton, LocationMeta, Mechanism } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { NativeSelect } from "@/components/ui/native-select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, Field, InlineError, PageTitle, Panel, Skeleton, StatusPill } from "@/components/crm/primitives";
import { buttonIcon, BUTTON_ICONS } from "@/components/crm/button-icons";

const MECHANISMS: { value: Mechanism; label: string; help: string }[] = [
	{ value: "workflow", label: "Add to a workflow", help: "Enrols the contact in a workflow you have published in HighLevel. The usual choice." },
	{ value: "webhook", label: "Call an inbound webhook", help: "Posts JSON to a workflow that starts with the Inbound Webhook trigger. Use this to pass custom data." },
	{ value: "tag", label: "Add a tag", help: "Adds a tag. Any workflow that triggers on Contact Tag Added runs, with no changes in HighLevel." },
];

type FormState = {
	label: string;
	description: string;
	icon: string;
	mechanism: Mechanism;
	locationId: string;
	workflowId: string;
	webhookUrl: string;
	tagName: string;
	payloadTemplate: string;
	minRole: "member" | "admin";
	confirmText: string;
	sortOrder: string;
	enabled: boolean;
};

const DEFAULT_TEMPLATE = `{
  "contact_id": "{{contact.id}}",
  "email": "{{contact.email}}",
  "phone": "{{contact.phone}}",
  "first_name": "{{contact.firstName}}",
  "last_name": "{{contact.lastName}}",
  "triggered_by": "{{user.email}}"
}`;

function emptyForm(locationId: string): FormState {
	return { label: "", description: "", icon: "zap", mechanism: "workflow", locationId, workflowId: "", webhookUrl: "", tagName: "", payloadTemplate: "", minRole: "member", confirmText: "", sortOrder: "0", enabled: true };
}

function toForm(b: AutomationButton): FormState {
	return {
		label: b.label,
		description: b.description ?? "",
		icon: b.icon,
		mechanism: b.mechanism,
		locationId: b.locationId ?? "",
		workflowId: b.workflowId ?? "",
		webhookUrl: b.webhookUrl ?? "",
		tagName: b.tagName ?? "",
		payloadTemplate: b.payloadTemplate ?? "",
		minRole: b.minRole,
		confirmText: b.confirmText ?? "",
		sortOrder: String(b.sortOrder),
		enabled: b.enabled,
	};
}

export function AutomationButtonsSettings() {
	const { locations, location, refreshMeta } = useAppState();
	const { toast } = useToast();
	const [buttons, setButtons] = useState<AutomationButton[] | null>(null);
	const [editing, setEditing] = useState<AutomationButton | "new" | null>(null);
	const [deleting, setDeleting] = useState<AutomationButton | null>(null);

	const load = useCallback(async () => {
		try {
			const res = await api.automations.buttons(undefined, true);
			setButtons(res.buttons);
		} catch (err) {
			toast({ tone: "bad", title: "Could not load buttons", detail: errorMessage(err) });
			setButtons([]);
		}
	}, [toast]);

	useEffect(() => {
		// eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on mount; state is set after the request resolves
		void load();
	}, [load]);

	const locationName = (id: string | null) => (id ? locations.find((l) => l.id === id)?.name ?? id : "All sub-accounts");

	const remove = async () => {
		if (!deleting) return;
		try {
			await api.automations.deleteButton(deleting.id);
			toast({ tone: "ok", title: `Deleted ${deleting.label}` });
			setDeleting(null);
			await Promise.all([load(), refreshMeta()]);
		} catch (err) {
			toast({ tone: "bad", title: "Could not delete", detail: errorMessage(err) });
		}
	};

	return (
		<>
			<PageTitle
				eyebrow="Settings"
				title="Automation buttons"
				description="Each button runs something you built in HighLevel. Build the workflow there, then expose it here so the team can trigger it from a contact."
				actions={
					<Button onClick={() => setEditing("new")}>
						<PlusIcon data-icon="inline-start" />
						New button
					</Button>
				}
			/>
			<Panel>
				{buttons === null ? (
					<div className="flex flex-col gap-3 p-4">
						{Array.from({ length: 3 }).map((_, i) => (
							<Skeleton key={i} className="h-12" />
						))}
					</div>
				) : buttons.length === 0 ? (
					<EmptyState icon={ZapIcon} title="No buttons yet" description="Create the first one. Start with a published workflow, for example your speed to lead sequence." action={<Button onClick={() => setEditing("new")}>New button</Button>} />
				) : (
					<ul className="divide-y">
						{buttons.map((b) => {
							const Icon = buttonIcon(b.icon);
							return (
								<li key={b.id} className="flex items-center gap-3 px-4 py-3">
									<span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
										<Icon className="size-4" />
									</span>
									<div className="min-w-0 flex-1">
										<p className="flex flex-wrap items-center gap-2 font-medium text-sm">
											{b.label}
											{!b.enabled && <StatusPill tone="muted">Disabled</StatusPill>}
											{b.minRole === "admin" && <StatusPill tone="warn">Admins only</StatusPill>}
										</p>
										<p className="truncate text-muted-foreground text-xs">
											{MECHANISMS.find((m) => m.value === b.mechanism)?.label} · {locationName(b.locationId)}
											{b.description && ` · ${b.description}`}
										</p>
									</div>
									<Button variant="ghost" size="icon-sm" aria-label="Edit" onClick={() => setEditing(b)}>
										<PencilIcon />
									</Button>
									<Button variant="ghost" size="icon-sm" aria-label="Delete" onClick={() => setDeleting(b)}>
										<Trash2Icon />
									</Button>
								</li>
							);
						})}
					</ul>
				)}
			</Panel>

			{editing !== null && (
				<ButtonEditor
					initial={editing === "new" ? emptyForm(location?.id ?? "") : toForm(editing)}
					id={editing === "new" ? null : editing.id}
					onClose={() => setEditing(null)}
					onSaved={async () => {
						setEditing(null);
						await Promise.all([load(), refreshMeta()]);
					}}
				/>
			)}

			<Dialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
				<DialogContent size="sm">
					<DialogHeader>
						<DialogTitle>Delete {deleting?.label}?</DialogTitle>
						<DialogDescription>The button disappears for everyone. Past runs stay in the log. Nothing changes in HighLevel.</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
						<Button variant="destructive" onClick={() => void remove()}>Delete</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}

function ButtonEditor({ initial, id, onClose, onSaved }: { initial: FormState; id: string | null; onClose: () => void; onSaved: () => Promise<void> }) {
	const { locations, meta: currentMeta, location } = useAppState();
	const [form, setForm] = useState(initial);
	const [fetched, setFetched] = useState<{ locationId: string; meta: LocationMeta | null } | null>(null);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const needsFetch = form.locationId !== "" && form.locationId !== location?.id && fetched?.locationId !== form.locationId;
	useEffect(() => {
		if (!needsFetch) return;
		let cancelled = false;
		const target = form.locationId;
		api.meta(target)
			.then((m) => !cancelled && setFetched({ locationId: target, meta: m }))
			.catch(() => !cancelled && setFetched({ locationId: target, meta: null }));
		return () => {
			cancelled = true;
		};
	}, [needsFetch, form.locationId]);

	// Derived, never stored: the current sub-account's metadata is already in
	// app state; any other sub-account's comes from the fetch above.
	const meta: LocationMeta | null = form.locationId === "" ? null : form.locationId === location?.id ? currentMeta : fetched?.locationId === form.locationId ? fetched.meta : null;

	const patch = (p: Partial<FormState>) => setForm((f) => ({ ...f, ...p }));
	const workflows = (meta?.workflows ?? []).slice().sort((a, b) => (a.status === b.status ? a.name.localeCompare(b.name) : a.status === "published" ? -1 : 1));

	const submit = async (e: FormEvent) => {
		e.preventDefault();
		setSaving(true);
		setError(null);
		const body = {
			label: form.label,
			description: form.description,
			icon: form.icon,
			mechanism: form.mechanism,
			locationId: form.mechanism === "workflow" ? form.locationId : form.locationId,
			workflowId: form.workflowId,
			webhookUrl: form.webhookUrl,
			tagName: form.tagName,
			payloadTemplate: form.payloadTemplate,
			minRole: form.minRole,
			confirmText: form.confirmText,
			sortOrder: Number.parseInt(form.sortOrder, 10) || 0,
			enabled: form.enabled,
		};
		try {
			if (id) await api.automations.updateButton(id, body);
			else await api.automations.createButton(body);
			await onSaved();
		} catch (err) {
			setError(errorMessage(err));
		} finally {
			setSaving(false);
		}
	};

	return (
		<Dialog open onOpenChange={(o) => !o && !saving && onClose()}>
			<DialogContent size="lg">
				<DialogHeader>
					<DialogTitle>{id ? "Edit button" : "New automation button"}</DialogTitle>
					<DialogDescription>What the team sees, and what it triggers in HighLevel.</DialogDescription>
				</DialogHeader>
				<form onSubmit={submit} className="flex flex-col gap-5">
					<div className="grid gap-4 sm:grid-cols-[1fr_140px]">
						<Field label="Label" htmlFor="b-label">
							<Input id="b-label" value={form.label} onChange={(e) => patch({ label: e.target.value })} placeholder="Start nurture sequence" required autoFocus />
						</Field>
						<Field label="Icon" htmlFor="b-icon">
							<NativeSelect id="b-icon" value={form.icon} onChange={(e) => patch({ icon: e.target.value })}>
								{Object.keys(BUTTON_ICONS).map((k) => (
									<option key={k} value={k}>
										{k}
									</option>
								))}
							</NativeSelect>
						</Field>
					</div>
					<Field label="Description" htmlFor="b-desc" hint="One line shown under the label in the menu.">
						<Input id="b-desc" value={form.description} onChange={(e) => patch({ description: e.target.value })} placeholder="Adds the contact to the 14 day nurture" />
					</Field>

					<div className="flex flex-col gap-2">
						<span className="font-medium text-sm">What it does</span>
						<div className="grid gap-2 sm:grid-cols-3">
							{MECHANISMS.map((m) => (
								<label key={m.value} className={`flex cursor-pointer flex-col gap-1 rounded-lg border p-3 text-sm transition-colors has-checked:border-primary has-checked:bg-primary/5 ${form.mechanism === m.value ? "" : "hover:bg-muted/50"}`}>
									<span className="flex items-center gap-2 font-medium">
										<input type="radio" name="mechanism" value={m.value} checked={form.mechanism === m.value} onChange={() => patch({ mechanism: m.value })} className="accent-primary" />
										{m.label}
									</span>
									<span className="text-muted-foreground text-xs leading-snug">{m.help}</span>
								</label>
							))}
						</div>
					</div>

					<div className="grid gap-4 sm:grid-cols-2">
						<Field label="Sub-account" htmlFor="b-location" hint={form.mechanism === "workflow" ? "Workflows belong to one sub-account." : "Leave on all to show it everywhere."}>
							<NativeSelect id="b-location" value={form.locationId} onChange={(e) => patch({ locationId: e.target.value, workflowId: "" })} required={form.mechanism === "workflow"}>
								{form.mechanism !== "workflow" && <option value="">All sub-accounts</option>}
								{form.mechanism === "workflow" && !form.locationId && <option value="">Choose a sub-account</option>}
								{locations.map((l) => (
									<option key={l.id} value={l.id}>
										{l.name}
									</option>
								))}
							</NativeSelect>
						</Field>

						{form.mechanism === "workflow" && (
							<Field label="Workflow" htmlFor="b-workflow" hint={meta ? `${workflows.filter((w) => w.status === "published").length} published. Drafts cannot be run.` : "Pick a sub-account first."}>
								<NativeSelect id="b-workflow" value={form.workflowId} onChange={(e) => patch({ workflowId: e.target.value })} required disabled={!meta}>
									<option value="">Choose a workflow</option>
									{workflows.map((w) => (
										<option key={w.id} value={w.id} disabled={w.status !== "published"}>
											{w.name}
											{w.status !== "published" ? ` (${w.status})` : ""}
										</option>
									))}
								</NativeSelect>
							</Field>
						)}
						{form.mechanism === "tag" && (
							<Field label="Tag to add" htmlFor="b-tag">
								<Input id="b-tag" value={form.tagName} onChange={(e) => patch({ tagName: e.target.value })} placeholder="hot-lead" required list="b-tag-suggestions" />
								<datalist id="b-tag-suggestions">
									{(meta?.tags ?? []).map((t) => (
										<option key={t.id} value={t.name} />
									))}
								</datalist>
							</Field>
						)}
						{form.mechanism === "webhook" && (
							<Field label="Inbound webhook URL" htmlFor="b-url" hint="From the Inbound Webhook trigger on the workflow.">
								<Input id="b-url" type="url" value={form.webhookUrl} onChange={(e) => patch({ webhookUrl: e.target.value })} placeholder="https://services.leadconnectorhq.com/hooks/..." required />
							</Field>
						)}
					</div>

					{form.mechanism === "webhook" && (
						<Field
							label="Payload template (JSON)"
							htmlFor="b-template"
							hint="Placeholders: {{contact.id}}, {{contact.firstName}}, {{contact.lastName}}, {{contact.email}}, {{contact.phone}}, {{contact.companyName}}, {{contact.tags}}, {{location.id}}, {{user.name}}, {{user.email}}, {{now}}. Leave empty for the default payload."
						>
							<Textarea id="b-template" value={form.payloadTemplate} onChange={(e) => patch({ payloadTemplate: e.target.value })} rows={7} className="font-mono text-xs" placeholder={DEFAULT_TEMPLATE} />
						</Field>
					)}

					<div className="grid gap-4 sm:grid-cols-3">
						<Field label="Who can run it" htmlFor="b-role">
							<NativeSelect id="b-role" value={form.minRole} onChange={(e) => patch({ minRole: e.target.value as FormState["minRole"] })}>
								<option value="member">Everyone</option>
								<option value="admin">Admins only</option>
							</NativeSelect>
						</Field>
						<Field label="Order" htmlFor="b-order" hint="Lower comes first.">
							<Input id="b-order" type="number" value={form.sortOrder} onChange={(e) => patch({ sortOrder: e.target.value })} />
						</Field>
						<div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 sm:mt-6">
							<span className="font-medium text-sm">Enabled</span>
							<Switch checked={form.enabled} onCheckedChange={(v) => patch({ enabled: v })} aria-label="Enabled" />
						</div>
					</div>
					<Field label="Confirmation text" htmlFor="b-confirm" hint="Optional. Shown before running, for anything that messages the contact.">
						<Input id="b-confirm" value={form.confirmText} onChange={(e) => patch({ confirmText: e.target.value })} placeholder="This sends the first SMS immediately. Continue?" />
					</Field>

					<InlineError message={error} />
					<DialogFooter>
						<Button type="button" variant="outline" onClick={onClose} disabled={saving}>
							Cancel
						</Button>
						<Button type="submit" disabled={saving}>
							{saving ? "Saving" : id ? "Save changes" : "Create button"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
