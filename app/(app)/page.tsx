import type { Metadata } from "next";

import { Dashboard } from "@/components/crm/dashboard";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
	return <Dashboard />;
}
