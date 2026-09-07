"use client";

import { useState } from "react";
import { ChevronDownIcon, ZapIcon } from "lucide-react";

import { api, errorMessage } from "@/lib/api";
import { useAppState } from "@/lib/app-state";
import { useToast } from "@/lib/toast";
import type { AutomationButton, RunResult } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { buttonIcon } from "@/components/crm/button-icons";

const MECHANISM_LABEL: Record<AutomationButton["mechanism"], string> = {
	workflow: "Workflow",
	webhook: "Webhook",
	tag: "Tag",
};

/**
 * The "Run automation" dropdown. Lists the buttons the user may run for the
 * current sub-account and runs the chosen one for the given contacts.
 */
export function RunAutomationMenu({
	contactIds,
	onDone,
	size = "default",
	variant = "default",
	label = "Run automation",
}: {
	contactIds: string[];
	onDone?: (results: RunResult[]) => void;
	size?: "default" | "sm";
	variant?: "default" | "outline" | "secondary";
	label?: string;
}) {
	const { meta } = useAppState();
	const { toast } = useToast();
	const [pending, setPending] = useState<AutomationButton | null>(null);
	const [running, setRunning] = useState(false);
	const buttons = meta?.buttons ?? [];

	const execute = async (button: AutomationButton) => {
		setRunning(true);
		try {
			const res = await api.automations.run(button.id, contactIds);
			const many = contactIds.length > 1;
			if (res.failed === 0) {
				toast({ tone: "ok", title: many ? `${button.label} ran for ${res.succeeded} contacts` : `${button.label} ran`, detail: res.results[0]?.detail ?? undefined });
			} else {
				const firstError = res.results.find((r) => r.status === "failed")?.detail ?? undefined;
				toast({ tone: "bad", title: many ? `${res.succeeded} succeeded, ${res.failed} failed` : `${button.label} failed`, detail: firstError });
			}
			onDone?.(res.results);
		} catch (err) {
			toast({ tone: "bad", title: "Could not run the automation", detail: errorMessage(err) });
		} finally {
			setRunning(false);
			setPending(null);
		}
	};

	const choose = (button: AutomationButton) => {
		if (button.confirmText || contactIds.length > 1) setPending(button);
		else void execute(button);
	};

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant={variant} size={size} disabled={contactIds.length === 0 || running}>
						<ZapIcon data-icon="inline-start" />
						{running ? "Running" : label}
						<ChevronDownIcon data-icon="inline-end" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-72">
					<DropdownMenuLabel>Automations</DropdownMenuLabel>
					{buttons.length === 0 && <p className="px-2 py-3 text-muted-foreground text-xs">No automations are set up for this sub-account yet. An admin can add them under Settings.</p>}
					{buttons.map((b) => {
						const Icon = buttonIcon(b.icon);
						return (
							<DropdownMenuItem key={b.id} onSelect={() => choose(b)} className="items-start py-2">
								<span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
									<Icon className="size-3.5" />
								</span>
								<span className="min-w-0 flex-1">
									<span className="block truncate font-medium">{b.label}</span>
									{b.description && <span className="block text-muted-foreground text-xs leading-snug">{b.description}</span>}
								</span>
								<span className="font-mono text-[10px] text-muted-foreground uppercase">{MECHANISM_LABEL[b.mechanism]}</span>
							</DropdownMenuItem>
						);
					})}
					{buttons.length > 0 && (
						<>
							<DropdownMenuSeparator />
							<p className="px-2 py-1.5 text-muted-foreground text-xs">Automations run in HighLevel. Results appear under Automation runs.</p>
						</>
					)}
				</DropdownMenuContent>
			</DropdownMenu>

			<Dialog open={pending !== null} onOpenChange={(open) => !open && !running && setPending(null)}>
				<DialogContent size="sm">
					<DialogHeader>
						<DialogTitle>{pending?.label}</DialogTitle>
						<DialogDescription>
							{pending?.confirmText ?? `Run this automation for ${contactIds.length} ${contactIds.length === 1 ? "contact" : "contacts"}?`}
							{pending?.confirmText && contactIds.length > 1 && ` This applies to ${contactIds.length} contacts.`}
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" onClick={() => setPending(null)} disabled={running}>
							Cancel
						</Button>
						<Button onClick={() => pending && void execute(pending)} disabled={running}>
							{running ? "Running" : "Run"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
