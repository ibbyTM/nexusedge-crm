"use client";

import { useState, type FormEvent } from "react";
import { XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function TagPickerDialog({
	open,
	onOpenChange,
	mode,
	count,
	suggestions,
	onSubmit,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	mode: "add" | "remove";
	count: number;
	suggestions: string[];
	onSubmit: (tags: string[]) => Promise<void>;
}) {
	const [tags, setTags] = useState<string[]>([]);
	const [input, setInput] = useState("");
	const [busy, setBusy] = useState(false);

	const add = (raw: string) => {
		const t = raw.trim();
		if (!t || tags.includes(t)) return;
		setTags((list) => [...list, t]);
		setInput("");
	};

	const submit = async (e: FormEvent) => {
		e.preventDefault();
		const list = input.trim() && !tags.includes(input.trim()) ? [...tags, input.trim()] : tags;
		if (list.length === 0) return;
		setBusy(true);
		try {
			await onSubmit(list);
		} finally {
			setBusy(false);
		}
	};

	const filtered = suggestions.filter((s) => !tags.includes(s) && (!input || s.toLowerCase().includes(input.toLowerCase()))).slice(0, 12);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent size="sm">
				<DialogHeader>
					<DialogTitle>{mode === "add" ? "Add tags" : "Remove tags"}</DialogTitle>
					<DialogDescription>
						{mode === "add" ? "Applied to" : "Removed from"} {count} selected {count === 1 ? "contact" : "contacts"} in HighLevel.
					</DialogDescription>
				</DialogHeader>
				<form onSubmit={submit} className="flex flex-col gap-3">
					<div className="flex flex-wrap gap-1.5">
						{tags.map((t) => (
							<Badge key={t} variant="secondary" className="pr-1">
								{t}
								<button type="button" onClick={() => setTags((l) => l.filter((x) => x !== t))} aria-label={`Remove ${t}`} className="ml-0.5 rounded-full p-0.5 hover:bg-foreground/10">
									<XIcon className="size-3" />
								</button>
							</Badge>
						))}
					</div>
					<Input
						value={input}
						onChange={(e) => setInput(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter" && input.trim()) {
								e.preventDefault();
								add(input);
							}
						}}
						placeholder="Type a tag and press Enter"
						autoFocus
					/>
					{filtered.length > 0 && (
						<div className="flex flex-wrap gap-1.5">
							{filtered.map((s) => (
								<button key={s} type="button" onClick={() => add(s)} className="rounded-4xl border px-2 py-0.5 text-xs transition-colors hover:border-primary/50 hover:text-primary">
									{s}
								</button>
							))}
						</div>
					)}
					<DialogFooter>
						<Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
							Cancel
						</Button>
						<Button type="submit" disabled={busy || (tags.length === 0 && !input.trim())} variant={mode === "remove" ? "destructive" : "default"}>
							{busy ? "Applying" : mode === "add" ? "Add tags" : "Remove tags"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
