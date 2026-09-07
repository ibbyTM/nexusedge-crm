"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
	ActivityIcon,
	Building2Icon,
	ChevronsUpDownIcon,
	LayoutDashboardIcon,
	LogOutIcon,
	MenuIcon,
	RefreshCwIcon,
	SettingsIcon,
	UsersIcon,
	UsersRoundIcon,
	ZapIcon,
	type LucideIcon,
} from "lucide-react";

import { useAppState } from "@/lib/app-state";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { LogoMark } from "@/components/logo-mark";
import { ThemeToggle } from "@/components/theme-toggle";
import { PageTransition } from "@/components/page-transition";

type NavItem = { href: string; label: string; icon: LucideIcon; adminOnly?: boolean };

const NAV: NavItem[] = [
	{ href: "/", label: "Dashboard", icon: LayoutDashboardIcon },
	{ href: "/contacts", label: "Contacts", icon: UsersIcon },
	{ href: "/automations", label: "Automation runs", icon: ActivityIcon },
];

const SETTINGS: NavItem[] = [
	{ href: "/settings/automations", label: "Automation buttons", icon: ZapIcon, adminOnly: true },
	{ href: "/settings/sync", label: "Sync and webhooks", icon: RefreshCwIcon },
	{ href: "/settings/team", label: "Team", icon: UsersRoundIcon, adminOnly: true },
];

export function AppShell({ children }: { children: ReactNode }) {
	const [open, setOpen] = useState(false);

	return (
		<div className="flex min-h-svh w-full">
			<aside className="sticky top-0 hidden h-svh w-64 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground lg:flex">
				<SidebarContent onNavigate={() => undefined} />
			</aside>

			<div className="flex min-w-0 flex-1 flex-col">
				<header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur supports-backdrop-filter:bg-background/60 lg:hidden">
					<Sheet open={open} onOpenChange={setOpen}>
						<SheetTrigger asChild>
							<Button variant="ghost" size="icon" aria-label="Open menu">
								<MenuIcon />
							</Button>
						</SheetTrigger>
						<SheetContent side="left" className="w-72 p-0 sm:max-w-72">
							<SheetTitle className="sr-only">Navigation</SheetTitle>
							<SidebarContent onNavigate={() => setOpen(false)} />
						</SheetContent>
					</Sheet>
					<Brand />
				</header>

				<main className="flex flex-1 flex-col">
					<PageTransition>
						<div className="mx-auto flex w-full max-w-content flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
					</PageTransition>
				</main>
			</div>
		</div>
	);
}

function Brand() {
	return (
		<Link href="/" className="flex items-center gap-2.5">
			<span className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
				<LogoMark className="size-4" />
			</span>
			<span className="font-heading font-medium text-base">
				Nexus<span className="text-primary">Edge</span>
			</span>
		</Link>
	);
}

function SidebarContent({ onNavigate }: { onNavigate: () => void }) {
	const { user, logout } = useAppState();
	const pathname = usePathname();
	const isAdmin = user?.role === "admin";

	const renderItem = ({ href, label, icon: Icon }: NavItem) => {
		const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
		return (
			<Link
				key={href}
				href={href}
				onClick={onNavigate}
				aria-current={active ? "page" : undefined}
				className={cn(
					"flex h-8 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors",
					active ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground" : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
				)}
			>
				<Icon className="size-4" strokeWidth={2} />
				{label}
			</Link>
		);
	};

	return (
		<div className="flex h-full flex-col">
			<div className="flex h-14 items-center px-4">
				<Brand />
			</div>
			<div className="px-3 pb-3">
				<LocationSwitcher />
			</div>
			<nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3">
				<div className="flex flex-col gap-0.5">{NAV.map(renderItem)}</div>
				<div className="flex flex-col gap-1">
					<span className="px-2.5 font-mono text-[10px] text-muted-foreground uppercase tracking-widest">Settings</span>
					<div className="flex flex-col gap-0.5">{SETTINGS.filter((i) => !i.adminOnly || isAdmin).map(renderItem)}</div>
				</div>
			</nav>
			<div className="flex items-center gap-2 border-t p-3">
				<span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 font-medium text-primary text-xs">{initials(user?.name ?? "")}</span>
				<div className="min-w-0 flex-1">
					<p className="truncate font-medium text-sm">{user?.name}</p>
					<p className="truncate text-muted-foreground text-xs">{user?.role === "admin" ? "Admin" : "Member"}</p>
				</div>
				<ThemeToggle />
				<Button variant="ghost" size="icon" aria-label="Sign out" onClick={() => void logout()}>
					<LogOutIcon />
				</Button>
			</div>
		</div>
	);
}

function LocationSwitcher() {
	const { locations, location, setLocationId } = useAppState();

	if (locations.length === 0) {
		return (
			<Link href="/settings/sync" className="flex items-center gap-2.5 rounded-lg border border-dashed p-2.5 text-sm text-muted-foreground hover:bg-sidebar-accent/60">
				<Building2Icon className="size-4" />
				No sub-accounts yet. Run a sync.
			</Link>
		);
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					className="flex w-full items-center gap-2.5 rounded-lg border bg-card p-2 text-left transition-colors hover:bg-sidebar-accent/60 focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
				>
					<span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
						<Building2Icon className="size-4" strokeWidth={2} />
					</span>
					<span className="min-w-0 flex-1">
						<span className="block truncate font-medium text-sm">{location?.name ?? "Choose a sub-account"}</span>
						<span className="block truncate text-muted-foreground text-xs">{location ? `${location.contactCount.toLocaleString()} contacts` : `${locations.length} available`}</span>
					</span>
					<ChevronsUpDownIcon className="size-4 shrink-0 text-muted-foreground" />
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-56">
				<DropdownMenuLabel>Sub-accounts</DropdownMenuLabel>
				{locations.map((l) => (
					<DropdownMenuItem key={l.id} onSelect={() => setLocationId(l.id)} className={cn(l.id === location?.id && "bg-muted font-medium")}>
						<span className="min-w-0 flex-1 truncate">{l.name}</span>
						<span className="font-mono text-[10px] text-muted-foreground">{l.contactCount}</span>
					</DropdownMenuItem>
				))}
				<DropdownMenuSeparator />
				<DropdownMenuItem asChild>
					<Link href="/settings/sync">
						<SettingsIcon />
						Manage sub-accounts
					</Link>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
