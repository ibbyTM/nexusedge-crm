"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { api, errorMessage } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, InlineError } from "@/components/crm/primitives";

const EMPTY = { firstName: "", lastName: "", email: "", phone: "", companyName: "" };

export function NewContactDialog({ open, onOpenChange, locationId, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; locationId: string; onCreated: () => Promise<void> | void }) {
	const router = useRouter();
	const { toast } = useToast();
	const [form, setForm] = useState(EMPTY);
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const set = (key: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));

	const submit = async (event: FormEvent) => {
		event.preventDefault();
		if (!form.firstName && !form.lastName && !form.email && !form.phone) {
			setError("Enter at least a name, email or phone.");
			return;
		}
		setSubmitting(true);
		setError(null);
		try {
			const { contact } = await api.contacts.create({ locationId, ...form, source: "NexusEdge CRM" });
			toast({ tone: "ok", title: "Contact created" });
			setForm(EMPTY);
			onOpenChange(false);
			await onCreated();
			router.push(`/contacts/view?id=${encodeURIComponent(contact.id)}`);
		} catch (err) {
			setError(errorMessage(err));
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>New contact</DialogTitle>
					<DialogDescription>Created in HighLevel straight away, then mirrored here.</DialogDescription>
				</DialogHeader>
				<form onSubmit={submit} className="flex flex-col gap-4">
					<div className="grid gap-4 sm:grid-cols-2">
						<Field label="First name" htmlFor="nc-first">
							<Input id="nc-first" value={form.firstName} onChange={set("firstName")} autoFocus />
						</Field>
						<Field label="Last name" htmlFor="nc-last">
							<Input id="nc-last" value={form.lastName} onChange={set("lastName")} />
						</Field>
						<Field label="Email" htmlFor="nc-email">
							<Input id="nc-email" type="email" value={form.email} onChange={set("email")} />
						</Field>
						<Field label="Phone" htmlFor="nc-phone" hint="Include the country code, for example +44">
							<Input id="nc-phone" type="tel" value={form.phone} onChange={set("phone")} />
						</Field>
						<Field label="Company" htmlFor="nc-company" className="sm:col-span-2">
							<Input id="nc-company" value={form.companyName} onChange={set("companyName")} />
						</Field>
					</div>
					<InlineError message={error} />
					<DialogFooter>
						<Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
							Cancel
						</Button>
						<Button type="submit" disabled={submitting}>
							{submitting ? "Creating" : "Create contact"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
