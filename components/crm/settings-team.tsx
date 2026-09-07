"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { KeyRoundIcon, PlusIcon, Trash2Icon, UsersRoundIcon } from "lucide-react";

import { api, errorMessage } from "@/lib/api";
import { useAppState } from "@/lib/app-state";
import { useToast } from "@/lib/toast";
import { initials, timeAgo } from "@/lib/format";
import type { User } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, Field, InlineError, PageTitle, Panel, Skeleton, StatusPill } from "@/components/crm/primitives";

export function TeamSettings() {
	const { user: me } = useAppState();
	const { toast } = useToast();
	const [users, setUsers] = useState<User[] | null>(null);
	const [adding, setAdding] = useState(false);
	const [resetting, setResetting] = useState<User | null>(null);
	const [deleting, setDeleting] = useState<User | null>(null);

	const load = useCallback(async () => {
		try {
			setUsers((await api.team.list()).users);
		} catch (err) {
			toast({ tone: "bad", title: "Could not load the team", detail: errorMessage(err) });
			setUsers([]);
		}
	}, [toast]);

	useEffect(() => {
		// eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on mount; state is set after the request resolves
		void load();
	}, [load]);

	const changeRole = async (u: User, role: string) => {
		try {
			await api.team.update(u.id, { role });
			await load();
		} catch (err) {
			toast({ tone: "bad", title: "Could not change the role", detail: errorMessage(err) });
		}
	};

	const remove = async () => {
		if (!deleting) return;
		try {
			await api.team.remove(deleting.id);
			toast({ tone: "ok", title: `Removed ${deleting.name}` });
			setDeleting(null);
			await load();
		} catch (err) {
			toast({ tone: "bad", title: "Could not remove", detail: errorMessage(err) });
		}
	};

	return (
		<>
			<PageTitle
				eyebrow="Settings"
				title="Team"
				description="Who can sign in. Admins manage buttons, sub-accounts and the team; members work with contacts and run automations."
				actions={
					<Button onClick={() => setAdding(true)}>
						<PlusIcon data-icon="inline-start" />
						Add person
					</Button>
				}
			/>
			<Panel>
				{users === null ? (
					<div className="flex flex-col gap-3 p-4">
						{Array.from({ length: 3 }).map((_, i) => (
							<Skeleton key={i} className="h-12" />
						))}
					</div>
				) : users.length === 0 ? (
					<EmptyState icon={UsersRoundIcon} title="No accounts" />
				) : (
					<ul className="divide-y">
						{users.map((u) => (
							<li key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
								<span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 font-medium text-primary text-xs">{initials(u.name)}</span>
								<div className="min-w-0 flex-1">
									<p className="flex items-center gap-2 font-medium text-sm">
										{u.name}
										{u.id === me?.id && <StatusPill tone="muted">you</StatusPill>}
									</p>
									<p className="truncate text-muted-foreground text-xs">
										{u.email} · last signed in {timeAgo(u.lastLoginAt)}
									</p>
								</div>
								<NativeSelect value={u.role} onChange={(e) => void changeRole(u, e.target.value)} disabled={u.id === me?.id} className="w-32" aria-label={`Role for ${u.name}`}>
									<option value="member">Member</option>
									<option value="admin">Admin</option>
								</NativeSelect>
								<Button variant="ghost" size="icon-sm" aria-label="Reset password" onClick={() => setResetting(u)}>
									<KeyRoundIcon />
								</Button>
								<Button variant="ghost" size="icon-sm" aria-label="Remove" disabled={u.id === me?.id} onClick={() => setDeleting(u)}>
									<Trash2Icon />
								</Button>
							</li>
						))}
					</ul>
				)}
			</Panel>

			<AddPersonDialog open={adding} onClose={() => setAdding(false)} onSaved={load} />
			<ResetPasswordDialog user={resetting} onClose={() => setResetting(null)} />

			<Dialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
				<DialogContent size="sm">
					<DialogHeader>
						<DialogTitle>Remove {deleting?.name}?</DialogTitle>
						<DialogDescription>They are signed out immediately and cannot sign in again. Their past automation runs stay in the log.</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
						<Button variant="destructive" onClick={() => void remove()}>Remove</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}

function AddPersonDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => Promise<void> }) {
	const { toast } = useToast();
	const [form, setForm] = useState({ name: "", email: "", password: "", role: "member" });
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	const submit = async (e: FormEvent) => {
		e.preventDefault();
		setBusy(true);
		setError(null);
		try {
			await api.team.create(form);
			toast({ tone: "ok", title: `${form.name} can now sign in` });
			setForm({ name: "", email: "", password: "", role: "member" });
			onClose();
			await onSaved();
		} catch (err) {
			setError(errorMessage(err));
		} finally {
			setBusy(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={(o) => !o && onClose()}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Add a person</DialogTitle>
					<DialogDescription>Share the password with them directly. They can ask an admin to reset it later.</DialogDescription>
				</DialogHeader>
				<form onSubmit={submit} className="flex flex-col gap-4">
					<div className="grid gap-4 sm:grid-cols-2">
						<Field label="Name" htmlFor="t-name">
							<Input id="t-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required autoFocus />
						</Field>
						<Field label="Email" htmlFor="t-email">
							<Input id="t-email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required />
						</Field>
						<Field label="Password" htmlFor="t-password" hint="At least 10 characters.">
							<Input id="t-password" type="text" autoComplete="off" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} required minLength={10} />
						</Field>
						<Field label="Role" htmlFor="t-role">
							<NativeSelect id="t-role" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
								<option value="member">Member</option>
								<option value="admin">Admin</option>
							</NativeSelect>
						</Field>
					</div>
					<InlineError message={error} />
					<DialogFooter>
						<Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
						<Button type="submit" disabled={busy}>{busy ? "Adding" : "Add person"}</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

function ResetPasswordDialog({ user, onClose }: { user: User | null; onClose: () => void }) {
	const { toast } = useToast();
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	const submit = async (e: FormEvent) => {
		e.preventDefault();
		if (!user) return;
		setBusy(true);
		setError(null);
		try {
			await api.team.update(user.id, { password });
			toast({ tone: "ok", title: `Password updated for ${user.name}` });
			setPassword("");
			onClose();
		} catch (err) {
			setError(errorMessage(err));
		} finally {
			setBusy(false);
		}
	};

	return (
		<Dialog open={user !== null} onOpenChange={(o) => !o && onClose()}>
			<DialogContent size="sm">
				<DialogHeader>
					<DialogTitle>Reset password</DialogTitle>
					<DialogDescription>Set a new password for {user?.name}. Existing sessions stay signed in until they expire.</DialogDescription>
				</DialogHeader>
				<form onSubmit={submit} className="flex flex-col gap-4">
					<Field label="New password" htmlFor="r-password" hint="At least 10 characters.">
						<Input id="r-password" type="text" autoComplete="off" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={10} autoFocus />
					</Field>
					<InlineError message={error} />
					<DialogFooter>
						<Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
						<Button type="submit" disabled={busy}>{busy ? "Saving" : "Set password"}</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
