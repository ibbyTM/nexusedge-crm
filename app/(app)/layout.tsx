import { AppStateProvider } from "@/lib/app-state";
import { ToastProvider } from "@/lib/toast";
import { AppShell } from "@/components/crm/app-shell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
	return (
		<ToastProvider>
			<AppStateProvider>
				<AppShell>{children}</AppShell>
			</AppStateProvider>
		</ToastProvider>
	);
}
